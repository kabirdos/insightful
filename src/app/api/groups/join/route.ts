/**
 * Group join endpoints (plan "API surface", D5).
 *
 * POST /api/groups/join — session required. Body `{ token }`. Validates
 *   the invite (exists, not revoked, not expired) and upserts membership.
 *   - Invalid token → 404.
 *   - Revoked or expired → 410.
 *   - Already a member → 200 `{ alreadyMember: true }` (usedCount NOT
 *     incremented — a re-click shouldn't inflate the counter).
 *   - New member → membership created + `usedCount` incremented in one
 *     transaction → 200 `{ alreadyMember: false }`.
 *
 * GET /api/groups/join?token=... — public PREVIEW, no auth. Returns the
 *   group NAME + member count so the signed-out join page can render
 *   before the GitHub round-trip. Invalid/expired/revoked → 200
 *   `{ valid: false }` (no extra existence leak — the token holder
 *   already has the link).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const joinSchema = z.object({
  token: z.string().min(1),
});

/** True when an invite is currently usable (not revoked, not expired). */
function inviteIsActive(invite: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}): boolean {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return false;
  }
  return true;
}

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

    const parsed = joinSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const invite = await prisma.groupInvite.findUnique({
      where: { token: parsed.data.token },
      include: { group: { select: { id: true, slug: true, name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (!inviteIsActive(invite)) {
      return NextResponse.json(
        { error: "Invite expired or revoked" },
        { status: 410 },
      );
    }

    // Fast path: already a member. Return success without touching
    // usedCount so repeated link-clicks don't inflate the counter.
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: invite.group.id, userId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({
        group: { slug: invite.group.slug, name: invite.group.name },
        alreadyMember: true,
      });
    }

    // New membership: create + increment usedCount atomically. A
    // concurrent join racing past the `existing` check trips the
    // unique [groupId, userId] constraint inside the transaction —
    // caught below and reported as alreadyMember without double-counting.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.groupMember.create({
          data: { groupId: invite.group.id, userId, role: "member" },
        });
        await tx.groupInvite.update({
          where: { id: invite.id },
          data: { usedCount: { increment: 1 } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json({
          group: { slug: invite.group.slug, name: invite.group.name },
          alreadyMember: true,
        });
      }
      throw error;
    }

    return NextResponse.json({
      group: { slug: invite.group.slug, name: invite.group.name },
      alreadyMember: false,
    });
  } catch (error) {
    console.error("POST /api/groups/join error:", error);
    return NextResponse.json(
      { error: "Failed to join group" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json({ valid: false });
    }

    const invite = await prisma.groupInvite.findUnique({
      where: { token },
      select: {
        revokedAt: true,
        expiresAt: true,
        group: {
          select: {
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    if (!invite || !inviteIsActive(invite)) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      group: {
        name: invite.group.name,
        memberCount: invite.group._count.members,
      },
    });
  } catch (error) {
    console.error("GET /api/groups/join error:", error);
    return NextResponse.json(
      { error: "Failed to preview invite" },
      { status: 500 },
    );
  }
}
