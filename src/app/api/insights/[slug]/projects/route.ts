import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
    const { name, githubUrl, liveUrl, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    const projectLink = await prisma.projectLink.create({
      data: {
        reportId: report.id,
        name: name.trim(),
        githubUrl: githubUrl ?? null,
        liveUrl: liveUrl ?? null,
        description: description ?? null,
      },
    });

    return NextResponse.json({ data: projectLink }, { status: 201 });
  } catch (error) {
    console.error("POST /api/insights/[slug]/projects error:", error);
    return NextResponse.json(
      { error: "Failed to add project link" },
      { status: 500 },
    );
  }
}
