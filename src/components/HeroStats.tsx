"use client";

import type {
  HarnessStats,
  HarnessModelTokenBreakdown,
} from "@/types/insights";
import { formatCompactNumber } from "@/lib/number-format";

interface HeroStatsProps {
  stats: HarnessStats;
  dayCount: number | null;
  sessionCount: number | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
  // Lifetime per-model token breakdown (input/output/cache). Used to derive a
  // lifetime "new work" figure for the banner so it doesn't headline the
  // cache-dominated 4-way throughput total. Absent when no stats-cache exists.
  perModelTokens?: Record<string, HarnessModelTokenBreakdown> | null;
}

/** A cache-read subtitle like "105:1 cached · 3.96B reads", or null. */
function cacheSubtitle(
  ratio: number | undefined,
  reads: number | undefined,
): string | null {
  if (!ratio || !reads || reads <= 0) return null;
  return `${ratio}:1 cached · ${formatCompactNumber(reads)} reads`;
}

function perWeek(value: number, dayCount: number | null): string | null {
  if (!dayCount || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  const rate = value / weeks;
  if (rate < 10) return rate.toFixed(1);
  return formatCompactNumber(rate);
}

function seededSparkline(seed: number, length = 10): number[] {
  let s = Math.abs(seed) || 1;
  const pts: number[] = [];
  for (let i = 0; i < length; i++) {
    s = (s * 16807 + 12345) % 2147483647;
    pts.push((s % 100) / 100);
  }
  // Smooth a bit: running average of neighbors
  return pts.map((v, i) => {
    const prev = pts[i - 1] ?? v;
    const next = pts[i + 1] ?? v;
    return (prev + v + next) / 3;
  });
}

function Sparkline({
  data,
  color = "#6366f1",
}: {
  data: number[];
  color?: string;
}) {
  const w = 80;
  const h = 24;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const fillPoints = `${pad},${h - pad} ${points} ${w - pad},${h - pad}`;
  return (
    <svg width={w} height={h} className="mx-auto" aria-hidden="true">
      <polyline
        points={fillPoints}
        fill={color}
        fillOpacity={0.1}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STAT_COLORS: Record<string, string> = {
  Tokens: "#3b82f6",
  Sessions: "#8b5cf6",
  "Active Time": "#06b6d4",
  Skills: "#f59e0b",
  "Lines of Code": "#22c55e",
};

function StatCard({
  value,
  label,
  rate,
  numericSeed,
  subtitleOverride,
}: {
  value: string;
  label: string;
  rate: string | null;
  numericSeed: number;
  // When set, replaces the "(X total)" per-week subtitle and shows `value`
  // (not the rate) as the headline. Used by the Tokens card to headline
  // new-work tokens with a cache-read efficiency subtitle.
  subtitleOverride?: string | null;
}) {
  const sparkData = seededSparkline(numericSeed);
  const color = STAT_COLORS[label] || "#6366f1";
  const primaryDisplay = subtitleOverride ? value : rate ? `${rate}/wk` : value;
  const subtitle = subtitleOverride ?? (rate ? `(${value} total)` : null);
  // Shrink the font when the display is long so "1.5M/wk" stays on one line
  // in narrow columns (mobile shows 2 cards per row).
  const displayLength = primaryDisplay.length;
  const sizeClass =
    displayLength >= 8
      ? "text-[22px] sm:text-[24px]"
      : displayLength >= 6
        ? "text-[26px] sm:text-[28px]"
        : "text-[32px]";
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />
      <div
        className={`${sizeClass} whitespace-nowrap font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-100`}
      >
        {primaryDisplay}
      </div>
      <div className="mt-2">
        <Sparkline data={sparkData} color={color} />
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      {subtitle && (
        <div className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          {subtitle}
        </div>
      )}
    </div>
  );
}

// Specialized variant of StatCard for Lines of Code: shows
// `+added / -removed` with green/red two-tone coloring instead of a
// single value. When `removed` is null we hide the `-X` half so the
// gitPatterns fallback (additions only) still renders cleanly.
function LinesStatCard({
  added,
  removed,
  numericSeed,
}: {
  added: number;
  removed: number | null;
  numericSeed: number;
}) {
  const sparkData = seededSparkline(numericSeed);
  const color = STAT_COLORS["Lines of Code"];
  const addedStr = `+${formatCompactNumber(added)}`;
  const removedStr =
    removed != null ? `-${formatCompactNumber(removed)}` : null;
  // Hero card width is the constraint here. Inside `max-w-5xl px-4`
  // the grid switches to four columns at `sm:` (640px), which actually
  // *narrows* each card vs the 2-column mobile layout, so the inline
  // `+X / -Y` form only safely fits across the full formatter range
  // (up to `+2.1M / -2.1M`) at `lg:` (1024px) and above. Strategy:
  //   (a) tighten font sizes by display length,
  //   (b) drop horizontal card padding from `px-5` to `px-2` until lg,
  //   (c) stack the two halves vertically with a `<br>` until lg, then
  //       go inline with the slash separator at lg:+.
  const displayLength =
    addedStr.length + (removedStr ? removedStr.length + 3 : 0);
  const sizeClass = removedStr
    ? displayLength >= 12
      ? "text-[18px] lg:text-[22px]"
      : "text-[22px] lg:text-[26px]"
    : addedStr.length >= 6
      ? "text-[24px] lg:text-[28px]"
      : "text-[30px] lg:text-[32px]";
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-2 py-5 text-center dark:border-slate-700 dark:bg-slate-900/50 lg:px-5">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />
      <div
        className={`${sizeClass} font-extrabold leading-tight tracking-tight lg:whitespace-nowrap lg:leading-none`}
      >
        <span className="text-green-600 dark:text-green-400">{addedStr}</span>
        {removedStr && (
          <>
            <span className="hidden lg:inline"> </span>
            <br className="lg:hidden" />
            <span className="text-red-600 dark:text-red-400">{removedStr}</span>
          </>
        )}
      </div>
      <div className="mt-2">
        <Sparkline data={sparkData} color={color} />
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Lines of Code
      </div>
    </div>
  );
}

export default function HeroStats({
  stats,
  dayCount,
  sessionCount,
  linesAdded,
  linesRemoved,
  perModelTokens,
}: HeroStatsProps) {
  const sessions = sessionCount || stats.sessionCount || 0;
  // Lines of Code now lives in the top-four card slot (issue #44),
  // replacing Skills. We track "present vs missing" distinctly from
  // "zero" so the gitPatterns fallback (#35) — which only ships
  // additions — can render `+18.4k` without an empty `-0` half.
  // When neither additions nor removals are populated we fall back to
  // the Skills card, keeping the layout at four cards instead of three
  // (per the issue's "implementer's call" — simpler than a variable
  // grid).
  const addedRaw = linesAdded ?? 0;
  const removedRaw = linesRemoved ?? 0;
  const showLinesCard = addedRaw > 0 || removedRaw > 0;

  // Headline "new work" tokens (input + output) rather than the 4-way
  // throughput total (`totalTokens`), which cache reads dominate 100-1000x —
  // headlining it reads as a misleading "billions". New reports (extract.py
  // >= 2.14.0) carry `newTokens`; older reports fall back to `totalTokens`.
  const newTokens =
    typeof stats.newTokens === "number" && stats.newTokens > 0
      ? stats.newTokens
      : null;
  const tokensDisplay = newTokens ?? stats.totalTokens ?? 0;
  const tokenCacheSub = cacheSubtitle(
    stats.cacheReadRatio,
    stats.cacheReadTokens,
  );

  // Lifetime banner: derive lifetime new-work tokens from the per-model
  // breakdown (input+output), which is lifetime-scoped. This deliberately
  // avoids `lifetimeTokens`/`totalTokens` — both cache-dominated throughput.
  // When there's no per-model data (no stats-cache) we hide the banner: the
  // 30-day Tokens card already carries the number, and falling back to
  // throughput would resurrect the misleading "billions" headline.
  const pm = perModelTokens ? Object.values(perModelTokens) : [];
  const lifetimeNew = pm.reduce(
    (sum, m) => sum + (m.input || 0) + (m.output || 0),
    0,
  );
  const lifetimeCacheRead = pm.reduce((sum, m) => sum + (m.cache_read || 0), 0);
  const lifetimeCacheRatio =
    lifetimeNew > 0 ? Math.round(lifetimeCacheRead / lifetimeNew) : 0;
  const lifetimeCacheSub = cacheSubtitle(lifetimeCacheRatio, lifetimeCacheRead);

  return (
    <div className="mb-8">
      {/* Lifetime tokens banner — uses the same Inter extrabold /
          tracking-tight / leading-none treatment as StatCard values so the
          hero number reads as "the biggest stat card" rather than a
          stylistically separate element. Shows lifetime *new work* (not
          cache-dominated throughput) and only when per-model data exists. */}
      {lifetimeNew > 0 && (
        <div className="mb-6 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-cyan-50/60 px-6 py-5 text-center dark:border-blue-900/40 dark:from-blue-950/30 dark:to-cyan-950/20">
          <div className="text-5xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-7xl dark:text-slate-100">
            {formatCompactNumber(lifetimeNew)}
          </div>
          <div className="mt-2 text-[13px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
            Lifetime Tokens
          </div>
          {lifetimeCacheSub && (
            <div className="mt-1.5 text-[13px] font-medium text-slate-400 dark:text-slate-500">
              {lifetimeCacheSub}
            </div>
          )}
          {newTokens && newTokens > 0 && (
            <div className="mt-1 text-[13px] font-medium text-slate-400 dark:text-slate-500">
              {formatCompactNumber(newTokens)} in last 30 days
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tokensDisplay > 0 && (
          <StatCard
            value={formatCompactNumber(tokensDisplay)}
            label="Tokens"
            // New-work reports headline the total (no /wk) with a cache
            // subtitle; older reports keep the legacy per-week rate.
            rate={newTokens ? null : perWeek(stats.totalTokens, dayCount)}
            numericSeed={tokensDisplay}
            subtitleOverride={newTokens ? tokenCacheSub : null}
          />
        )}
        {sessions > 0 && (
          <StatCard
            value={sessions.toString()}
            label="Sessions"
            rate={perWeek(sessions, dayCount)}
            numericSeed={sessions * 7}
          />
        )}
        {stats.durationHours > 0 && (
          <StatCard
            value={`${stats.durationHours}h`}
            label="Active Time"
            rate={perWeek(stats.durationHours, dayCount)}
            numericSeed={stats.durationHours * 13}
          />
        )}
        {showLinesCard ? (
          <LinesStatCard
            added={addedRaw}
            removed={linesRemoved ?? null}
            numericSeed={(addedRaw + removedRaw) * 17 || 1}
          />
        ) : (
          stats.skillsUsedCount > 0 && (
            <StatCard
              value={stats.skillsUsedCount.toString()}
              label="Skills"
              rate={null}
              numericSeed={stats.skillsUsedCount * 31}
            />
          )
        )}
      </div>
    </div>
  );
}
