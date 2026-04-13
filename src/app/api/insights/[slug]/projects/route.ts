import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * POST /api/insights/[slug]/projects
 *
 * Attach one or more existing library Projects to an existing report.
 * Used by the report edit page to add a Project to a report after it
 * has been published. (The initial publish flow uses POST /api/insights
 * with projectIds inline in the same transaction.)
 *
 * Body: { projectIds: string[] }
 * Both the projects and the report must be owned by the current user.
 */
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

    const report = await prisma.insightReport.findFirst({
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
    const { projectIds } = body;

    if (!Array.isArray(projectIds)) {
      return NextResponse.json(
        { error: "projectIds must be an array" },
        { status: 400 },
      );
    }

    if (projectIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Verify ownership of every project in the batch.
    const owned = await prisma.project.findMany({
      where: {
        id: { in: projectIds as string[] },
        userId: session.user.id,
      },
      select: { id: true },
    });
    if (owned.length !== (projectIds as string[]).length) {
      return NextResponse.json(
        { error: "One or more projects not owned by the current user" },
        { status: 400 },
      );
    }

    // Determine the starting position for the new junction rows so
    // they get stable ordering after any existing attachments.
    const max = await prisma.reportProject.aggregate({
      where: { reportId: report.id },
      _max: { position: true },
    });
    const startPos = (max._max.position ?? -1) + 1;

    // Use createMany with skipDuplicates so hitting the unique
    // constraint on (reportId, projectId) is a no-op rather than an
    // error. The 409 Conflict semantics aren't surfaced in the spec
    // because the caller's intent is "make sure these are attached,"
    // which is idempotent.
    await prisma.reportProject.createMany({
      data: (projectIds as string[]).map((projectId, i) => ({
        reportId: report.id,
        projectId,
        position: startPos + i,
      })),
      skipDuplicates: true,
    });

    const created = await prisma.reportProject.findMany({
      where: {
        reportId: report.id,
        projectId: { in: projectIds as string[] },
      },
      include: { project: true },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/insights/[slug]/projects error:", error);
    return NextResponse.json(
      { error: "Failed to attach projects" },
      { status: 500 },
    );
  }
}
