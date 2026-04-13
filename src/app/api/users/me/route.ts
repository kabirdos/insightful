import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizeSetup } from "@/lib/profile-setup-normalize";

const URL_FIELDS = [
  "githubUrl",
  "twitterUrl",
  "linkedinUrl",
  "websiteUrl",
] as const;

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  githubUrl: true,
  twitterUrl: true,
  linkedinUrl: true,
  websiteUrl: true,
  setup: true,
} as const;

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
      select: USER_SELECT,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Pass `setup` as both `raw` and `prevStored` so a well-formed stored
    // blob preserves its persisted `setupUpdatedAt` on every read (plan §5).
    return NextResponse.json({
      data: { ...user, setup: normalizeSetup(user.setup, user.setup) },
    });
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

    // Widened from `Record<string, string | null>` so `setup` (Json | DbNull)
    // can land in the same accumulator.
    const updateData: Prisma.UserUpdateInput = {};

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

    // Accept `setup` as an object (fields to set), explicit `null` (clear), or
    // omitted (leave alone). normalizeSetup collapses empty-user-fields to
    // null too. Prisma null handling: use `Prisma.DbNull` to store SQL NULL.
    // `Prisma.JsonNull` would persist a JSON null literal, which is NOT what
    // we want. See plan §5 and
    // https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields#using-null-values
    let setupProvided = false;
    if (body.setup !== undefined) {
      setupProvided = true;
      const prevStored = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { setup: true },
      });
      const normalized = normalizeSetup(body.setup, prevStored?.setup ?? null);
      updateData.setup =
        normalized === null
          ? Prisma.DbNull
          : (normalized as unknown as Prisma.InputJsonValue);
    }

    if (Object.keys(updateData).length === 0 && !setupProvided) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: USER_SELECT,
    });

    return NextResponse.json({
      data: { ...user, setup: normalizeSetup(user.setup, user.setup) },
    });
  } catch (error) {
    console.error("PUT /api/users/me error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
