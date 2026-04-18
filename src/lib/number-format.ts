/**
 * Shared number-formatting helpers used across report renders,
 * cards, and the leaderboard. Before this util, 11 components
 * reimplemented K/M formatting inline — none of them knew about
 * billions, most over-used decimals at high magnitudes, and a few
 * rendered raw integers without thousands separators. See #121.
 *
 * Tier scale (matches Google Docs / Slack / most user-facing apps):
 *   < 1,000              → raw with commas (e.g. `847`)
 *   < 1,000,000          → k      (e.g. `12.3k`, `847k`)
 *   < 1,000,000,000      → M      (e.g. `12.3M`, `847M`)
 *   < 1,000,000,000,000  → B      (e.g. `12.3B`, `847B`)
 *   else                 → T      (e.g. `12.3T`)
 *
 * Within a tier, the decimal drops once the coefficient is ≥ 100.
 * This prevents `417.2M` (6 chars) from clipping heatmap cells —
 * it renders as `417M` (4 chars). See #122.
 */

function pickTier(abs: number): { divisor: number; suffix: string } {
  if (abs < 1_000) return { divisor: 1, suffix: "" };
  if (abs < 1_000_000) return { divisor: 1_000, suffix: "k" };
  if (abs < 1_000_000_000) return { divisor: 1_000_000, suffix: "M" };
  if (abs < 1_000_000_000_000) return { divisor: 1_000_000_000, suffix: "B" };
  return { divisor: 1_000_000_000_000, suffix: "T" };
}

/**
 * Compact tiered format: `11307500000 → "11.3B"`, `417200000 → "417M"`,
 * `847 → "847"`. Accepts bigint to handle totalTokens without loss.
 * Negative values render with a leading `-`.
 */
export function formatCompactNumber(value: number | bigint): string {
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs < 1_000) {
    return sign + Math.round(abs).toLocaleString("en-US");
  }

  const { divisor, suffix } = pickTier(abs);
  const scaled = abs / divisor;
  const digits = scaled >= 100 ? 0 : 1;
  return `${sign}${scaled.toFixed(digits)}${suffix}`;
}

/**
 * Raw integer with thousands separators: `5086539595 → "5,086,539,595"`.
 * Use for places that want to show the exact count (session counts,
 * PR counts, commit counts, etc.) rather than a compact summary.
 */
export function formatInteger(value: number | bigint): string {
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Currency variant of the compact format: `1234567 → "$1.2M"`.
 * Sub-dollar values fall through to two-decimal precision so
 * `$0.04` renders as expected instead of `$0`.
 */
export function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs < 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs < 1_000) return `${sign}$${abs.toFixed(0)}`;
  return `${sign}$${formatCompactNumber(abs)}`;
}
