/**
 * Lines-of-code resolution helpers.
 *
 * Real harness reports (produced by the `insight-harness` upload pipeline)
 * leave the `linesAdded` / `linesRemoved` scalar columns on `InsightReport`
 * NULL, and stash the display value inside the JSON `harnessData` column at
 * `gitPatterns.linesAdded` as a compact string like `"44.0K"`. Demo/seeded
 * reports populate the scalar columns directly, so read-site consumers need
 * a unified resolver that prefers scalars and falls back to parsing the
 * harness string.
 *
 * See issues #24 (scalar read path), #29 (OG card origin of the parser),
 * and #35 (this shared extraction).
 */

/**
 * Parse a harness `gitPatterns.linesAdded` value into a numeric count.
 *
 * Accepts:
 *   - Numbers (returned as-is, if finite)
 *   - Strings with an optional K/M suffix: "44.0K", "1.2M", "44k", "1.2m"
 *   - Plain-number strings with thousands separators: "18,400", "44000"
 *
 * Returns `null` when the input is missing, empty, or unparseable so
 * callers can null-check cleanly instead of tripping on a sentinel `0`.
 */
export function parseHarnessLinesString(
  value: string | number | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;

  // Strict full-string match: one group of digits, optional single
  // decimal part, and an optional K/M suffix. Anything else (extra
  // letters, stray text like "44.0KB" or "18.4K lines", or multi-dot
  // inputs like "1.2.3K") is rejected so malformed harness JSON fails
  // closed as `null` instead of silently parsing a partial prefix.
  const match = trimmed.match(/^(\d+(?:\.\d+)?)([KkMm])?$/);
  if (!match) return null;

  const base = parseFloat(match[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return base * 1_000;
  if (suffix === "m") return base * 1_000_000;
  return base;
}

/**
 * Minimal shape of an `InsightReport` slice this resolver needs.
 * Deliberately structural so both Prisma rows and API DTOs match.
 */
export interface LinesOfCodeSource {
  linesAdded?: number | null;
  linesRemoved?: number | null;
  harnessData?: {
    gitPatterns?: {
      linesAdded?: string | number | null;
      // Harness reports don't currently ship a `linesRemoved` field in
      // gitPatterns, but we read it defensively so the resolver stays
      // symmetrical if the upload pipeline starts populating it.
      linesRemoved?: string | number | null;
    } | null;
  } | null;
}

/**
 * Resolve a report's total lines-added count, preferring the scalar
 * column when populated and falling back to the harness JSON string.
 *
 * Returns `null` when neither source has usable data so call sites can
 * cleanly hide the metric (per the #24 null-safe UX contract).
 */
export function resolveLinesAdded(report: LinesOfCodeSource): number | null {
  if (report.linesAdded != null) return report.linesAdded;
  const fallback = report.harnessData?.gitPatterns?.linesAdded;
  return parseHarnessLinesString(fallback);
}

/**
 * Resolve a report's total lines-removed count. Mirrors
 * {@link resolveLinesAdded}: prefers the scalar column, then the harness
 * JSON fallback, then `null`.
 *
 * Note: in practice the harness pipeline only ships `gitPatterns.linesAdded`
 * (total churn) so this fallback almost always returns `null` today. It's
 * wired anyway so demo reports with both scalars work identically to real
 * uploads, and so a future harness schema change that adds `linesRemoved`
 * flows through without another read-site edit.
 */
export function resolveLinesRemoved(report: LinesOfCodeSource): number | null {
  if (report.linesRemoved != null) return report.linesRemoved;
  const fallback = report.harnessData?.gitPatterns?.linesRemoved;
  return parseHarnessLinesString(fallback);
}
