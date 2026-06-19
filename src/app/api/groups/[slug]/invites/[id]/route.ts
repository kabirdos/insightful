/**
 * Group invite revoke endpoint (plan "API surface", D5).
 *
 * DELETE /api/groups/[slug]/invites/[id] — owner only. Sets `revokedAt`
 * so the invite stops working immediately (the join path treats a
 * revoked invite as gone). 404 when the invite id doesn't belong to this
 * group — including when it belongs to a different group — so a member
 * can't probe invite ids across groups.
 *
 * Idempotent: revoking an already-revoked invite returns `{ ok: true }`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGroupMembership } from "@/lib/group-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const { slug, id } = await params;
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

    // Scope the revoke to this group's invites. An id that exists but
    // belongs to a different group matches zero rows here → 404, so
    // cross-group invite ids stay opaque.
    const result = await prisma.groupInvite.updateMany({
      where: { id, groupId: membership.groupId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      // Either the invite doesn't exist in this group, or it's already
      // revoked. Distinguish so a double-revoke is idempotent (ok) while
      // a missing/foreign id is 404.
      const exists = await prisma.groupInvite.findFirst({
        where: { id, groupId: membership.groupId },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json(
          { error: "Invite not found" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/groups/[slug]/invites/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to revoke invite" },
      { status: 500 },
    );
  }
}
