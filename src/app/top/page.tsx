"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { normalizeHarnessData, type HarnessData } from "@/types/insights";

interface TopReport {
  slug: string;
  title: string;
  reportType: string;
  publishedAt: string;
  sessionCount: number | null;
  messageCount: number | null;
  commitCount: number | null;
  totalTokens: number | null;
  durationHours: number | null;
  prCount: number | null;
  dayCount: number | null;
  autonomyLabel: string | null;
  detectedSkills: string[];
  harnessData: unknown;
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function perWeek(value: number | null, dayCount: number | null): string | null {
  if (!value || !dayCount || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  const rate = value / weeks;
  if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(1)}M`;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(1)}K`;
  return rate < 10 ? rate.toFixed(1) : Math.round(rate).toLocaleString();
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "tokens", label: "Most Tokens" },
  { value: "sessions", label: "Most Sessions" },
  { value: "commits", label: "Most Commits" },
  { value: "duration", label: "Most Active" },
  { value: "prs", label: "Most PRs" },
];

const REPORT_TYPE_OPTIONS = [
  { value: "", label: "All Reports" },
  { value: "insight-harness", label: "Harness Only" },
  { value: "insights", label: "Standard Only" },
];

const SKILL_FILTERS = [
  { value: "custom_skills", label: "Custom Skills" },
  { value: "parallel_agents", label: "Parallel Agents" },
  { value: "hooks", label: "Hooks" },
  { value: "mcp_servers", label: "MCP Servers" },
  { value: "worktrees", label: "Worktrees" },
  { value: "plan_mode", label: "Plan Mode" },
  { value: "playwright", label: "Playwright" },
];

function ProfileCard({ report }: { report: TopReport }) {
  const hd = report.harnessData
    ? normalizeHarnessData(report.harnessData as HarnessData)
    : null;
  const sessions = report.sessionCount || hd?.stats?.sessionCount || 0;
  const tokensWk = perWeek(report.totalTokens, report.dayCount);
  const sessionsWk = perWeek(sessions, report.dayCount);
  const commitsWk = perWeek(report.commitCount, report.dayCount);

  return (
    <Link
      href={`/insights/${report.slug}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/50"
    >
      <div className="mb-3 flex items-center gap-3">
        {report.author.avatarUrl ? (
          <Image
            src={report.author.avatarUrl}
            alt={report.author.displayName || report.author.username}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
            {(report.author.displayName ||
              report.author.username)[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {report.author.displayName || report.author.username}
            </span>
            {report.reportType === "insight-harness" && (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            @{report.author.username}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {tokensWk && (
          <span className="whitespace-nowrap">
            <strong className="text-slate-700 dark:text-slate-200">
              {tokensWk}
            </strong>{" "}
            tokens/wk
          </span>
        )}
        {sessionsWk && (
          <span className="whitespace-nowrap">
            <strong className="text-slate-700 dark:text-slate-200">
              {sessionsWk}
            </strong>{" "}
            sessions/wk
          </span>
        )}
        {commitsWk && (
          <span className="whitespace-nowrap">
            <strong className="text-slate-700 dark:text-slate-200">
              {commitsWk}
            </strong>{" "}
            commits/wk
          </span>
        )}
      </div>

      {report.autonomyLabel && (
        <div className="mt-2">
          <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {report.autonomyLabel}
          </span>
        </div>
      )}

      {report.detectedSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {report.detectedSkills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              {skill.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default function TopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <TopPageContent />
    </Suspense>
  );
}

function TopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<TopReport[]>([]);
  const [loading, setLoading] = useState(true);

  const sort = searchParams.get("sort") || "newest";
  const reportType = searchParams.get("reportType") || "";
  const skill = searchParams.get("skill") || "";
  const q = searchParams.get("q") || "";

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = { sort, reportType, skill, q, ...overrides };
      for (const [k, v] of Object.entries(merged)) {
        if (v) params.set(k, v);
      }
      return `/top?${params.toString()}`;
    },
    [sort, reportType, skill, q],
  );

  // Loading starts true on first render; subsequent param changes keep
  // existing rows visible while the new fetch runs (no content flash).
  // Avoids the react-hooks/set-state-in-effect cascade.
  useEffect(() => {
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (reportType) params.set("reportType", reportType);
    if (skill) params.set("skill", skill);
    if (q) params.set("q", q);

    fetch(`/api/top?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setReports(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sort, reportType, skill, q]);

  const [searchInput, setSearchInput] = useState(q);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Explore Profiles
      </h1>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Discover how developers use Claude Code — filter by tokens, skills,
        models, and more.
      </p>

      {/* Search bar */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or username..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push(buildUrl({ q: searchInput }));
            }}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <button
          onClick={() => router.push(buildUrl({ q: searchInput }))}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
      </div>

      {/* Filters row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SlidersHorizontal className="h-4 w-4 text-slate-400" />

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => router.push(buildUrl({ sort: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Report type */}
        <select
          value={reportType}
          onChange={(e) =>
            router.push(buildUrl({ reportType: e.target.value }))
          }
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {REPORT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Skill filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {SKILL_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() =>
                router.push(
                  buildUrl({ skill: skill === sf.value ? "" : sf.value }),
                )
              }
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                skill === sf.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          No profiles match your filters. Try adjusting your search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <ProfileCard key={report.slug} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
