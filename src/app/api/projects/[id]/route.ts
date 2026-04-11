import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { fetchLinkPreview } from "@/lib/link-preview";

/**
 * PATCH /api/projects/[id]
 * Updates a Project in the authenticated user's library.
 *
 * If the liveUrl changes, the row's cached OG metadata fields are
 * atomically cleared BEFORE the new fetch runs so a failed refetch
 * cannot leave stale data from the previous URL.
 */
export async function PATCH(
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

    const body = await request.json();
    const { name, description, githubUrl, liveUrl } = body;

    const validationError = validatePartialProjectInput({
      name,
      description,
      githubUrl,
      liveUrl,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Determine whether the liveUrl is changing. Undefined means "not
    // in the PATCH body" (leave as-is); null or a new string means
    // "change it."
    const liveUrlChanging =
      liveUrl !== undefined && liveUrl !== existing.liveUrl;

    // Step 1: apply the user-supplied field changes, AND if liveUrl is
    // changing, clear all cached metadata at the same time. This
    // single update means a subsequent crash or failed fetch can't
    // leave stale metadata visible to the UI.
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = (name as string).trim();
    if (description !== undefined)
      updateData.description = description === "" ? null : description;
    if (githubUrl !== undefined)
      updateData.githubUrl = githubUrl === "" ? null : githubUrl;
    if (liveUrl !== undefined)
      updateData.liveUrl = liveUrl === "" ? null : liveUrl;

    if (liveUrlChanging) {
      updateData.ogImage = null;
      updateData.ogTitle = null;
      updateData.ogDescription = null;
      updateData.favicon = null;
      updateData.siteName = null;
      updateData.metadataFetchedAt = null;
    }

    await prisma.project.update({
      where: { id },
      data: updateData,
    });

    // Step 2: if liveUrl is changing and non-null, fetch new metadata
    // and write it. fetchLinkPreview never throws.
    //
    // Race-safety: the refill uses updateMany with a compound where
    // clause { id, liveUrl: fetchedUrl }. If another concurrent
    // request has changed the liveUrl by the time our fetch resolves,
    // updateMany affects 0 rows and our stale metadata is silently
    // discarded — the newer URL's metadata (or null) is preserved.
    if (
      liveUrlChanging &&
      typeof liveUrl === "string" &&
      liveUrl.trim() !== ""
    ) {
      const fetchedUrl = liveUrl;
      const metadata = await fetchLinkPreview(fetchedUrl);
      if (metadata) {
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
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/projects/[id]
 * Deletes the Project. Cascades via the schema remove all
 * ReportProject junction rows so the project disappears from every
 * report that referenced it.
 */
export async function DELETE(
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
      select: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}

/** Partial validator for PATCH bodies — all fields are optional. */
function validatePartialProjectInput(input: {
  name: unknown;
  description: unknown;
  githubUrl: unknown;
  liveUrl: unknown;
}): string | null {
  const { name, description, githubUrl, liveUrl } = input;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return "Project name must be a non-empty string";
    }
    if (name.trim().length > 200) {
      return "Project name is too long (max 200 characters)";
    }
  }
  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return "Description must be a string";
    }
    if (description.length > 2000) {
      return "Description is too long (max 2000 characters)";
    }
  }
  if (githubUrl !== undefined && githubUrl !== null && githubUrl !== "") {
    if (typeof githubUrl !== "string" || !isValidHttpUrl(githubUrl)) {
      return "Invalid GitHub URL";
    }
  }
  if (liveUrl !== undefined && liveUrl !== null && liveUrl !== "") {
    if (typeof liveUrl !== "string" || !isValidHttpUrl(liveUrl)) {
      return "Invalid live URL";
    }
  }
  return null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
