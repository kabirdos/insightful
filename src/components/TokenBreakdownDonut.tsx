"use client";

import type { HarnessModelTokenBreakdown } from "@/types/insights";
import { estimateBreakdownCosts } from "@/lib/api-cost";

interface TokenBreakdownDonutProps {
  /** The per-X token map (per-repo / per-skill / per-tool / per-subagent). */
  data: Record<string, HarnessModelTokenBreakdown> | null | undefined;
  /** Lifetime per-model tokens — used only to pick the dominant pricing rate. */
  perModelTokens: Record<string, HarnessModelTokenBreakdown> | null | undefined;
  /** Chart title (e.g. "By repository"). */
  title: string;
  /** Center-of-donut noun (e.g. "repos"). */
  unit: string;
  /** Top-N slices before the rest collapse into an "Other" bucket. */
  topN?: number;
}

const SLICE_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
];
const OTHER_COLOR = "#cbd5e1";

function sumBreakdown(b: HarnessModelTokenBreakdown): number {
  return (
    (b.input ?? 0) +
    (b.output ?? 0) +
    (b.cache_read ?? 0) +
    (b.cache_create ?? 0)
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function formatUsd(n: number): string {
  if (n <= 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

interface Slice {
  name: string;
  tokens: number;
  usd: number;
  color: string;
}

/**
 * Shared donut for the four token-spend breakdowns. Tokens drive the slices;
 * USD (estimated via the dominant-model rate) shows in the legend and native
 * hover tooltip. Renders nothing when its map is null/empty — every wrapper
 * relies on this to disappear for pre-2.12 reports.
 */
export default function TokenBreakdownDonut({
  data,
  perModelTokens,
  title,
  unit,
  topN = 8,
}: TokenBreakdownDonutProps) {
  const entries = data ? Object.entries(data) : [];
  if (entries.length === 0) return null;

  const costs = estimateBreakdownCosts(data, perModelTokens);

  const ranked = entries
    .map(([name, b]) => ({
      name,
      tokens: sumBreakdown(b),
      usd: costs[name] ?? 0,
    }))
    .filter((e) => e.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);

  if (ranked.length === 0) return null;

  const top = ranked.slice(0, topN);
  const rest = ranked.slice(topN);

  const slices: Slice[] = top.map((e, i) => ({
    ...e,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  if (rest.length > 0) {
    slices.push({
      name: `Other (${rest.length})`,
      tokens: rest.reduce((s, e) => s + e.tokens, 0),
      usd: rest.reduce((s, e) => s + e.usd, 0),
      color: OTHER_COLOR,
    });
  }

  const totalTokens = slices.reduce((s, e) => s + e.tokens, 0);
  const totalUsd = slices.reduce((s, e) => s + e.usd, 0);
  if (totalTokens <= 0) return null;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 58;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  const segments = slices.reduce<
    Array<Slice & { pct: number; offset: number }>
  >((acc, seg) => {
    const pct = seg.tokens / totalTokens;
    const prevOffset =
      acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    acc.push({ ...seg, pct, offset: prevOffset });
    return acc;
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h4>
        <span className="text-xs text-slate-400">~{formatUsd(totalUsd)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map((seg) => {
              const dashLength = seg.pct * circumference;
              const dashOffset = -seg.offset * circumference;
              return (
                <circle
                  key={seg.name}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                >
                  <title>{`${seg.name}: ${formatTokens(seg.tokens)} tokens · ~${formatUsd(seg.usd)}`}</title>
                </circle>
              );
            })}
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              className="fill-slate-900 dark:fill-slate-100"
              fontSize="15"
              fontWeight="800"
            >
              {formatTokens(totalTokens)}
            </text>
            <text
              x={cx}
              y={cy + 9}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="10"
            >
              tokens · {ranked.length} {unit}
            </text>
          </svg>
        </div>

        <div className="min-w-[180px] flex-1">
          <div className="flex flex-col gap-1.5">
            {segments.map((seg) => {
              const pct = Math.round(seg.pct * 100);
              return (
                <div
                  key={seg.name}
                  className="flex items-center gap-2"
                  title={`${seg.name}: ${formatTokens(seg.tokens)} tokens · ~${formatUsd(
                    seg.usd,
                  )}`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="truncate text-[13px] font-medium text-slate-700 dark:text-slate-300">
                    {seg.name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-slate-400">
                    {formatTokens(seg.tokens)} · ~{formatUsd(seg.usd)} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
