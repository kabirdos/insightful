"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, MessageSquare, Calendar, User } from "lucide-react";
import clsx from "clsx";

interface InsightCardProps {
  slug: string;
  title: string;
  authorUsername: string;
  authorAvatar?: string | null;
  authorDisplayName?: string | null;
  publishedAt: string;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  sessionCount?: number | null;
  messageCount?: number | null;
  commitCount?: number | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
  fileCount?: number | null;
  dayCount?: number | null;
  msgsPerDay?: number | null;
  whatsWorkingPreview?: string | null;
  voteCount: number;
  commentCount: number;
  sectionTags?: string[];
  totalTokens?: number | null;
  lifetimeTokens?: number | null;
}

function formatTokensCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const s = new Date(start).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const e = new Date(end).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${s} - ${e}`;
}

const sectionTagColors: Record<string, string> = {
  at_a_glance:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  interaction_style:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  project_areas:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  impressive_workflows:
    "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  friction_analysis:
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  suggestions:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  on_the_horizon:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  fun_ending:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
};

const sectionTagLabels: Record<string, string> = {
  at_a_glance: "At a Glance",
  interaction_style: "Interaction Style",
  project_areas: "Projects",
  impressive_workflows: "Workflows",
  friction_analysis: "Friction",
  suggestions: "Suggestions",
  on_the_horizon: "Horizon",
  fun_ending: "Fun",
};

export default function InsightCard({
  slug,
  title,
  authorUsername,
  authorAvatar,
  authorDisplayName,
  publishedAt,
  dateRangeStart,
  dateRangeEnd,
  sessionCount,
  messageCount,
  commitCount,
  linesAdded,
  linesRemoved,
  fileCount,
  dayCount,
  msgsPerDay,
  whatsWorkingPreview,
  voteCount,
  commentCount,
  sectionTags = [],
  totalTokens,
  lifetimeTokens,
}: InsightCardProps) {
  const dateRange = formatDateRange(dateRangeStart, dateRangeEnd);
  const effectiveLifetime =
    lifetimeTokens && lifetimeTokens > 0 ? lifetimeTokens : (totalTokens ?? 0);

  return (
    <Link
      href={`/insights/${slug}`}
      className="group block min-w-0 overflow-hidden break-words rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-blue-900 dark:hover:shadow-blue-500/10"
    >
      {/* Author Row */}
      <div className="flex items-center gap-2.5">
        {authorAvatar ? (
          <Image
            src={authorAvatar}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
            <User className="h-3.5 w-3.5" />
          </div>
        )}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {authorDisplayName || authorUsername}
        </span>
        <span className="text-xs text-slate-400">
          {formatDate(publishedAt)}
        </span>
      </div>

      {effectiveLifetime > 0 && (
        <div className="mt-2">
          <div className="font-mono text-sm font-medium leading-none text-slate-900 dark:text-white">
            {formatTokensCompact(effectiveLifetime)}
          </div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
            lifetime tokens
          </div>
        </div>
      )}

      {/* Title / Stats */}
      <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 line-clamp-2 break-all sm:break-normal">
        {title}
      </h3>

      {/* Stats row */}
      {(sessionCount || messageCount || commitCount) && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          {messageCount != null && (
            <span>{messageCount.toLocaleString()} msgs</span>
          )}
          {linesAdded != null && linesRemoved != null && (
            <span className="text-green-600 dark:text-green-400">
              +{linesAdded.toLocaleString()}
            </span>
          )}
          {linesRemoved != null && (
            <span className="text-red-500 dark:text-red-400">
              -{linesRemoved.toLocaleString()}
            </span>
          )}
          {fileCount != null && <span>{fileCount} files</span>}
          {dayCount != null && <span>{dayCount} days</span>}
          {msgsPerDay != null && <span>{msgsPerDay.toFixed(1)}/day</span>}
          {commitCount != null && <span>{commitCount} commits</span>}
        </div>
      )}

      {/* Date range */}
      {dateRange && (
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
          <Calendar className="h-3 w-3" />
          <span>{dateRange}</span>
        </div>
      )}

      {/* Preview */}
      {whatsWorkingPreview && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
          {whatsWorkingPreview}
        </p>
      )}

      {/* Tags */}
      {sectionTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sectionTags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                sectionTagColors[tag] ||
                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
              )}
            >
              {sectionTagLabels[tag] || tag}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row: votes + comments */}
      <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <Heart className="h-3.5 w-3.5" />
          <span>{voteCount}</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{commentCount}</span>
        </div>
      </div>
    </Link>
  );
}
