import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { InsightReportListItemContract } from "@/types/api-contracts";
import { normalizeHarnessData } from "@/types/insights";
import type { Prisma } from "@prisma/client";
import { fetchLinkPreview } from "@/lib/link-preview";
import { filterReportForListFeed } from "@/lib/filter-report-response";
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

function generateSlug(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = Math.random().toString(36).substring(2, 8);
  return `${date}-${shortId}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit") ?? "20")),
    );
    const skip = (page - 1) * limit;

    const isTrending = sort === "trending";

    let orderBy: Record<string, unknown>;
    switch (sort) {
      case "votes":
      case "most_voted":
        orderBy = { votes: { _count: "desc" } };
        break;
      case "trending":
        // Fetch more to score and re-rank client-side
        orderBy = { publishedAt: "desc" };
        break;
      case "newest":
      default:
        orderBy = { publishedAt: "desc" };
        break;
    }

    // For trending, fetch a wider window then score and slice
    const fetchLimit = isTrending ? Math.max(limit * 3, 60) : limit;
    const fetchSkip = isTrending ? 0 : skip;

    // v2 invariant: These routes use `include` (not `select`) so ALL scalar fields
    // on InsightReport flow through to the response automatically. The homepage
    // (src/app/page.tsx) and detail page (src/app/insights/[slug]/page.tsx) depend
    // on the following v2 fields being present: chartData, detectedSkills, dayCount,
    // linesAdded, linesRemoved, fileCount. If you change this to an explicit
    // `select`, you MUST add those fields explicitly, or the UI will silently break.
    const reportsQuery = prisma.insightReport.findMany({
      skip: fetchSkip,
      take: fetchLimit,
      orderBy,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            comments: true,
            votes: true,
          },
        },
        votes: {
          select: { sectionKey: true, createdAt: true },
        },
      },
    });
    const countQuery = prisma.insightReport.count();

    const [reports, total] = await Promise.all([reportsQuery, countQuery]);

    // v2 compile-time contract check: fails to compile if Prisma ever stops
    // returning the v2 scalar fields the homepage depends on.
    const _contractCheck: InsightReportListItemContract[] = reports;
    void _contractCheck;

    // Aggregate vote counts per section for each report
    const mapped = reports.map((report) => {
      const voteCounts: Record<string, number> = {};
      for (const key of SECTION_KEYS) {
        voteCounts[key] = report.votes.filter(
          (v: { sectionKey: string }) => v.sectionKey === key,
        ).length;
      }

      const { votes: ignoredVotes, ...rest } = report;
      void ignoredVotes;

      // Apply list-feed filtering: strips hidden items AND drops heavy
      // showcase bytes (readme_markdown, hero_base64) from visible skills.
      // Cards don't render those fields, and shipping them in a 30-report
      // homepage fetch would be multi-MB post --include-skills.
      const filtered = filterReportForListFeed(rest);

      return {
        ...filtered,
        voteCounts,
        _trendingVotes: report.votes,
      };
    });

    let results;
    if (isTrending) {
      // Trending algorithm: score = sum of vote recency weights + comment bonus + publish recency
      const now = Date.now();
      const DAY_MS = 86_400_000;

      const scored = mapped.map((r) => {
        // Vote score: each vote weighted by how recent it is (max 1.0 for today, decays over 14 days)
        const voteScore = r._trendingVotes.reduce(
          (sum: number, v: { createdAt: Date }) => {
            const ageInDays = (now - new Date(v.createdAt).getTime()) / DAY_MS;
            const weight = Math.max(0, 1 - ageInDays / 14);
            return sum + weight;
          },
          0,
        );

        // Comment bonus
        const commentScore = (r._count.comments || 0) * 0.3;

        // Publish recency: bonus for newer reports (decays over 7 days)
        const publishAge = (now - new Date(r.publishedAt).getTime()) / DAY_MS;
        const recencyBonus = Math.max(0, 2 * (1 - publishAge / 7));

        return {
          ...r,
          _trendingScore: voteScore + commentScore + recencyBonus,
        };
      });

      scored.sort((a, b) => b._trendingScore - a._trendingScore);
      results = scored.slice(skip, skip + limit).map((result) => {
        const {
          _trendingVotes: ignoredTrendingVotes,
          _trendingScore: ignoredTrendingScore,
          ...rest
        } = result;
        void ignoredTrendingVotes;
        void ignoredTrendingScore;
        return rest;
      });
    } else {
      results = mapped.map((result) => {
        const { _trendingVotes: ignoredTrendingVotes, ...rest } = result;
        void ignoredTrendingVotes;
        return rest;
      });
    }

    return NextResponse.json({
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/insights error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();

    const {
      title: providedTitle,
      sessionCount,
      messageCount,
      commitCount,
      dateRangeStart,
      dateRangeEnd,
      linesAdded,
      linesRemoved,
      fileCount,
      dayCount,
      msgsPerDay,
      atAGlance,
      interactionStyle,
      projectAreas,
      impressiveWorkflows,
      frictionAnalysis,
      suggestions,
      onTheHorizon,
      funEnding,
      projectLinks,
      projectIds,
      chartData,
      detectedSkills,
      // v3: Harness fields
      reportType,
      totalTokens,
      durationHours,
      avgSessionMinutes,
      prCount,
      autonomyLabel,
      harnessData,
      hiddenHarnessSections,
    } = body;

    // Validate totalTokens — must be a non-negative safe integer if provided.
    // Reject 400 instead of silently coercing bad input to null, which would
    // hide a client/extractor bug behind a quiet stat loss.
    if (totalTokens !== undefined && totalTokens !== null) {
      if (
        typeof totalTokens !== "number" ||
        !Number.isFinite(totalTokens) ||
        !Number.isSafeInteger(totalTokens) ||
        totalTokens < 0
      ) {
        return NextResponse.json(
          {
            error:
              "totalTokens must be a non-negative safe integer (or null/omitted)",
          },
          { status: 400 },
        );
      }
    }

    // Auto-generate title if not provided
    const title =
      providedTitle ||
      `${user.username}'s Claude Code Insights - ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

    const slug = generateSlug();

    // The upload flow in Unit 7 will send `projectIds` directly.
    // During the transition, the old `projectLinks` inline shape is
    // still accepted: each inline entry becomes a library Project
    // (deduped by name) plus a ReportProject junction row.
    //
    // Metadata fetching (~4s per URL over the network) must happen
    // BEFORE the transaction starts — we don't want to hold a DB
    // transaction open across slow outbound fetches. Inside the
    // transaction, we only do DB work: ownership checks, project
    // upserts by name, report create, junction createMany.

    // Phase A (outside transaction): prefetch metadata for any inline
    // projectLinks with a liveUrl. Results are null-safe.
    const enrichedLinks: Array<{
      name: string;
      description: string | null;
      githubUrl: string | null;
      liveUrl: string | null;
      ogImage: string | null;
      ogTitle: string | null;
      ogDescription: string | null;
      favicon: string | null;
      siteName: string | null;
      metadataFetchedAt: Date | null;
    }> = [];
    if (!Array.isArray(projectIds) && Array.isArray(projectLinks)) {
      for (const link of projectLinks as Array<{
        name: string;
        githubUrl?: string;
        liveUrl?: string;
        description?: string;
      }>) {
        if (!link.name || typeof link.name !== "string") continue;
        const name = link.name.trim();
        if (!name) continue;
        const metadata = link.liveUrl
          ? await fetchLinkPreview(link.liveUrl)
          : null;
        enrichedLinks.push({
          name,
          description: link.description || null,
          githubUrl: link.githubUrl || null,
          liveUrl: link.liveUrl || null,
          ogImage: metadata?.ogImage ?? null,
          ogTitle: metadata?.ogTitle ?? null,
          ogDescription: metadata?.ogDescription ?? null,
          favicon: metadata?.favicon ?? null,
          siteName: metadata?.siteName ?? null,
          metadataFetchedAt: metadata ? new Date() : null,
        });
      }
    }

    // Phase B (inside transaction): resolve to project ids, create
    // the report, and create junction rows. If anything in here
    // throws, the transaction rolls back — no orphaned library rows.
    const report = await prisma.$transaction(async (tx) => {
      const resolvedProjectIds: string[] = [];

      if (Array.isArray(projectIds)) {
        // New shape: verify every id belongs to the current user.
        const owned = await tx.project.findMany({
          where: {
            id: { in: projectIds as string[] },
            userId: user.id,
          },
          select: { id: true },
        });
        if (owned.length !== (projectIds as string[]).length) {
          throw new UnownedProjectError();
        }
        const ownedSet = new Set(owned.map((p) => p.id));
        for (const id of projectIds as string[]) {
          if (ownedSet.has(id)) resolvedProjectIds.push(id);
        }
      } else {
        // Transitional shape: upsert inline projects by name inside
        // the transaction so failures roll them back.
        for (const link of enrichedLinks) {
          const existing = await tx.project.findFirst({
            where: { userId: user.id, name: link.name },
            select: { id: true },
          });
          if (existing) {
            resolvedProjectIds.push(existing.id);
            continue;
          }
          const created = await tx.project.create({
            data: {
              userId: user.id,
              name: link.name,
              description: link.description,
              githubUrl: link.githubUrl,
              liveUrl: link.liveUrl,
              ogImage: link.ogImage,
              ogTitle: link.ogTitle,
              ogDescription: link.ogDescription,
              favicon: link.favicon,
              siteName: link.siteName,
              metadataFetchedAt: link.metadataFetchedAt,
            },
            select: { id: true },
          });
          resolvedProjectIds.push(created.id);
        }
      }

      // Dedupe: a single report cannot reference the same Project
      // twice (unique constraint on [reportId, projectId]). The old
      // ProjectLink model accepted duplicate names because each was
      // its own row; the new model does not. Dedup preserves first-
      // occurrence order so positions stay intuitive.
      const seen = new Set<string>();
      const uniqueProjectIds: string[] = [];
      for (const id of resolvedProjectIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        uniqueProjectIds.push(id);
      }

      const created = await tx.insightReport.create({
        data: {
          authorId: user.id,
          title,
          slug,
          sessionCount: sessionCount ?? null,
          messageCount: messageCount ?? null,
          commitCount: commitCount ?? null,
          dateRangeStart: dateRangeStart ?? null,
          dateRangeEnd: dateRangeEnd ?? null,
          linesAdded: linesAdded ?? null,
          linesRemoved: linesRemoved ?? null,
          fileCount: fileCount ?? null,
          dayCount: dayCount ?? null,
          msgsPerDay: msgsPerDay ?? null,
          atAGlance: atAGlance ?? undefined,
          interactionStyle: interactionStyle ?? undefined,
          projectAreas: projectAreas ?? undefined,
          impressiveWorkflows: impressiveWorkflows ?? undefined,
          frictionAnalysis: frictionAnalysis ?? undefined,
          suggestions: suggestions ?? undefined,
          onTheHorizon: onTheHorizon ?? undefined,
          funEnding: funEnding ?? undefined,
          chartData: chartData ?? undefined,
          detectedSkills: detectedSkills ?? [],
          reportType: reportType ?? "insights",
          totalTokens:
            typeof totalTokens === "number" ? BigInt(totalTokens) : null,
          durationHours: durationHours ?? null,
          avgSessionMinutes: avgSessionMinutes ?? null,
          prCount: prCount ?? null,
          autonomyLabel: autonomyLabel ?? null,
          harnessData:
            (normalizeHarnessData(
              harnessData,
            ) as unknown as Prisma.InputJsonValue) ?? undefined,
          hiddenHarnessSections: Array.isArray(hiddenHarnessSections)
            ? hiddenHarnessSections
            : [],
        },
      });

      if (uniqueProjectIds.length > 0) {
        await tx.reportProject.createMany({
          data: uniqueProjectIds.map((pid, i) => ({
            reportId: created.id,
            projectId: pid,
            position: i,
          })),
          // Belt-and-suspenders against any upstream dedup miss.
          skipDuplicates: true,
        });
      }

      return tx.insightReport.findUnique({
        where: { id: created.id },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          reportProjects: {
            where: { hidden: false },
            orderBy: { position: "asc" },
            include: { project: true },
          },
        },
      });
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    if (error instanceof UnownedProjectError) {
      return NextResponse.json(
        { error: "One or more projectIds are not owned by the current user" },
        { status: 400 },
      );
    }
    console.error("POST /api/insights error:", error);
    return NextResponse.json(
      { error: "Failed to create insight" },
      { status: 500 },
    );
  }
}

/** Sentinel error raised from inside the POST /api/insights
 * transaction when a caller references projectIds they don't own.
 * Thrown inside the transaction so it rolls back cleanly; converted
 * to a 400 by the catch block above. */
class UnownedProjectError extends Error {
  constructor() {
    super("Unowned project");
    this.name = "UnownedProjectError";
  }
}
