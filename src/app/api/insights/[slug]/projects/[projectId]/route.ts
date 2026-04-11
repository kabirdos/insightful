import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * PATCH /api/insights/[slug]/projects/[projectId]
 *
 * Toggles the `hidden` flag on a ReportProject junction row. Only the
 * report's author can call this. Body: { hidden: boolean }.
 *
 * Note: there is deliberately no DELETE handler for this path. The UI
 * exposes only two actions — "hide from this report" (this PATCH) and
 * "delete from library" (DELETE /api/projects/[id]) — per the locked
 * design decision. A detach-only endpoint would be confusing.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; projectId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, projectId } = await params;

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

    const junction = await prisma.reportProject.findUnique({
      where: {
        reportId_projectId: {
          reportId: report.id,
          projectId,
        },
      },
    });

    if (!junction) {
      return NextResponse.json(
        { error: "Project is not attached to this report" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { hidden } = body;

    if (typeof hidden !== "boolean") {
      return NextResponse.json(
        { error: "hidden must be a boolean" },
        { status: 400 },
      );
    }

    const updated = await prisma.reportProject.update({
      where: {
        reportId_projectId: {
          reportId: report.id,
          projectId,
        },
      },
      data: { hidden },
      include: { project: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error(
      "PATCH /api/insights/[slug]/projects/[projectId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to update project attachment" },
      { status: 500 },
    );
  }
}
