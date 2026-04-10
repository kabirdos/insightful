import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { fetchLinkPreview } from "@/lib/link-preview";

/**
 * POST /api/projects/[id]/refresh-metadata
 * Re-fetches OG metadata for a Project's liveUrl and persists the
 * result (or clears the cached fields if the fetch fails). No body.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.project.findUnique({
      where: { id },
      select: { id: true, userId: true, liveUrl: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Clear cached metadata up-front so a failed fetch leaves null
    // fields rather than stale data. Matches the pattern in PATCH.
    await prisma.project.update({
      where: { id },
      data: {
        ogImage: null,
        ogTitle: null,
        ogDescription: null,
        favicon: null,
        siteName: null,
        metadataFetchedAt: null,
      },
    });

    if (existing.liveUrl) {
      const fetchedUrl = existing.liveUrl;
      const metadata = await fetchLinkPreview(fetchedUrl);
      if (metadata) {
        // Race-safety: only write if liveUrl hasn't changed since the
        // fetch started. If a concurrent PATCH edited liveUrl mid-flight,
        // updateMany affects 0 rows and the stale metadata is discarded.
        await prisma.project.updateMany({
          where: { id, liveUrl: fetchedUrl },
          data: {
            ogImage: metadata.ogImage,
            ogTitle: metadata.ogTitle,
            ogDescription: metadata.ogDescription,
            favicon: metadata.favicon,
            siteName: metadata.siteName,
            metadataFetchedAt: new Date(),
          },
        });
      }
    }

    const updated = await prisma.project.findUnique({ where: { id } });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("POST /api/projects/[id]/refresh-metadata error:", error);
    return NextResponse.json(
      { error: "Failed to refresh metadata" },
      { status: 500 },
    );
  }
}
