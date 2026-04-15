"use client";

import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { buildProfileUrl } from "@/lib/urls";
import type { LeaderboardRow as LeaderboardRowData } from "@/app/api/leaderboard/route";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

function formatLines(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col items-end text-right">
      <span
        className={clsx(
          "text-sm font-bold text-slate-900 dark:text-white",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </span>
    </div>
  );
}

function Lines({
  added,
  removed,
}: {
  added: number | null;
  removed: number | null;
}) {
  if ((added ?? 0) === 0 && (removed ?? 0) === 0) {
    return <span className="text-slate-400 dark:text-slate-600">—</span>;
  }
  return (
    <span className="flex items-baseline gap-1.5 font-mono text-sm font-bold">
      <span className="text-emerald-600 dark:text-emerald-400">
        +{formatLines(added ?? 0)}
      </span>
      {(removed ?? 0) > 0 && (
        <span className="text-rose-600 dark:text-rose-400">
          -{formatLines(removed ?? 0)}
        </span>
      )}
    </span>
  );
}

export default function LeaderboardRow({ row }: { row: LeaderboardRowData }) {
  const href = buildProfileUrl(row.username);
  const initial = (row.displayName || row.username)[0]?.toUpperCase() ?? "?";
  const isTop3 = row.rank <= 3;

  return (
    <Link
      href={href}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:px-5"
    >
      {/* Rank + avatar + name */}
      <div className="flex items-center gap-3 sm:gap-4">
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold tabular-nums",
            isTop3
              ? "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-800/60"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
          )}
        >
          {row.rank}
        </span>
        {row.avatarUrl ? (
          <Image
            src={row.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-base font-bold text-white">
            {initial}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {row.displayName || row.username}
        </div>
        <div className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
          @{row.username}
        </div>
      </div>

      {/* Stats — collapse to lifetime-only on mobile */}
      <div className="flex items-center gap-5 sm:gap-6">
        <Stat label="Lifetime" value={formatTokens(row.lifetimeTokens)} />
        <div className="hidden sm:block">
          <Stat label="30d Tokens" value={formatTokens(row.totalTokens)} />
        </div>
        <div className="hidden md:block">
          <Stat label="Sessions" value={row.sessionCount.toLocaleString()} />
        </div>
        <div className="hidden md:block">
          <Stat label="Active" value={`${row.durationHours}h`} />
        </div>
        <div className="hidden lg:block">
          <Stat
            label="Lines"
            value={<Lines added={row.linesAdded} removed={row.linesRemoved} />}
            mono={false}
          />
        </div>
      </div>
    </Link>
  );
}
