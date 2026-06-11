import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { InsightReportDetailContract } from "@/types/api-contracts";
import { ALLOWED_PUT_FIELDS } from "@/app/api/insights/allowed-fields";
import { filterReportForResponse } from "@/lib/filter-report-response";
import {
  wantsAgentPayload,
  buildAgentPayload,
  AGENT_PAYLOAD_MEDIA_TYPE,
} from "@/lib/agent-payload";
import { reportVisibilityClause } from "@/lib/report-visibility";

const SECTION_KEYS = [
  "atAGlance",
  "interactionStyle",
  "projectAreas",
  "impressiveWorkflows",
  "frictionAnalysis",
  "suggestions",
  "onTheHorizon",
  "funEnding",
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> },
) {
  try {
    const { username, slug } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    // Owner can opt in to seeing hidden ReportProject rows via
    // ?includeHidden=true. Non-owners always see only visible rows,
    // regardless of the query flag. The flag is honored only after
    // we've verified ownership below.
    const { searchParams } = new URL(request.url);
    const includeHiddenRequested = searchParams.get("includeHidden") === "true";

    // v2 invariant: These routes use `include` (not `select`) so ALL scalar fields
    // on InsightReport flow through to the response automatically. The homepage
    // (src/app/page.tsx) and detail page (src/app/insights/[slug]/page.tsx) depend
    // on the following v2 fields being present: chartData, detectedSkills, dayCount,
    // linesAdded, linesRemoved, fileCount. If you change this to an explicit
    // `select`, you MUST add those fields explicitly, or the UI will silently break.
    const report = await prisma.insightReport.findFirst({
      where: {
        AND: [{ slug, author: { username } }, reportVisibilityClause(userId)],
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
          },
        },
        reportProjects: {
          // Always filter hidden rows in the primary query. If the
          // caller is the owner AND requested includeHidden, we do a
          // second fetch below to append the hidden rows. This keeps
          // non-owners from ever seeing hidden data, regardless of
          // what they pass in ?includeHidden.
          where: { hidden: false },
          orderBy: { position: "asc" },
          include: { project: true },
        },
        annotations: true,
        votes: {
          select: { userId: true, sectionKey: true },
        },
        highlights: {
          select: { userId: true, sectionKey: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    // Agent-consumable payload via content negotiation. The same canonical URL
    // serves the human browser (default Accept -> full payload below) and a
    // consuming agent (vendor media type -> lean payload). buildAgentPayload
    // always returns the non-owner, image-free view, so even an authenticated
    // owner asking for the agent payload gets the public contract — it must
    // never leak hidden data or ship hero image blobs. See docs/agent-payload.md.
    if (wantsAgentPayload(request.headers.get("accept"))) {
      const payload = buildAgentPayload(report, {
        generatedAt: report.publishedAt,
      });
      return NextResponse.json(payload, {
        headers: {
          "content-type": `${AGENT_PAYLOAD_MEDIA_TYPE}; charset=utf-8`,
          // This URL serves two shapes negotiated by Accept; without Vary a
          // shared cache could hand a browser the agent envelope (or vice
          // versa). Set on both negotiated branches.
          vary: "Accept",
        },
      });
    }

    // If the caller is the report's author and requested hidden
    // projects, do a second fetch for the hidden junction rows and
    // merge them into the response. Non-owners never reach this
    // branch even if they pass ?includeHidden=true.
    if (includeHiddenRequested && userId && userId === report.authorId) {
      const hiddenRows = await prisma.reportProject.findMany({
        where: { reportId: report.id, hidden: true },
        orderBy: { position: "asc" },
        include: { project: true },
      });
      // Append hidden rows after visible ones so the render order
      // remains "visible first, hidden last" on the edit page.
      report.reportProjects = [...report.reportProjects, ...hiddenRows];
    }

    // v2 compile-time contract check: fails to compile if Prisma ever stops
    // returning the v2 scalar fields the detail page depends on.
    const _contractCheck: InsightReportDetailContract = report;
    void _contractCheck;

    // Aggregate vote counts and user's own votes/highlights per section
    const voteCounts: Record<string, number> = {};
    const userVotes: Record<string, boolean> = {};
    const userHighlights: Record<string, boolean> = {};

    for (const key of SECTION_KEYS) {
      voteCounts[key] = report.votes.filter(
        (v: { sectionKey: string }) => v.sectionKey === key,
      ).length;
      userVotes[key] = userId
        ? report.votes.some(
            (v: { sectionKey: string; userId: string }) =>
              v.sectionKey === key && v.userId === userId,
          )
        : false;
      userHighlights[key] = userId
        ? report.highlights.some(
            (h: { sectionKey: string; userId: string }) =>
              h.sectionKey === key && h.userId === userId,
          )
        : false;
    }

    const { votes: _votes, highlights: _highlights, ...rest } = report;

    // Apply server-side filtering of hidden harness/narrative data.
    // Owner with ?includeHidden=true gets unfiltered data (edit page).
    // Non-owners always get filtered, regardless of query param.
    const viewerIsOwner = !!(userId && userId === report.authorId);
    const filtered = filterReportForResponse(rest, {
      viewerIsOwner,
      includeHidden: includeHiddenRequested,
    });

    return NextResponse.json(
      {
        data: {
          ...filtered,
          voteCounts,
          userVotes,
          userHighlights,
        },
      },
      // Pair with the agent branch's Vary so a shared cache never serves this
      // human payload to a request that negotiated the agent media type.
      { headers: { vary: "Accept" } },
    );
  } catch (error) {
    console.error("GET /api/insights/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insight" },
      { status: 500 },
    );
  }
}

// Author edit path: do NOT call filterReportForResponse anywhere in this PUT
// handler. The author needs to receive the FULL harnessData (including any
// previously hidden showcase content) so they can re-toggle visibility on
// hidden skills via the edit flow. Filtering is the GET handler's job.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username, slug } = await params;

    const report = await prisma.insightReport.findFirst({
      where: {
        AND: [
          { slug, author: { username } },
          reportVisibilityClause(session.user.id),
        ],
      },
      // isDraft is selected so the one-way transition guard below
      // can read the current draft state without a second fetch.
      select: { id: true, authorId: true, isDraft: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    if (report.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = ALLOWED_PUT_FIELDS;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // R10/R11 (Wave 4 Unit 10): isDraft is one-way. We allow
    // `true → false` (the "Make public" button) and silently drop a
    // no-op self-set (`false → false`, `true → true`), but we reject
    // any attempt to flip a public report back to a draft. Rationale
    // per plan Decision: simpler audit ("once public, stays public")
    // and prevents accidental unpublish via a stale UI.
    //
    // `publishedAt` is auto-populated at row creation by Prisma's
    // `@default(now())`, so legacy public rows already have a
    // sensible value. For drafts that flip to public, we restamp
    // `publishedAt` to NOW() so feed/search/leaderboard ordering
    // (which sort by `publishedAt`) treats the report as fresh
    // rather than burying it under its draft-creation timestamp.
    // (codex P2 fix on fc78b3b.)
    if (Object.prototype.hasOwnProperty.call(updateData, "isDraft")) {
      const requested = updateData.isDraft;
      if (typeof requested !== "boolean") {
        return NextResponse.json(
          { error: "isDraft must be a boolean" },
          { status: 400 },
        );
      }
      if (requested === true && report.isDraft === false) {
        return NextResponse.json(
          {
            error:
              "Cannot revert a public report to draft — publicity is one-way.",
          },
          { status: 400 },
        );
      }
      // No-op transitions are dropped from the update payload to
      // avoid generating a redundant `updatedAt` bump.
      if (requested === report.isDraft) {
        delete updateData.isDraft;
      } else if (requested === false && report.isDraft === true) {
        // Genuine draft → public flip. Stamp publishedAt to NOW()
        // here (rather than client-side) so the value is in the
        // server's frame of reference. updatedAt is bumped
        // automatically by Prisma's `@updatedAt` on every save.
        updateData.publishedAt = new Date();
      }
    }

    const updated = await prisma.insightReport.update({
      where: { id: report.id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PUT /api/insights/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to update insight" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username, slug } = await params;

    const report = await prisma.insightReport.findFirst({
      where: {
        AND: [
          { slug, author: { username } },
          reportVisibilityClause(session.user.id),
        ],
      },
      select: { id: true, authorId: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    if (report.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.insightReport.delete({ where: { id: report.id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/insights/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to delete insight" },
      { status: 500 },
    );
  }
}
