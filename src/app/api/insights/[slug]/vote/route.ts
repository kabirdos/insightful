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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();
    const { sectionKey } = body;

    if (!sectionKey || !SECTION_KEYS.includes(sectionKey)) {
      return NextResponse.json(
        { error: "Invalid sectionKey" },
        { status: 400 },
      );
    }

    const report = await prisma.insightReport.findFirst({
      where: { slug },
      select: { id: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    // Upsert to avoid duplicate errors
    await prisma.sectionVote.upsert({
      where: {
        userId_reportId_sectionKey: {
          userId: session.user.id,
          reportId: report.id,
          sectionKey,
        },
      },
      create: {
        userId: session.user.id,
        reportId: report.id,
        sectionKey,
      },
      update: {},
    });

    const voteCount = await prisma.sectionVote.count({
      where: { reportId: report.id, sectionKey },
    });

    return NextResponse.json({ data: { sectionKey, voteCount } });
  } catch (error) {
    console.error("POST /api/insights/[slug]/vote error:", error);
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
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
    const body = await request.json();
    const { sectionKey } = body;

    if (!sectionKey || !SECTION_KEYS.includes(sectionKey)) {
      return NextResponse.json(
        { error: "Invalid sectionKey" },
        { status: 400 },
      );
    }

    const report = await prisma.insightReport.findFirst({
      where: { slug },
      select: { id: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    await prisma.sectionVote.deleteMany({
      where: {
        userId: session.user.id,
        reportId: report.id,
        sectionKey,
      },
    });

    const voteCount = await prisma.sectionVote.count({
      where: { reportId: report.id, sectionKey },
    });

    return NextResponse.json({ data: { sectionKey, voteCount } });
  } catch (error) {
    console.error("DELETE /api/insights/[slug]/vote error:", error);
    return NextResponse.json(
      { error: "Failed to remove vote" },
      { status: 500 },
    );
  }
}
