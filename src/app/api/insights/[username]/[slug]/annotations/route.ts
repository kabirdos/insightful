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
  { params }: { params: Promise<{ username: string; slug: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username, slug } = await params;

    const report = await prisma.insightReport.findFirst({
      where: { slug, author: { username } },
      select: { id: true, authorId: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    if (report.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { sectionKey, body: annotationBody } = body;

    if (!sectionKey || !SECTION_KEYS.includes(sectionKey)) {
      return NextResponse.json(
        { error: "Invalid sectionKey" },
        { status: 400 },
      );
    }

    if (
      !annotationBody ||
      typeof annotationBody !== "string" ||
      !annotationBody.trim()
    ) {
      return NextResponse.json(
        { error: "Annotation body is required" },
        { status: 400 },
      );
    }

    const annotation = await prisma.authorAnnotation.upsert({
      where: {
        reportId_sectionKey: {
          reportId: report.id,
          sectionKey,
        },
      },
      create: {
        reportId: report.id,
        sectionKey,
        body: annotationBody.trim(),
      },
      update: {
        body: annotationBody.trim(),
      },
    });

    return NextResponse.json({ data: annotation });
  } catch (error) {
    console.error("POST /api/insights/[slug]/annotations error:", error);
    return NextResponse.json(
      { error: "Failed to save annotation" },
      { status: 500 },
    );
  }
}
