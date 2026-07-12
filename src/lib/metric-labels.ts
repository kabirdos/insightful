/**
 * Canonical metric label vocabulary — the single source of truth for the
 * WORD each stat is called across every surface (homepage cards, the
 * leaderboard, /top, group pages, snapshot cards).
 *
 * WHY THIS EXISTS: the same metric used to carry a different label per
 * surface — "tokens / wk" vs "tokens/wk", "Most Tokens" vs "tokens", and a
 * stray "Features Used" where every other surface says "Skills". Sourcing
 * every stat label from this module keeps the vocabulary identical so the
 * product reads as one coherent thing (UX audit rec #7).
 *
 * RULE: every stat surface MUST import its labels from here. Do NOT hard-code
 * a metric label string in a component — add or reuse an entry below.
 *
 * The base noun is lowercase (the canonical WORD). Surfaces that visually
 * uppercase via CSS render it identically regardless of source case, so:
 *   - lowercase per-week strips (homepage, /top, group) use `perWeekLabel`
 *     or the raw `METRIC_LABELS` noun,
 *   - standalone capitalized stat labels use `statLabel`,
 *   - "Most X" sort options use `sortLabel`.
 *
 * `active` covers the active-days / active-hours duration metric.
 */
export const METRIC_LABELS = {
  tokens: "tokens",
  apiCost: "api cost",
  sessions: "sessions",
  active: "active",
  commits: "commits",
  prs: "PRs",
  skills: "skills",
  messages: "messages",
  files: "files",
  lines: "lines",
  linesAdded: "added",
  linesRemoved: "removed",
} as const;

export type MetricKey = keyof typeof METRIC_LABELS;

/** Lifetime-token hero label, shared by every card that shows it. */
export const LIFETIME_TOKENS_LABEL = "lifetime tokens";

/**
 * The canonical per-week suffix: `"tokens / wk"` (spaces around the slash).
 * Used by the homepage vanity strip, the /top cards, and group member cards.
 */
export function perWeekLabel(metric: MetricKey): string {
  return `${METRIC_LABELS[metric]} / wk`;
}

/**
 * Capitalized standalone stat label, e.g. `"Sessions"`, `"Commits"`,
 * `"Skills"`. Preserves acronyms already carrying an uppercase letter
 * (`"PRs"`). Used where a stat label reads as a title-cased word
 * (snapshot cards, leaderboard columns).
 */
export function statLabel(metric: MetricKey): string {
  const noun = METRIC_LABELS[metric];
  if (/[A-Z]/.test(noun)) return noun;
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

/** `"Most Tokens"` — the /top sort-option label built from the canonical noun. */
export function sortLabel(metric: MetricKey): string {
  return `Most ${statLabel(metric)}`;
}
