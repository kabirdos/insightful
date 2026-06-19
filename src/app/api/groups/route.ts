/**
 * Group collection endpoints (plan "API surface").
 *
 * POST /api/groups — create a group. Session required. Body
 *   `{ name, slug? }`. Slug is the provided value (validated) or one
 *   derived from the name. Reserved/invalid slugs 400; an existing slug
 *   409s. The creator is inserted as the sole `owner` member in the
 *   same transaction as the group create so a group never exists without
 *   an owner.
 *
 * GET /api/groups — list the groups the caller belongs to, each with a
 *   member count and the caller's own role. Session required.
 *
 * Auth is NextAuth session only (no bearer): creating/listing a user's
 * own groups is a browser action, mirroring /api/harness-tokens.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  isReservedGroupSlug,
  isValidGroupSlug,
  slugifyGroupName,
  GROUP_SLUG_MIN_LENGTH,
  GROUP_SLUG_MAX_LENGTH,
} from "@/lib/group-auth";

const createGroupSchema = z.object({
  name: z.string().min(1).max(60),
  slug: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const parsed = createGroupSchema.safeParse(rawBody);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const field = first.path.join(".") || "(root)";
      return NextResponse.json(
        { error: `Invalid request body: ${field} — ${first.message}` },
        { status: 400 },
      );
    }

    const name = parsed.data.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: "name must not be blank" },
        { status: 400 },
      );
    }

    // Slug: explicit value wins; otherwise derive from the name. Both
    // paths run through the same shape + reserved checks so an awkward
    // name (symbols only, too long) yields a clear 400 rather than a
    // mangled slug.
    const slug = parsed.data.slug
      ? parsed.data.slug.trim().toLowerCase()
      : slugifyGroupName(name);

    if (isReservedGroupSlug(slug)) {
      return NextResponse.json(
        { error: `Slug "${slug}" is reserved` },
        { status: 400 },
      );
    }
    if (!isValidGroupSlug(slug)) {
      return NextResponse.json(
        {
          error: `Invalid slug "${slug}" — must be ${GROUP_SLUG_MIN_LENGTH}–${GROUP_SLUG_MAX_LENGTH} lowercase letters, numbers, and dashes`,
        },
        { status: 400 },
      );
    }

    try {
      const group = await prisma.$transaction(async (tx) => {
        const created = await tx.group.create({
          data: {
            slug,
            name,
            createdById: userId,
          },
        });
        await tx.groupMember.create({
          data: {
            groupId: created.id,
            userId,
            role: "owner",
          },
        });
        return created;
      });

      return NextResponse.json({ group }, { status: 201 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: `Slug "${slug}" is already taken` },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("POST /api/groups error:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      orderBy: { joinedAt: "asc" },
      select: {
        role: true,
        group: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            createdAt: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    const groups = memberships.map((m) => ({
      id: m.group.id,
      slug: m.group.slug,
      name: m.group.name,
      description: m.group.description,
      createdAt: m.group.createdAt,
      memberCount: m.group._count.members,
      role: m.role,
    }));

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("GET /api/groups error:", error);
    return NextResponse.json(
      { error: "Failed to list groups" },
      { status: 500 },
    );
  }
}
