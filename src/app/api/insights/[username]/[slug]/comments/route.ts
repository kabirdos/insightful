import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; slug: string }> },
) {
  try {
    const { username, slug } = await params;

    const report = await prisma.insightReport.findFirst({
      where: { slug, author: { username } },
      select: { id: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    // Fetch top-level comments with one level of replies
    const comments = await prisma.comment.findMany({
      where: {
        reportId: report.id,
        parentId: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replies: {
          orderBy: { createdAt: "asc" },
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
        },
      },
    });

    return NextResponse.json({ data: comments });
  } catch (error) {
    console.error("GET /api/insights/[slug]/comments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 },
    );
  }
}

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
    const body = await request.json();
    const { body: commentBody, sectionKey, parentId } = body;

    if (
      !commentBody ||
      typeof commentBody !== "string" ||
      !commentBody.trim()
    ) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 },
      );
    }

    const report = await prisma.insightReport.findFirst({
      where: { slug, author: { username } },
      select: { id: true },
    });

    if (!report) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    // Validate parent exists and belongs to this report (1 level nesting only)
    if (parentId) {
      const parent = await prisma.comment.findFirst({
        where: {
          id: parentId,
          reportId: report.id,
          parentId: null, // Only allow replying to top-level comments
        },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent comment not found or nesting too deep" },
          { status: 400 },
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        authorId: session.user.id,
        reportId: report.id,
        body: commentBody.trim(),
        sectionKey: sectionKey ?? null,
        parentId: parentId ?? null,
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

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/insights/[slug]/comments error:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 },
    );
  }
}
