"use client";

import React, { useMemo } from "react";
import { estimateApiCostUsd } from "@/lib/api-cost";
import {
  formatCompactNumber,
  formatCompactCurrency,
} from "@/lib/number-format";

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
  /** Optional 4-way per-model breakdown for accurate cost estimation */
  perModelTokens?: Record<
    string,
    { input: number; output: number; cache_read: number; cache_create: number }
  > | null;
}

// 4 weeks × 7 days = 28 cells per heatmap (no day-of-week labels)
const WEEKS = 4;
const DAYS_PER_WEEK = 7;
const CELL_COUNT = WEEKS * DAYS_PER_WEEK;

type ColorScale = "blue" | "green" | "amber";

const SCALE_SWATCHS: Record<ColorScale, string[]> = {
  blue: [
    "bg-blue-100 dark:bg-blue-900/40",
    "bg-blue-300 dark:bg-blue-800/60",
    "bg-blue-400 dark:bg-blue-700",
    "bg-blue-500 dark:bg-blue-600",
    "bg-blue-700 dark:bg-blue-500",
  ],
  green: [
    "bg-green-100 dark:bg-green-900/40",
    "bg-green-300 dark:bg-green-800/60",
    "bg-green-400 dark:bg-green-700",
    "bg-green-500 dark:bg-green-600",
    "bg-green-700 dark:bg-green-500",
  ],
  amber: [
    "bg-amber-100 dark:bg-amber-900/40",
    "bg-amber-300 dark:bg-amber-800/60",
    "bg-amber-400 dark:bg-amber-700",
    "bg-amber-500 dark:bg-amber-600",
    "bg-amber-700 dark:bg-amber-500",
  ],
};

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
  return formatCompactNumber(n);
}

function formatCost(n: number): string {
  if (n === 0) return "0";
  return formatCompactCurrency(n);
}

// Cost estimation now lives in src/lib/api-cost.ts so it can be shared
// across the homepage ProfileCard, the activity card, and the report
// detail page (issue #26).

function GridHeatmap({
  title,
  bigNumber,
  bigNumberLabel,
  scale,
  data,
  formatValue,
  ariaValueLabel,
}: {
  title: string;
  /** Large vanity number rendered above the heat map (e.g. "101"). */
  bigNumber: string;
  /** Smaller label under the vanity number (e.g. "total sessions"). */
  bigNumberLabel: string;
  scale: ColorScale;
  data: number[]; // length CELL_COUNT
  formatValue: (n: number) => string;
  /** Accessible suffix used in per-cell title attributes (e.g. "sessions"). */
  ariaValueLabel: string;
}) {
  const max = Math.max(...data, 1);
  const nonZero = data.filter((v) => v > 0);
  const min = nonZero.length > 0 ? Math.min(...nonZero) : 0;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/20">
      {/* Title chip */}
      <div
        className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${TITLE_COLORS[scale]}`}
      >
        {title}
      </div>

      {/* Big vanity number */}
      <div className="mb-4">
        <div className="text-4xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
          {bigNumber}
        </div>
        <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {bigNumberLabel}
        </div>
      </div>

      {/* Heat map — 7 columns (one per day of the week) with aspect-square
          cells that shrink to fit the container. Using a 7-col grid
          preserves the week-over-week visual chronology regardless of
          container width. Cells stay perfectly square via aspect-square. */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
        role="list"
        aria-label={`${title} daily activity`}
      >
        {data.map((value, i) => {
          const level = getLevel(scale, value, max);
          const displayValue = formatValue(value);
          const titleAttr =
            value > 0
              ? `${displayValue} ${ariaValueLabel}`
              : `No ${ariaValueLabel}`;
          return (
            <div
              key={i}
              role="listitem"
              title={titleAttr}
              aria-label={titleAttr}
              className={`flex aspect-square min-w-0 items-center justify-center rounded text-center text-[10px] font-semibold leading-tight ${level.bg} ${level.text} ${level.border ?? ""}`}
            >
              {displayValue}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="shrink-0">Low {formatValue(min)}</span>
        <div className="flex items-center gap-1">
          {SCALE_SWATCHS[scale].map((swatch, index) => (
            <span
              key={`${scale}-${index}`}
              className={`h-2.5 w-5 rounded-sm ${swatch}`}
            />
          ))}
        </div>
        <span className="shrink-0">High {formatValue(max)}</span>
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
  perModelTokens,
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
    const totalTokenCount =
      totalTokens ?? tokensDaily.reduce((a, b) => a + b, 0);
    // Shared helper handles per-model rate lookup AND the missing-
    // breakdown fallback (Sonnet 4.6 blended rate over total tokens).
    const totalCost = estimateApiCostUsd(
      models,
      totalTokenCount,
      perModelTokens,
    );
    if (totalCost <= 0) return tokensDaily.map(() => 0);
    const tokenSum = tokensDaily.reduce((a, b) => a + b, 0) || 1;
    return tokensDaily.map((t) => (t / tokenSum) * totalCost);
  }, [tokensDaily, models, totalTokens, perModelTokens]);

  if (!sessionsDaily || !tokensDaily || !costDaily) return null;

  const totalSessionsSum = sessionsDaily.reduce((a, b) => a + b, 0);
  const totalTokensSum = tokensDaily.reduce((a, b) => a + b, 0);
  const totalCostEstimate = costDaily.reduce((a, b) => a + b, 0);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Activity
      </h3>
      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <GridHeatmap
          title="Sessions"
          bigNumber={totalSessionsSum.toLocaleString()}
          bigNumberLabel="total sessions"
          scale="blue"
          data={sessionsDaily}
          formatValue={(n) => (n > 0 ? n.toString() : "")}
          ariaValueLabel="sessions"
        />
        <GridHeatmap
          title="Tokens"
          bigNumber={formatTokens(totalTokensSum)}
          bigNumberLabel="total tokens"
          scale="amber"
          data={tokensDaily}
          formatValue={(n) => (n > 0 ? formatTokens(n) : "")}
          ariaValueLabel="tokens"
        />
        <GridHeatmap
          title="Est. API Cost"
          bigNumber={formatCost(totalCostEstimate)}
          bigNumberLabel="estimated API cost"
          scale="green"
          data={costDaily}
          formatValue={(n) => (n > 0 ? formatCost(n) : "")}
          ariaValueLabel="dollars estimated"
        />
      </div>
    </div>
  );
}
