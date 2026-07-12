/**
 * Shared config + helpers for the "Where tokens went" section — the four
 * per-X token-spend donuts (repo / skill / tool / subagent).
 *
 * IMPORTANT time-window note baked into the copy below: these four maps are
 * 30-DAY figures from a JSONL scan, while perModelTokens (used only to pick a
 * pricing rate) is LIFETIME from stats-cache. They do NOT reconcile. Every
 * surfacing of this data must say "last 30 days" and must be honest that USD is
 * "estimated at your dominant model's rates".
 */
import type { HarnessData, HarnessModelTokenBreakdown } from "@/types/insights";

export type TokenBreakdownKey =
  "perRepoTokens" | "perSkillTokens" | "perToolTokens" | "perSubagentTokens";

export interface TokenBreakdownSpec {
  /** Field on HarnessData AND the visibility/section key (they're identical). */
  key: TokenBreakdownKey;
  /** Chart title. */
  title: string;
  /** Center-of-donut noun (e.g. "repos"). */
  unit: string;
}

/**
 * Ordered by user value (per the plan): repo → skill → tool → subagent. This
 * is also the render order and the order of the visibility toggles.
 */
export const TOKEN_BREAKDOWN_SPECS: readonly TokenBreakdownSpec[] = [
  { key: "perRepoTokens", title: "By repository", unit: "repos" },
  { key: "perSkillTokens", title: "By skill", unit: "skills" },
  { key: "perToolTokens", title: "By tool", unit: "tools" },
  { key: "perSubagentTokens", title: "By subagent", unit: "subagents" },
] as const;

export const TOKEN_SECTION_TITLE = "Where tokens went";
export const TOKEN_SECTION_WINDOW = "last 30 days";
/** Honest caveat: 30-day window + dominant-model rate approximation. */
export const TOKEN_SECTION_NOTE =
  "Token spend over the last 30 days. Dollar figures are estimated at your " +
  "dominant model's rates — subagents on smaller models may cost less. In " +
  "multi-tool turns, tokens are split proportionally across tools.";

export function isNonEmptyBreakdownMap(
  map: Record<string, HarnessModelTokenBreakdown> | null | undefined,
): boolean {
  return !!map && Object.keys(map).length > 0;
}

/**
 * True when at least one of the four maps has data — regardless of hidden
 * state. Used by owner-facing surfaces (upload preview, edit page) where hidden
 * toggles are still shown.
 */
export function hasAnyTokenBreakdown(harnessData: HarnessData): boolean {
  return TOKEN_BREAKDOWN_SPECS.some((spec) =>
    isNonEmptyBreakdownMap(harnessData[spec.key]),
  );
}

/**
 * True when at least one of the four maps has data AND is not hidden. Used by
 * the public detail page so an all-hidden section renders no empty chrome.
 */
export function hasVisibleTokenBreakdown(
  harnessData: HarnessData,
  hiddenSet: Set<string>,
): boolean {
  return TOKEN_BREAKDOWN_SPECS.some(
    (spec) =>
      isNonEmptyBreakdownMap(harnessData[spec.key]) && !hiddenSet.has(spec.key),
  );
}
