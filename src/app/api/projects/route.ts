import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { fetchLinkPreview } from "@/lib/link-preview";

/**
 * GET /api/projects
 * Returns the authenticated user's project library, newest-first.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: projects });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects
 * Creates a new Project in the authenticated user's library. If a
 * liveUrl is provided, synchronously fetches OG metadata and stores
 * it on the row before returning.
 *
 * Body: { name, description?, githubUrl?, liveUrl? }
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, githubUrl, liveUrl } = body;

    const validationError = validateProjectInput({
      name,
      description,
      githubUrl,
      liveUrl,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Fetch metadata if liveUrl is present. fetchLinkPreview never
    // throws — it returns null on any error (SSRF, timeout, 4xx, etc.).
    const metadata =
      liveUrl && typeof liveUrl === "string"
        ? await fetchLinkPreview(liveUrl)
        : null;

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: (name as string).trim(),
        description: typeof description === "string" ? description : null,
        githubUrl: typeof githubUrl === "string" ? githubUrl : null,
        liveUrl: typeof liveUrl === "string" ? liveUrl : null,
        ogImage: metadata?.ogImage ?? null,
        ogTitle: metadata?.ogTitle ?? null,
        ogDescription: metadata?.ogDescription ?? null,
        favicon: metadata?.favicon ?? null,
        siteName: metadata?.siteName ?? null,
        metadataFetchedAt: metadata ? new Date() : null,
      },
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}

/**
 * Validate project input fields. Returns an error message string, or
 * null if the input is valid. Matches the manual-validation style
 * used in the rest of the codebase (no zod).
 */
function validateProjectInput(input: {
  name: unknown;
  description: unknown;
  githubUrl: unknown;
  liveUrl: unknown;
}): string | null {
  const { name, description, githubUrl, liveUrl } = input;

  if (!name || typeof name !== "string" || !name.trim()) {
    return "Project name is required";
  }
  if (name.trim().length > 200) {
    return "Project name is too long (max 200 characters)";
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
