import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { RESERVED_USERNAMES, isReservedUsername } from "../reserved-usernames";

describe("isReservedUsername", () => {
  it("returns false for ordinary usernames", () => {
    expect(isReservedUsername("craig")).toBe(false);
    expect(isReservedUsername("alice123")).toBe(false);
  });

  it("returns true for reserved names", () => {
    expect(isReservedUsername("api")).toBe(true);
    expect(isReservedUsername("insights")).toBe(true);
    expect(isReservedUsername("upload")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isReservedUsername("API")).toBe(true);
    expect(isReservedUsername("Insights")).toBe(true);
    expect(isReservedUsername("UPLOAD")).toBe(true);
  });

  it("returns false for empty/whitespace input", () => {
    expect(isReservedUsername("")).toBe(false);
  });
});

/**
 * Drift-detection test.
 *
 * Walks src/app/ and asserts that every top-level public route segment has a
 * matching entry in RESERVED_USERNAMES. A future contributor adding a new
 * top-level route (e.g. src/app/dashboard/page.tsx) without updating the
 * reserved list will fail this test in CI — preventing collisions with the
 * root-level /[username] dynamic route.
 *
 * Rules for a "top-level public segment":
 * - Looks at first-level subdirectories of src/app/
 * - Strips Next.js route group wrappers like (auth) → recurse into them
 * - Excludes [dynamic] segments (those resolve dynamically; not relevant)
 * - Excludes the api/ tree (API routes don't conflict with /[username])
 *
 * This test is deliberately simple — it does not handle catch-all routes,
 * private segments (_foo), or other Next.js conventions because we don't
 * use them today. Update if conventions change.
 */
describe("RESERVED_USERNAMES drift detection", () => {
  it("covers every top-level public route segment under src/app/", () => {
    const appDir = join(process.cwd(), "src", "app");
    const segments = collectTopLevelSegments(appDir);

    const missing: string[] = [];
    for (const segment of segments) {
      if (!isReservedUsername(segment)) {
        missing.push(segment);
      }
    }

    expect(
      missing,
      `These top-level segments under src/app/ are not in RESERVED_USERNAMES. ` +
        `Add them to src/lib/reserved-usernames.ts: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});

function collectTopLevelSegments(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out = new Set<string>();

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (!statSync(fullPath).isDirectory()) continue;

    // Skip API routes — they live under /api and don't collide with /[username]
    if (entry === "api") continue;

    // Skip dynamic segments — they resolve at runtime and don't reserve a name
    if (entry.startsWith("[") && entry.endsWith("]")) continue;

    // Route groups like (auth) are wrappers — recurse one level to find their public children
    if (entry.startsWith("(") && entry.endsWith(")")) {
      for (const child of readdirSync(fullPath)) {
        const childPath = join(fullPath, child);
        if (!statSync(childPath).isDirectory()) continue;
        if (child.startsWith("[") && child.endsWith("]")) continue;
        if (child.startsWith("(") && child.endsWith(")")) continue;
        out.add(child);
      }
      continue;
    }

    out.add(entry);
  }

  return [...out];
}
