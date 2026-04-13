/**
 * Centralized URL builders for report and profile routes.
 *
 * Every internal link to a report or profile MUST go through these helpers
 * so future URL changes become a one-file edit.
 *
 * URL shape:
 *   profile        /{username}
 *   report         /insights/{username}/{slug}
 *   report edit    /insights/{username}/{slug}/edit
 *   report API     /api/insights/{username}/{slug}
 *   report sub-API /api/insights/{username}/{slug}/{subpath}
 *   OG image       /api/og/{username}/{slug}
 *
 * Path segments are passed through encodeURIComponent defensively. Usernames
 * are GitHub-validated upstream and slugs are generated server-side, but
 * defense-in-depth costs nothing here.
 */

function seg(value: string): string {
  return encodeURIComponent(value);
}

export function buildProfileUrl(username: string): string {
  return `/${seg(username)}`;
}

export function buildReportUrl(username: string, slug: string): string {
  return `/insights/${seg(username)}/${seg(slug)}`;
}

export function buildReportEditUrl(username: string, slug: string): string {
  return `${buildReportUrl(username, slug)}/edit`;
}

export function buildReportApiUrl(username: string, slug: string): string {
  return `/api/insights/${seg(username)}/${seg(slug)}`;
}

export function buildReportSubResourceApiUrl(
  username: string,
  slug: string,
  subpath: string,
): string {
  // subpath may contain slashes (e.g. "projects/abc123") — split and encode each piece
  const subSegments = subpath.split("/").filter(Boolean).map(seg).join("/");
  return `${buildReportApiUrl(username, slug)}/${subSegments}`;
}

export function buildOgImageUrl(username: string, slug: string): string {
  return `/api/og/${seg(username)}/${seg(slug)}`;
}
