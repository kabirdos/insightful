"use client";

import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, Clock, Flame } from "lucide-react";
import clsx from "clsx";
import InsightCard from "@/components/InsightCard";

type SortOption = "newest" | "most_voted" | "trending";

interface InsightSummary {
  slug: string;
  title: string;
  publishedAt: string;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  sessionCount?: number | null;
  messageCount?: number | null;
  commitCount?: number | null;
  whatsWorkingPreview?: string | null;
  voteCount: number;
  commentCount: number;
  sectionTags: string[];
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

const sortOptions: {
  value: SortOption;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "newest", label: "Newest", icon: Clock },
  { value: "most_voted", label: "Most Voted", icon: TrendingUp },
  { value: "trending", label: "Trending", icon: Flame },
];

export default function HomePage() {
  const [insights, setInsights] = useState<InsightSummary[]>([]);
  const [sort, setSort] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights?sort=${sort}`)
      .then((r) => r.json())
      .then((json) => {
        const reports = json.data || json.insights || [];
        const mapped = reports.map((r: Record<string, unknown>) => {
          const atAGlance = r.atAGlance as Record<string, string> | null;
          const counts = r._count as Record<string, number> | undefined;
          const voteCounts = r.voteCounts as Record<string, number> | undefined;
          const totalVotes = voteCounts
            ? Object.values(voteCounts).reduce(
                (a: number, b: number) => a + b,
                0,
              )
            : (counts?.votes ?? 0);
          return {
            slug: r.slug,
            title: r.title,
            publishedAt: r.publishedAt,
            dateRangeStart: r.dateRangeStart,
            dateRangeEnd: r.dateRangeEnd,
            sessionCount: r.sessionCount,
            messageCount: r.messageCount,
            commitCount: r.commitCount,
            whatsWorkingPreview:
              atAGlance?.whats_working?.slice(0, 150) || null,
            voteCount: totalVotes,
            commentCount: counts?.comments ?? 0,
            sectionTags: [],
            author: r.author,
          };
        });
        setInsights(mapped);
      })
      .catch(() => setInsights([]))
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Insightful
          </h1>
        </div>
        <p className="mx-auto max-w-lg text-base text-slate-600 dark:text-slate-400">
          Discover how developers use Claude Code. Browse shared /insights
          reports, learn new workflows, and share your own.
        </p>
      </div>

      {/* Sort Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50 w-fit mx-auto">
        {sortOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              sort === value
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="mt-3 h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="mt-4 h-10 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="h-4 w-12 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 w-12 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ) : insights.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight) => (
            <InsightCard
              key={insight.slug}
              slug={insight.slug}
              title={insight.title}
              authorUsername={insight.author.username}
              authorAvatar={insight.author.avatarUrl}
              authorDisplayName={insight.author.displayName}
              publishedAt={insight.publishedAt}
              dateRangeStart={insight.dateRangeStart}
              dateRangeEnd={insight.dateRangeEnd}
              sessionCount={insight.sessionCount}
              messageCount={insight.messageCount}
              commitCount={insight.commitCount}
              whatsWorkingPreview={insight.whatsWorkingPreview}
              voteCount={insight.voteCount}
              commentCount={insight.commentCount}
              sectionTags={insight.sectionTags}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <Sparkles className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No insights shared yet
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Be the first to share your Claude Code insights report!
          </p>
          <a
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Upload Your Report
          </a>
        </div>
      )}
    </div>
  );
}
