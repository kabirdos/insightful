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

    // Aggregate vote counts per section for each report
    const mapped = reports.map((report) => {
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
      results = scored
        .slice(skip, skip + limit)
        .map(({ _trendingVotes, _trendingScore, ...rest }) => rest);
    } else {
      results = mapped.map(({ _trendingVotes, ...rest }) => rest);
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
    } = body;

    // Auto-generate title if not provided
    const title =
      providedTitle ||
      `${user.username}'s Claude Code Insights - ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

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
        ...(Array.isArray(projectLinks) && projectLinks.length > 0
          ? {
              projectLinks: {
                create: projectLinks.map(
                  (link: {
                    name: string;
                    githubUrl?: string;
                    liveUrl?: string;
                    description?: string;
                  }) => ({
                    name: link.name,
                    githubUrl: link.githubUrl || null,
                    liveUrl: link.liveUrl || null,
                    description: link.description || null,
                  }),
                ),
              },
            }
          : {}),
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
        projectLinks: true,
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
