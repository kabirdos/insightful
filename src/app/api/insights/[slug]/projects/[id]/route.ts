import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, id } = await params;

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

    const projectLink = await prisma.projectLink.findFirst({
      where: { id, reportId: report.id },
    });

    if (!projectLink) {
      return NextResponse.json(
        { error: "Project link not found" },
        { status: 404 },
      );
    }

    await prisma.projectLink.delete({ where: { id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/insights/[slug]/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete project link" },
      { status: 500 },
    );
  }
}
