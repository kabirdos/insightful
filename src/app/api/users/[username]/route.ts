import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        reports: {
          orderBy: { publishedAt: "desc" },
          select: {
            id: true,
            title: true,
            slug: true,
            publishedAt: true,
            sessionCount: true,
            messageCount: true,
            commitCount: true,
            dateRangeStart: true,
            dateRangeEnd: true,
            linesAdded: true,
            linesRemoved: true,
            fileCount: true,
            dayCount: true,
            msgsPerDay: true,
            atAGlance: true,
            _count: {
              select: {
                comments: true,
                votes: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const totalVotes = user.reports.reduce((sum, r) => sum + r._count.votes, 0);

    const reports = user.reports.map((r) => {
      const atAGlance = r.atAGlance as Record<string, string> | null;
      return {
        slug: r.slug,
        title: r.title,
        publishedAt: r.publishedAt,
        dateRangeStart: r.dateRangeStart,
        dateRangeEnd: r.dateRangeEnd,
        sessionCount: r.sessionCount,
        messageCount: r.messageCount,
        commitCount: r.commitCount,
        linesAdded: r.linesAdded,
        linesRemoved: r.linesRemoved,
        fileCount: r.fileCount,
        dayCount: r.dayCount,
        msgsPerDay: r.msgsPerDay,
        whatsWorkingPreview: atAGlance?.whats_working?.slice(0, 150) || null,
        voteCount: r._count.votes,
        commentCount: r._count.comments,
        sectionTags: [],
      };
    });

    return NextResponse.json({
      data: {
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt,
        totalReports: user.reports.length,
        totalVotes,
        reports,
      },
    });
  } catch (error) {
    console.error("GET /api/users/[username] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 },
    );
  }
}
