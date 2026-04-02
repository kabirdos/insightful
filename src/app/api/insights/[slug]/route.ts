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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const report = await prisma.insightReport.findUnique({
      where: { slug },
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
        projectLinks: true,
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

    return NextResponse.json({
      data: {
        ...rest,
        voteCounts,
        userVotes,
        userHighlights,
      },
    });
  } catch (error) {
    console.error("GET /api/insights/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insight" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const report = await prisma.insightReport.findUnique({
      where: { slug },
      select: { id: true, authorId: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    if (report.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "title",
      "atAGlance",
      "interactionStyle",
      "projectAreas",
      "impressiveWorkflows",
      "frictionAnalysis",
      "suggestions",
      "onTheHorizon",
      "funEnding",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
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
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const report = await prisma.insightReport.findUnique({
      where: { slug },
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
