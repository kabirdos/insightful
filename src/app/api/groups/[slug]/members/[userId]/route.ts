/**
 * Group member removal endpoint (plan "API surface", D4).
 *
 * DELETE /api/groups/[slug]/members/[userId] — remove a member.
 *   - Any member may remove THEMSELVES (leave).
 *   - An owner may remove any OTHER member.
 *   - A non-owner removing someone else → 403.
 *   - The sole owner leaving → 400 (ownership transfer is out of scope;
 *     they must transfer or delete the group first).
 *
 * Non-members of the group get 404 (don't leak existence). Removing a
 * userId who isn't in the group → 404.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGroupMembership } from "@/lib/group-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> },
) {
  try {
    const { slug, userId: targetUserId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const callerId = session.user.id;

    const callerMembership = await getGroupMembership(slug, callerId);
    if (!callerMembership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const groupId = callerMembership.groupId;
    const isSelf = targetUserId === callerId;

    // Authorization: self-leave is always allowed; removing someone else
    // requires owner. (Non-owner removing other → 403.)
    if (!isSelf && callerMembership.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      select: { id: true, role: true },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Sole-owner guard: removing the last owner would orphan the group.
    // Ownership transfer is out of scope this round (plan D4), so block.
    // Applies whether the owner is leaving (isSelf) or — defensively —
    // being removed by some other path.
    if (targetMembership.role === "owner") {
      const ownerCount = await prisma.groupMember.count({
        where: { groupId, role: "owner" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Transfer ownership or delete the group first" },
          { status: 400 },
        );
      }
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/groups/[slug]/members/[userId] error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 },
    );
  }
}
