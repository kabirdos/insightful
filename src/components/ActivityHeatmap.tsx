"use client";

import React, { useMemo } from "react";

interface DailyData {
  date: string;
  sessions: number;
  tokens: number;
}

interface ActivityHeatmapProps {
  dailyData?: DailyData[];
  /** Aggregate props — used to generate a plausible daily distribution when dailyData is absent */
  totalSessions?: number;
  totalTokens?: number;
  dayCount?: number;
  dateRangeStart?: string;
  slug?: string;
  /** Optional model → token count map, used to estimate API cost */
  models?: Record<string, number>;
}

// 4 weeks × 7 days = 28 cells per heatmap (no day-of-week labels)
const WEEKS = 4;
const DAYS_PER_WEEK = 7;
const CELL_COUNT = WEEKS * DAYS_PER_WEEK;

type ColorScale = "blue" | "green" | "amber";

function getLevel(
  scale: ColorScale,
  value: number,
  max: number,
): { bg: string; text: string; border?: string } {
  if (value === 0) {
    return {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-400 dark:text-slate-500",
      border: "border border-slate-200 dark:border-slate-700",
    };
  }
  const pct = value / Math.max(max, 1);

  if (scale === "blue") {
    if (pct <= 0.2)
      return {
        bg: "bg-blue-100 dark:bg-blue-900/40",
        text: "text-blue-800 dark:text-blue-300",
      };
    if (pct <= 0.4)
      return {
        bg: "bg-blue-300 dark:bg-blue-800/60",
        text: "text-blue-900 dark:text-blue-200",
      };
    if (pct <= 0.6)
      return { bg: "bg-blue-400 dark:bg-blue-700", text: "text-white" };
    if (pct <= 0.8)
      return { bg: "bg-blue-500 dark:bg-blue-600", text: "text-white" };
    return { bg: "bg-blue-700 dark:bg-blue-500", text: "text-white" };
  }

  if (scale === "green") {
    if (pct <= 0.2)
      return {
        bg: "bg-green-100 dark:bg-green-900/40",
        text: "text-green-800 dark:text-green-300",
      };
    if (pct <= 0.4)
      return {
        bg: "bg-green-300 dark:bg-green-800/60",
        text: "text-green-900 dark:text-green-200",
      };
    if (pct <= 0.6)
      return { bg: "bg-green-400 dark:bg-green-700", text: "text-white" };
    if (pct <= 0.8)
      return { bg: "bg-green-500 dark:bg-green-600", text: "text-white" };
    return { bg: "bg-green-700 dark:bg-green-500", text: "text-white" };
  }

  // amber
  if (pct <= 0.2)
    return {
      bg: "bg-amber-100 dark:bg-amber-900/40",
      text: "text-amber-800 dark:text-amber-300",
    };
  if (pct <= 0.4)
    return {
      bg: "bg-amber-300 dark:bg-amber-800/60",
      text: "text-amber-900 dark:text-amber-200",
    };
  if (pct <= 0.6)
    return { bg: "bg-amber-400 dark:bg-amber-700", text: "text-white" };
  if (pct <= 0.8)
    return { bg: "bg-amber-500 dark:bg-amber-600", text: "text-white" };
  return { bg: "bg-amber-700 dark:bg-amber-500", text: "text-white" };
}

const TITLE_COLORS: Record<ColorScale, string> = {
  blue: "text-blue-800 dark:text-blue-400",
  green: "text-green-800 dark:text-green-400",
  amber: "text-amber-800 dark:text-amber-400",
};

/* ── Seeded PRNG helpers ── */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateDailyData(
  total: number,
  days: number,
  seed: string,
): number[] {
  if (days <= 0) return [];
  let s = hashString(seed);
  const daily: number[] = [];
  let remaining = total;
  for (let i = 0; i < days - 1; i++) {
    s = (s * 16807 + 12345) % 2147483647;
    const weight = 0.5 + (s % 100) / 100; // 0.5 to 1.5x
    const avg = remaining / (days - i);
    const value = Math.round(avg * weight);
    daily.push(Math.max(0, value));
    remaining -= daily[daily.length - 1];
  }
  daily.push(Math.max(0, remaining));
  return daily;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  if (n === 0) return "0";
  if (n >= 100) return `$${Math.round(n)}`;
  if (n >= 10) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
}

// Rough blended USD / 1M tokens, no input/output split available.
// These are estimates — labeled "Est." in UI.
const MODEL_BLENDED_RATE_PER_M: Array<{ match: RegExp; rate: number }> = [
  { match: /opus/i, rate: 30 }, // blended between $15 in / $75 out
  { match: /haiku/i, rate: 1.6 }, // blended between $0.80 in / $4 out
  { match: /sonnet/i, rate: 6 }, // blended between $3 in / $15 out
];
const DEFAULT_RATE_PER_M = 6; // fall back to Sonnet-blended

function estimateTotalCostUsd(models?: Record<string, number>): number {
  if (!models) return 0;
  let total = 0;
  for (const [name, tokens] of Object.entries(models)) {
    if (!tokens || tokens <= 0) continue;
    const entry = MODEL_BLENDED_RATE_PER_M.find((m) => m.match.test(name));
    const rate = entry ? entry.rate : DEFAULT_RATE_PER_M;
    total += (tokens / 1_000_000) * rate;
  }
  return total;
}

