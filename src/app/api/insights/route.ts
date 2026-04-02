import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
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

function generateSlug(username: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const shortId = Math.random().toString(36).substring(2, 8);
  return `${username}-${date}-${shortId}`;
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

    let orderBy: Record<string, unknown>;
    switch (sort) {
      case "votes":
        // Sort by total vote count — use publishedAt as secondary
        orderBy = { votes: { _count: "desc" } };
        break;
      case "trending":
        // Recent reports with most votes — sort by publishedAt descending as proxy
        orderBy = { publishedAt: "desc" };
        break;
      case "newest":
      default:
        orderBy = { publishedAt: "desc" };
        break;
    }

    const reportsQuery = prisma.insightReport.findMany({
      skip,
      take: limit,
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
          select: { sectionKey: true },
        },
      },
    });
    const countQuery = prisma.insightReport.count();

    const [reports, total] = await Promise.all([reportsQuery, countQuery]);

    // Aggregate vote counts per section for each report
    const results = reports.map((report) => {
      const voteCounts: Record<string, number> = {};
      for (const key of SECTION_KEYS) {
        voteCounts[key] = report.votes.filter(
          (v: { sectionKey: string }) => v.sectionKey === key,
        ).length;
      }

      const { votes: _votes, ...rest } = report;
      return {
        ...rest,
        voteCounts,
      };
    });

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
      title,
      sessionCount,
      messageCount,
      commitCount,
      dateRangeStart,
      dateRangeEnd,
      atAGlance,
      interactionStyle,
      projectAreas,
      impressiveWorkflows,
      frictionAnalysis,
      suggestions,
      onTheHorizon,
      funEnding,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const slug = generateSlug(user.username);

    const report = await prisma.insightReport.create({
      data: {
        authorId: user.id,
        title,
        slug,
        sessionCount: sessionCount ?? null,
        messageCount: messageCount ?? null,
        commitCount: commitCount ?? null,
        dateRangeStart: dateRangeStart ?? null,
        dateRangeEnd: dateRangeEnd ?? null,
        atAGlance: atAGlance ?? undefined,
        interactionStyle: interactionStyle ?? undefined,
        projectAreas: projectAreas ?? undefined,
        impressiveWorkflows: impressiveWorkflows ?? undefined,
        frictionAnalysis: frictionAnalysis ?? undefined,
        suggestions: suggestions ?? undefined,
        onTheHorizon: onTheHorizon ?? undefined,
        funEnding: funEnding ?? undefined,
      },
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

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    console.error("POST /api/insights error:", error);
    return NextResponse.json(
      { error: "Failed to create insight" },
      { status: 500 },
    );
  }
}
