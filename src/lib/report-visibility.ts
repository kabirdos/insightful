/**
 * Report visibility helper (group sharing).
 *
 * Returns a Prisma WHERE fragment that hides reports a viewer is not
 * entitled to see. Supersedes the older draft-only filter
 * (`src/lib/draft-filter.ts`, kept as a deprecated alias): in addition
 * to hiding `isDraft: true` reports from non-authors, it restricts
 * `visibility: "group"` reports to members of the groups each report is
 * shared to, and hides any non-public report from anonymous viewers.
 *
 * Compose with the existing `where` via AND so the visibility filter is
 * the always-applied last guard at every read site:
 *   const where = {
 *     AND: [existingWhere, reportVisibilityClause(viewerId)],
 *   };
 *
 * For nested-relation reads (Prisma `include: { reports: { where } }`),
 * pass the helper directly.
 *
 * Global aggregate surfaces (homepage list, /top, leaderboard, search,
 * OG) pass `null` so they only ever expose strictly-public reports —
 * group reports never leak into cross-audience aggregates (plan D6).
 */
import type { Prisma } from "@prisma/client";

/**
 * Minimal slice of the Prisma client the publish-default resolver needs.
 * Accepts either the root client or a `$transaction` tx handle so the
 * group lookup can run inside the same transaction as the report create.
 */
interface GroupMemberReader {
  groupMember: {
    findMany(args: {
      where: { userId: string };
      select: { groupId: true };
    }): Promise<Array<{ groupId: string }>>;
  };
}

export interface PublishVisibilityDefault {
  visibility: "public" | "group";
  groupIds: string[];
}

/**
 * Publish-time visibility default (plan D3). When the author belongs to
 * at least one group, new reports default to `visibility: "group"` and
 * are shared to every group the author currently belongs to; with no
 * memberships the default stays `"public"`. Joining a group later never
 * retroactively exposes existing reports — shares are explicit rows.
 */
export async function resolvePublishVisibilityDefault(
  db: GroupMemberReader,
  authorId: string,
): Promise<PublishVisibilityDefault> {
  const memberships = await db.groupMember.findMany({
    where: { userId: authorId },
    select: { groupId: true },
  });
  if (memberships.length === 0) {
    return { visibility: "public", groupIds: [] };
  }
  return {
    visibility: "group",
    groupIds: memberships.map((m) => m.groupId),
  };
}

export function reportVisibilityClause(
  viewerId: string | null,
): Prisma.InsightReportWhereInput {
  const publicClause: Prisma.InsightReportWhereInput = {
    isDraft: false,
    visibility: "public",
  };
  if (!viewerId) {
    return publicClause;
  }
  return {
    OR: [
      publicClause,
      { authorId: viewerId },
      {
        isDraft: false,
        visibility: "group",
        groupShares: {
          some: { group: { members: { some: { userId: viewerId } } } },
        },
      },
    ],
  };
}