function GridHeatmap({
  title,
  subtitle,
  scale,
  data,
  formatValue,
}: {
  title: string;
  subtitle?: string;
  scale: ColorScale;
  data: number[]; // length CELL_COUNT
  formatValue: (n: number) => string;
}) {
  const max = Math.max(...data, 1);
  const nonZero = data.filter((v) => v > 0);
  const min = nonZero.length > 0 ? Math.min(...nonZero) : 0;

  return (
    <div>
      <div
        className={`mb-1 text-xs font-bold uppercase tracking-wider ${TITLE_COLORS[scale]}`}
      >
        {title}
      </div>
      {subtitle && (
        <div className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
          {subtitle}
        </div>
      )}
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${DAYS_PER_WEEK}, minmax(0, 1fr))`,
        }}
      >
        {data.map((value, i) => {
          const level = getLevel(scale, value, max);
          return (
            <div
              key={i}
              title={formatValue(value)}
              className={`flex aspect-square items-center justify-center rounded text-[10px] font-semibold ${level.bg} ${level.text} ${level.border ?? ""}`}
            >
              {formatValue(value)}
            </div>
          );
        })}
      </div>
      {/* Legend: min / max for this series */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

export default function ActivityHeatmap({
  dailyData,
  totalSessions,
  totalTokens,
  dayCount,
  dateRangeStart,
  slug,
  models,
}: ActivityHeatmapProps) {
  const { sessionsDaily, tokensDaily } = useMemo<{
    sessionsDaily: number[] | null;
    tokensDaily: number[] | null;
  }>(() => {
    // Prefer real daily data if provided
    if (dailyData && dailyData.length > 0) {
      const sorted = [...dailyData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      // Take the most recent CELL_COUNT days, pad the front with zeros if short
      const recent = sorted.slice(-CELL_COUNT);
      const sArr = Array<number>(CELL_COUNT).fill(0);
      const tArr = Array<number>(CELL_COUNT).fill(0);
      const offset = CELL_COUNT - recent.length;
      recent.forEach((d, i) => {
        sArr[offset + i] = d.sessions;
        tArr[offset + i] = d.tokens;
      });
      return { sessionsDaily: sArr, tokensDaily: tArr };
    }

    // Otherwise generate from aggregate stats with a seeded PRNG
    if (
      totalSessions != null &&
      totalTokens != null &&
      dayCount != null &&
      dayCount > 0 &&
      slug
    ) {
      const effectiveDays = Math.min(dayCount, CELL_COUNT);
      const sGen = generateDailyData(
        totalSessions,
        effectiveDays,
        slug + "-sessions",
      );
      const tGen = generateDailyData(
        totalTokens,
        effectiveDays,
        slug + "-tokens",
      );
      // Right-align: put most recent activity at the end of the grid.
      const sArr = Array<number>(CELL_COUNT).fill(0);
      const tArr = Array<number>(CELL_COUNT).fill(0);
      const offset = CELL_COUNT - effectiveDays;
      for (let i = 0; i < effectiveDays; i++) {
        sArr[offset + i] = sGen[i];
        tArr[offset + i] = tGen[i];
      }
      // dateRangeStart currently unused now that we don't label days,
      // but kept in the signature for forward compatibility.
      void dateRangeStart;
      return { sessionsDaily: sArr, tokensDaily: tArr };
    }

    return { sessionsDaily: null, tokensDaily: null };
  }, [dailyData, totalSessions, totalTokens, dayCount, dateRangeStart, slug]);

  // Distribute estimated total cost proportionally to the tokens-per-day
  // series. If we have no tokens, fall back to zeros.
  const costDaily = useMemo<number[] | null>(() => {
    if (!tokensDaily) return null;
    const totalCost = estimateTotalCostUsd(models);
    if (totalCost <= 0) {
      // Fallback: still derive from totalTokens using default blended rate
      const fallbackTotal =
        (totalTokens ?? tokensDaily.reduce((a, b) => a + b, 0)) *
        (DEFAULT_RATE_PER_M / 1_000_000);
      if (fallbackTotal <= 0) return tokensDaily.map(() => 0);
      const tokenSum = tokensDaily.reduce((a, b) => a + b, 0) || 1;
      return tokensDaily.map((t) => (t / tokenSum) * fallbackTotal);
    }
    const tokenSum = tokensDaily.reduce((a, b) => a + b, 0) || 1;
    return tokensDaily.map((t) => (t / tokenSum) * totalCost);
  }, [tokensDaily, models, totalTokens]);

  if (!sessionsDaily || !tokensDaily || !costDaily) return null;

  const totalCostEstimate = costDaily.reduce((a, b) => a + b, 0);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Activity
      </h3>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <GridHeatmap
          title="Sessions"
          scale="blue"
          data={sessionsDaily}
          formatValue={(n) => (n > 0 ? n.toString() : "")}
        />
        <GridHeatmap
          title="Tokens"
          scale="green"
          data={tokensDaily}
          formatValue={(n) => (n > 0 ? formatTokens(n) : "")}
        />
        <GridHeatmap
          title="Est. API Cost"
          subtitle={`~${formatCost(totalCostEstimate)} total (estimate)`}
          scale="amber"
          data={costDaily}
          formatValue={(n) => (n > 0 ? formatCost(n) : "")}
        />
      </div>
    </div>
  );
}
