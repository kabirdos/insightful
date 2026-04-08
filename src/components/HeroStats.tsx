"use client";

import type { HarnessStats } from "@/types/insights";

interface HeroStatsProps {
  stats: HarnessStats;
  dayCount: number | null;
  sessionCount: number | null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function perWeek(value: number, dayCount: number | null): string | null {
  if (!dayCount || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  const rate = value / weeks;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(1)}K`;
  return rate < 10 ? rate.toFixed(1) : Math.round(rate).toLocaleString();
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
};

function StatCard({
  value,
  label,
  rate,
  numericSeed,
}: {
  value: string;
  label: string;
  rate: string | null;
  numericSeed: number;
}) {
  const sparkData = seededSparkline(numericSeed);
  const color = STAT_COLORS[label] || "#6366f1";
  const primaryDisplay = rate ? `${rate}/wk` : value;
  const subtitle = rate ? `(${value} total)` : null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />
      <div className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-100">
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

export default function HeroStats({
  stats,
  dayCount,
  sessionCount,
}: HeroStatsProps) {
  const sessions = sessionCount || stats.sessionCount || 0;

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.totalTokens > 0 && (
        <StatCard
          value={formatNumber(stats.totalTokens)}
          label="Tokens"
          rate={perWeek(stats.totalTokens, dayCount)}
          numericSeed={stats.totalTokens}
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
      {stats.skillsUsedCount > 0 && (
        <StatCard
          value={stats.skillsUsedCount.toString()}
          label="Skills"
          rate={null}
          numericSeed={stats.skillsUsedCount * 31}
        />
      )}
    </div>
  );
}
