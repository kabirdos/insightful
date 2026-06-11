/**
 * Group detail endpoint (plan "API surface", D6).
 *
 * GET /api/groups/[slug] — member-only detail. Returns the group, the
 * caller's role, and the member list. Each member carries their latest
 * report that is VISIBLE TO THE VIEWER (public, the member's own when the
 * viewer is the member, or a group-shared report in a group the viewer
 * belongs to) — `reportVisibilityClause(viewerId)` is the single source
 * of truth, so a member's private/unshared reports never leak.
 *
 * Non-members (and anonymous, since membership requires a session) get a
 * 404-shaped `{ error: "Group not found" }` — we do not confirm the
 * group exists to anyone who isn't in it (plan D6).
 *
 * The agent-payload content negotiation (D8) is intentionally a separate
 * task and not handled here.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGroupMembership } from "@/lib/group-auth";
import { reportVisibilityClause } from "@/lib/report-visibility";

/**
 * Scalar slice of each member's latest visible report surfaced on the
 * group page. Kept narrow on purpose — the comparison grid only needs
 * vanity stats + a link, not full narrative sections or harnessData.
 */
const LATEST_REPORT_SELECT = {
  slug: true,
  title: true,
  reportType: true,
  totalTokens: true,
  sessionCount: true,
  commitCount: true,
  durationHours: true,
  avgSessionMinutes: true,
  prCount: true,
  autonomyLabel: true,
  detectedSkills: true,
  dateRangeStart: true,
  dateRangeEnd: true,
  publishedAt: true,
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const session = await auth();
    const viewerId = session?.user?.id ?? null;

    // Anonymous callers can't be members; treat as not-found rather than
    // 401 so we don't even confirm the group exists (D6).
    if (!viewerId) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const membership = await getGroupMembership(slug, viewerId);
    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const group = await prisma.group.findUnique({
      where: { slug },
      select: {
        slug: true,
        name: true,
        description: true,
        createdAt: true,
        _count: { select: { members: true } },
        members: {
          orderBy: { joinedAt: "asc" },
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // The membership lookup already proved the group exists, but the
    // row could vanish between the two reads; treat that as not-found.
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const visibility = reportVisibilityClause(viewerId);

    const members = await Promise.all(
      group.members.map(async (m) => {
        const latestReport = await prisma.insightReport.findFirst({
          where: { AND: [{ authorId: m.userId }, visibility] },
          orderBy: { publishedAt: "desc" },
          select: LATEST_REPORT_SELECT,
        });
        return {
          username: m.user.username,
          displayName: m.user.displayName,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt,
          latestReport,
        };
      }),
    );

    return NextResponse.json({
      group: {
        slug: group.slug,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt,
        memberCount: group._count.members,
      },
      viewerRole: membership.role,
      members,
    });
  } catch (error) {
    console.error("GET /api/groups/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch group" },
      { status: 500 },
    );
  }
}
