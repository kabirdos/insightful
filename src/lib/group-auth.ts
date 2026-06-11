/**
 * Shared helpers for the group-sharing API routes.
 *
 * Membership lookups (`getGroupMembership`, `requireGroupOwner`) accept
 * EITHER a group id OR a slug — the routes resolve groups by slug, but
 * the data-layer keys on group id, so we let callers pass whichever they
 * already hold and disambiguate by a `{ by: "id" | "slug" }` flag.
 *
 * Slug validation mirrors the username rules in
 * `src/lib/reserved-usernames.ts`: a small reserved list that would
 * collide with first-class `/g/...` routes (or app-level paths), plus a
 * shape check. `slugifyGroupName` is the auto-slug used when a creator
 * doesn't supply one explicitly.
 */
import { prisma } from "@/lib/db";

/**
 * Slugs blocked from group creation because they collide with planned
 * `/g/<slug>` sub-routes (`join`, `invite`) or general app namespaces.
 * Match is case-insensitive — slugs are lowercased before the check.
 */
export const GROUP_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "join",
  "new",
  "api",
  "admin",
  "settings",
  "invite",
  "groups",
]);

export const GROUP_SLUG_MIN_LENGTH = 3;
export const GROUP_SLUG_MAX_LENGTH = 40;

/**
 * Shape check for a group slug: lowercase, `[a-z0-9-]`, no leading or
 * trailing dash, length within bounds. Does NOT consult the reserved
 * list — callers compose `isValidGroupSlug(s) && !isReservedGroupSlug(s)`
 * (or check reserved separately to emit a distinct error message).
 */
export function isValidGroupSlug(slug: string): boolean {
  if (typeof slug !== "string") return false;
  if (slug.length < GROUP_SLUG_MIN_LENGTH) return false;
  if (slug.length > GROUP_SLUG_MAX_LENGTH) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function isReservedGroupSlug(slug: string): boolean {
  if (!slug) return false;
  return GROUP_RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Derive a slug from a free-text group name: lowercase, replace any run
 * of non-`[a-z0-9]` with a single dash, trim leading/trailing dashes.
 * The result is NOT guaranteed valid (e.g. a name of all symbols yields
 * an empty string, a very long name overflows 40 chars) — callers must
 * still run `isValidGroupSlug` on the output and surface a 400 when the
 * derived slug fails. Returns the (possibly invalid) candidate so the
 * caller can include it in the error.
 */
export function slugifyGroupName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Minimal membership row returned by the lookup helpers. */
export interface GroupMembershipRow {
  id: string;
  groupId: string;
  userId: string;
  role: string;
}

interface GroupRef {
  /** Whether `value` is a group id or a slug. Defaults to "slug". */
  by?: "id" | "slug";
  value: string;
}

function normalizeRef(ref: GroupRef | string): GroupRef {
  if (typeof ref === "string") return { by: "slug", value: ref };
  return { by: ref.by ?? "slug", value: ref.value };
}

/**
 * Resolve the caller's membership in a group, or null when the group
 * doesn't exist or the caller isn't a member. Non-membership and
 * non-existence are deliberately indistinguishable to the caller so
 * routes can 404 without leaking group existence (plan D6).
 */
export async function getGroupMembership(
  group: GroupRef | string,
  userId: string,
): Promise<GroupMembershipRow | null> {
  const ref = normalizeRef(group);
  const groupId =
    ref.by === "id" ? ref.value : await resolveGroupIdBySlug(ref.value);
  if (!groupId) return null;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true, groupId: true, userId: true, role: true },
  });
  return membership;
}

/**
 * Resolve the caller's OWNER membership in a group, or null when the
 * group doesn't exist, the caller isn't a member, or the caller is a
 * non-owner member. Routes translate null to 404 for non-members and
 * 403 for non-owner members — so they call `getGroupMembership` first
 * to tell the two apart. This helper is the convenience path when a
 * route only cares "am I the owner".
 */
export async function requireGroupOwner(
  group: GroupRef | string,
  userId: string,
): Promise<GroupMembershipRow | null> {
  const membership = await getGroupMembership(group, userId);
  if (!membership || membership.role !== "owner") return null;
  return membership;
}

async function resolveGroupIdBySlug(slug: string): Promise<string | null> {
  const group = await prisma.group.findUnique({
    where: { slug },
    select: { id: true },
  });
  return group?.id ?? null;
}
