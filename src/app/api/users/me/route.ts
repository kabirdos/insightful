import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
