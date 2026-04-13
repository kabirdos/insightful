/**
 * Reserved usernames blocked from signup because they would collide with
 * top-level app routes (or are reasonably reserved for future use).
 *
 * Match is case-insensitive. The list MUST be kept in sync with top-level
 * route segments under src/app/ — including route-group-flattened segments
 * like (auth)/login → /login. The drift-detection test in
 * src/lib/__tests__/reserved-usernames.test.ts walks the directory tree and
 * fails CI if any top-level public path lacks a matching entry here.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Currently present top-level routes
  "api",
  "insights",
  "search",
  "top",
  "u",
  "upload",
  "login",
  // Reasonable near-term reservations
  "settings",
  "logout",
  "signup",
  "about",
  "pricing",
  "admin",
  "dashboard",
  "docs",
  "blog",
  "help",
  "terms",
  "privacy",
  "welcome",
  "new",
]);

export function isReservedUsername(candidate: string): boolean {
  if (!candidate) return false;
  return RESERVED_USERNAMES.has(candidate.toLowerCase());
}
