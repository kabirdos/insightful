import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const URL_FIELDS = [
  "githubUrl",
  "twitterUrl",
  "linkedinUrl",
  "websiteUrl",
] as const;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        githubUrl: true,
        twitterUrl: true,
        linkedinUrl: true,
        websiteUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("GET /api/users/me error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, bio } = body;

    const updateData: Record<string, string | null> = {};

    if (displayName !== undefined) {
      updateData.displayName =
        typeof displayName === "string" && displayName.trim()
          ? displayName.trim()
          : null;
    }

    if (bio !== undefined) {
      updateData.bio =
        typeof bio === "string" && bio.trim() ? bio.trim() : null;
    }

    for (const field of URL_FIELDS) {
      if (body[field] !== undefined) {
        const val = body[field];
        if (val === null || val === "") {
          updateData[field] = null;
        } else if (typeof val === "string" && isValidUrl(val.trim())) {
          updateData[field] = val.trim();
        } else {
          return NextResponse.json(
            { error: `Invalid URL for ${field}` },
            { status: 400 },
          );
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        githubUrl: true,
        twitterUrl: true,
        linkedinUrl: true,
        websiteUrl: true,
      },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error("PUT /api/users/me error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
