/**
 * Draft visibility helper (R9, R9a, R11).
 *
 * Returns a Prisma WHERE fragment that hides `isDraft: true` reports
 * from non-owners. Compose with the existing `where` via AND so the
 * draft filter is the always-applied last guard at every read site.
 *
 * Usage:
 *   const where = {
 *     AND: [existingWhere, draftVisibilityClause(viewerId)],
 *   };
 *
 * For nested-relation reads (Prisma `include: { reports: { where } }`),
 * pass the helper directly — Prisma applies it to the relation's row
 * filter:
 *   include: { reports: { where: draftVisibilityClause(viewerId), ... } }
 *
 * Owner-scoped read paths (e.g. /api/users/me/setup-suggestions) are
 * exempt — the existing `where` already restricts to the caller's own
 * reports, and a non-owner cannot reach those rows by definition.
 * Owner-scoped sites should annotate their decision with a
 * `// owner-scoped: <reason>` comment instead of composing this helper.
 */
import type { Prisma } from "@prisma/client";

export function draftVisibilityClause(
  viewerId: string | null,
): Prisma.InsightReportWhereInput {
  if (viewerId) {
    return { OR: [{ isDraft: false }, { authorId: viewerId }] };
  }
  return { isDraft: false };
}
