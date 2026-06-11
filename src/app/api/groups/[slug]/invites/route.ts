/**
 * Group invite collection endpoints (plan "API surface", D5).
 *
 * POST /api/groups/[slug]/invites — owner only. Mint an invite. Token is
 *   32 hex chars (16 random bytes), default 30-day expiry (body
 *   `{ expiresInDays? }` 1–365 overrides). Returns
 *   `{ invite: { id, token, url, expiresAt } }` where `url` is the
 *   absolute `/g/join/<token>` join link.
 *
 * GET /api/groups/[slug]/invites — owner only. List ACTIVE invites
 *   (not revoked, not expired).
 *
 * Owner-only: non-members 404 (don't leak existence), non-owner members
 * 403. The `getGroupMembership` / `requireGroupOwner` split lets us tell
 * those two apart.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import * as crypto from "crypto";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGroupMembership } from "@/lib/group-auth";

const DEFAULT_EXPIRY_DAYS = 30;
const MIN_EXPIRY_DAYS = 1;
const MAX_EXPIRY_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const createInviteSchema = z.object({
  expiresInDays: z
    .number()
    .int()
    .min(MIN_EXPIRY_DAYS)
    .max(MAX_EXPIRY_DAYS)
    .optional(),
});

/** 16 random bytes → 32 lowercase hex chars (plan D5). */
function generateInviteToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Absolute join URL for an invite token. Prefers `AUTH_URL` (NextAuth's
 * canonical production origin) and falls back to the request origin for
 * dev / preview, matching src/app/api/upload/route.ts. `||` (not `??`)
 * so an empty-string env in CI falls through to the request origin.
 */
function buildJoinUrl(request: Request, token: string): string {
  const rawOrigin = process.env.AUTH_URL || new URL(request.url).origin;
  const origin = rawOrigin.replace(/\/$/, "");
  return `${origin}/g/join/${encodeURIComponent(token)}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const membership = await getGroupMembership(slug, userId);
    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (membership.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let expiresInDays = DEFAULT_EXPIRY_DAYS;
    // Body is optional — an empty POST mints a 30-day invite. Only parse
    // when a body is present; reject a malformed expiresInDays at 400.
    const text = await request.text();
    if (text.trim()) {
      let rawBody: unknown;
      try {
        rawBody = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { error: "Request body must be valid JSON" },
          { status: 400 },
        );
      }
      const parsed = createInviteSchema.safeParse(rawBody);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        const field = first.path.join(".") || "(root)";
        return NextResponse.json(
          { error: `Invalid request body: ${field} — ${first.message}` },
          { status: 400 },
        );
      }
      if (parsed.data.expiresInDays !== undefined) {
        expiresInDays = parsed.data.expiresInDays;
      }
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + expiresInDays * DAY_MS);

    const invite = await prisma.groupInvite.create({
      data: {
        groupId: membership.groupId,
        token,
        createdById: userId,
        expiresAt,
      },
      select: { id: true, token: true, expiresAt: true },
    });

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          token: invite.token,
          url: buildJoinUrl(request, invite.token),
          expiresAt: invite.expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/groups/[slug]/invites error:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const membership = await getGroupMembership(slug, userId);
    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (membership.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const invites = await prisma.groupInvite.findMany({
      where: {
        groupId: membership.groupId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        usedCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      invites: invites.map((inv) => ({
        id: inv.id,
        token: inv.token,
        url: buildJoinUrl(request, inv.token),
        expiresAt: inv.expiresAt,
        usedCount: inv.usedCount,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/groups/[slug]/invites error:", error);
    return NextResponse.json(
      { error: "Failed to list invites" },
      { status: 500 },
    );
  }
}
