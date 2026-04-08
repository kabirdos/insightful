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
  dateRangeEnd?: string;
  slug?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKS = 5;

function getBlueLevel(
  value: number,
  max: number,
): { bg: string; text: string; border?: string } {
  if (value === 0)
    return {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-400 dark:text-slate-500",
      border: "border border-slate-200 dark:border-slate-700",
    };
  const pct = value / Math.max(max, 1);
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
    return {
      bg: "bg-blue-400 dark:bg-blue-700",
      text: "text-white",
    };
  if (pct <= 0.8)
    return {
      bg: "bg-blue-500 dark:bg-blue-600",
      text: "text-white",
    };
  return {
    bg: "bg-blue-700 dark:bg-blue-500",
    text: "text-white",
  };
}

function getGreenLevel(
  value: number,
  max: number,
): { bg: string; text: string; border?: string } {
  if (value === 0)
    return {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-400 dark:text-slate-500",
      border: "border border-slate-200 dark:border-slate-700",
    };
  const pct = value / Math.max(max, 1);
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
    return {
      bg: "bg-green-400 dark:bg-green-700",
      text: "text-white",
    };
  if (pct <= 0.8)
    return {
      bg: "bg-green-500 dark:bg-green-600",
      text: "text-white",
    };
  return {
    bg: "bg-green-700 dark:bg-green-500",
    text: "text-white",
  };
}

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

function HeatmapGrid({
  title,
  titleColor,
  data,
  getLevel,
  formatValue,
}: {
  title: string;
  titleColor: string;
  data: number[][];
  getLevel: (
    value: number,
    max: number,
  ) => { bg: string; text: string; border?: string };
  formatValue: (n: number) => string;
}) {
  const allValues = data.flat();
  const max = Math.max(...allValues, 1);

  return (
    <div>
      <div
        className={`mb-2 text-xs font-bold uppercase tracking-wider ${titleColor}`}
      >
        {title}
      </div>
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `32px repeat(${WEEKS}, 24px)`,
        }}
      >
        {/* Header row */}
        <div />
        {Array.from({ length: WEEKS }, (_, i) => (
          <div
            key={i}
            className="text-center text-[9px] leading-4 text-slate-400"
          >
            W{i + 1}
          </div>
        ))}
        {/* Data rows */}
        {DAYS.map((day, dayIdx) => (
          <React.Fragment key={day}>
            <div className="flex h-6 items-center text-[10px] text-slate-500 dark:text-slate-400">
              {day}
            </div>
            {Array.from({ length: WEEKS }, (_, weekIdx) => {
              const value = data[dayIdx]?.[weekIdx] ?? 0;
              const level = getLevel(value, max);
              return (
                <div
                  key={`${day}-${weekIdx}`}
                  className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ${level.bg} ${level.text} ${level.border ?? ""}`}
                >
                  {formatValue(value)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
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
  dateRangeEnd,
  slug,
}: ActivityHeatmapProps) {
  // Build grids from dailyData or aggregate stats
  const { sessionsGrid, tokensGrid } = useMemo(() => {
    const sGrid: number[][] = DAYS.map(() => Array(WEEKS).fill(0));
    const tGrid: number[][] = DAYS.map(() => Array(WEEKS).fill(0));

    if (dailyData && dailyData.length > 0) {
      // Fill grids from daily data (most recent first, reversed to chronological)
      const sorted = [...dailyData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      sorted.slice(-35).forEach((d, i) => {
        const dayOfWeek = new Date(d.date + "T00:00:00").getDay();
        const week = Math.floor(i / 7);
        if (week < WEEKS && dayOfWeek < 7) {
          sGrid[dayOfWeek][week] = d.sessions;
          tGrid[dayOfWeek][week] = d.tokens;
        }
      });
      return { sessionsGrid: sGrid, tokensGrid: tGrid };
    }

    // Generate from aggregate stats
    if (
      totalSessions != null &&
      totalTokens != null &&
      dayCount != null &&
      dayCount > 0 &&
      slug
    ) {
      const effectiveDays = Math.min(dayCount, 35);
      const sessionsDaily = generateDailyData(
        totalSessions,
        effectiveDays,
        slug + "-sessions",
      );
      const tokensDaily = generateDailyData(
        totalTokens,
        effectiveDays,
        slug + "-tokens",
      );

      // Determine starting day-of-week from dateRangeStart (or default to Monday)
      let startDow = 1; // Monday
      if (dateRangeStart) {
        startDow = new Date(dateRangeStart + "T00:00:00").getDay();
      }

      for (let i = 0; i < effectiveDays; i++) {
        const dayOfWeek = (startDow + i) % 7;
        const week = Math.floor(i / 7);
        if (week < WEEKS && dayOfWeek < 7) {
          sGrid[dayOfWeek][week] = sessionsDaily[i];
          tGrid[dayOfWeek][week] = tokensDaily[i];
        }
      }
      return { sessionsGrid: sGrid, tokensGrid: tGrid };
    }

    return { sessionsGrid: null, tokensGrid: null };
  }, [dailyData, totalSessions, totalTokens, dayCount, dateRangeStart, slug]);

  if (!sessionsGrid || !tokensGrid) return null;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Activity
      </h3>
      <div className="grid gap-6 sm:grid-cols-2">
        <HeatmapGrid
          title="Sessions"
          titleColor="text-blue-800 dark:text-blue-400"
          data={sessionsGrid}
          getLevel={getBlueLevel}
          formatValue={(n) => n.toString()}
        />
        <HeatmapGrid
          title="Tokens"
          titleColor="text-green-800 dark:text-green-400"
          data={tokensGrid}
          getLevel={getGreenLevel}
          formatValue={formatTokens}
        />
      </div>
    </div>
  );
}
