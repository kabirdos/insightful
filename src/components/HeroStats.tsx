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

function StatCard({
  value,
  label,
  rate,
}: {
  value: string;
  label: string;
  rate: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />
      <div className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      {rate && (
        <div className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          {rate}/wk
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
  const sessions = sessionCount ?? 0;

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.totalTokens > 0 && (
        <StatCard
          value={formatNumber(stats.totalTokens)}
          label="Tokens"
          rate={perWeek(stats.totalTokens, dayCount)}
        />
      )}
      {sessions > 0 && (
        <StatCard
          value={sessions.toString()}
          label="Sessions"
          rate={perWeek(sessions, dayCount)}
        />
      )}
      {stats.durationHours > 0 && (
        <StatCard
          value={`${stats.durationHours}h`}
          label="Active Time"
          rate={perWeek(stats.durationHours, dayCount)}
        />
      )}
      {stats.skillsUsedCount > 0 && (
        <StatCard
          value={stats.skillsUsedCount.toString()}
          label="Skills"
          rate={null}
        />
      )}
    </div>
  );
}
