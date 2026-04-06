"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Clock, Flame, Upload } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import {
  normalizeSkills,
  SKILL_METADATA,
  type SkillKey,
} from "@/types/insights";

type SortOption = "newest" | "most_voted" | "trending";

interface InsightSummary {
  slug: string;
  title: string;
  publishedAt: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  dayCount?: number | null;
  sessionCount?: number | null;
  messageCount?: number | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
  fileCount?: number | null;
  commitCount?: number | null;
  detectedSkills: SkillKey[];
  interactionStyle?: { key_pattern?: string } | null;
  atAGlance?: { whats_working?: string } | null;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

function perWeek(
  value: number | null | undefined,
  dayCount: number | null | undefined,
): string | null {
  if (value == null || dayCount == null || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  return Math.round(value / weeks).toLocaleString();
}

function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) return null;
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  const fmtYear = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} – ${fmtYear(end)}`;
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

function SkillBadge({ skill }: { skill: SkillKey }) {
  const meta = SKILL_METADATA[skill];
  if (!meta) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
        meta.colorClass,
      )}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}

function ProfileCard({
  insight,
  featured = false,
}: {
  insight: InsightSummary;
  featured?: boolean;
}) {
  const dateRange = formatDateRange(
    insight.dateRangeStart,
    insight.dateRangeEnd,
  );
  const sessionsWk = perWeek(insight.sessionCount, insight.dayCount);
  const msgsWk = perWeek(insight.messageCount, insight.dayCount);
  const commitsWk = perWeek(insight.commitCount, insight.dayCount);
  const keyPattern = (insight.interactionStyle as Record<string, string> | null)
    ?.key_pattern;

  return (
    <Link
      href={`/insights/${insight.slug}`}
      className={clsx(
        "group block rounded-xl bg-white border transition-all hover:shadow-lg hover:-translate-y-0.5",
        featured
          ? "border-l-4 border-l-blue-500 border-slate-200 p-6 shadow-md"
          : "border-slate-200 border-l-[3px] border-l-transparent p-5 shadow-sm hover:border-l-blue-400",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {insight.author.avatarUrl ? (
          <Image
            src={insight.author.avatarUrl}
            alt=""
            width={featured ? 44 : 36}
            height={featured ? 44 : 36}
            className="rounded-full"
          />
        ) : (
          <div
            className={clsx(
              "flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 font-bold text-white",
              featured ? "h-11 w-11 text-lg" : "h-9 w-9 text-sm",
            )}
          >
            {(insight.author.displayName ||
              insight.author.username)[0].toUpperCase()}
          </div>
        )}
        <div>
          <div
            className={clsx(
              "font-bold text-slate-900 group-hover:text-blue-600",
              featured ? "text-base" : "text-sm",
            )}
          >
            {insight.author.displayName || insight.author.username}
          </div>
          <div className="text-xs text-slate-400">
            @{insight.author.username}
            {dateRange && <> · {dateRange}</>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3">
        {sessionsWk && (
          <div className="text-xs text-slate-500">
            <span className="font-extrabold text-sm text-slate-800">
              {sessionsWk}
            </span>{" "}
            sessions/wk
          </div>
        )}
        {msgsWk && (
          <div className="text-xs text-slate-500">
            <span className="font-extrabold text-sm text-slate-800">
              {msgsWk}
            </span>{" "}
            messages/wk
          </div>
        )}
        {commitsWk && (
          <div className="text-xs text-slate-500">
            <span className="font-extrabold text-sm text-slate-800">
              {commitsWk}
            </span>{" "}
            commits/wk
          </div>
        )}
      </div>

      {/* Badges */}
      {insight.detectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {insight.detectedSkills.slice(0, featured ? 6 : 4).map((skill) => (
            <SkillBadge key={skill} skill={skill} />
          ))}
        </div>
      )}

      {/* Key pattern */}
      {keyPattern && (
        <p className="text-xs italic text-slate-500 truncate">
          &ldquo;{keyPattern}&rdquo;
        </p>
      )}

      {/* Strengths (featured only) */}
      {featured && insight.atAGlance && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 line-clamp-2">
            <strong className="text-slate-600">Strengths:</strong>{" "}
            {(insight.atAGlance as Record<string, string>).whats_working}
          </p>
        </div>
      )}
    </Link>
  );
}

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
        const mapped = reports.map((r: Record<string, unknown>) => ({
          slug: r.slug as string,
          title: r.title as string,
          publishedAt: r.publishedAt as string,
          dateRangeStart: (r.dateRangeStart as string) ?? null,
          dateRangeEnd: (r.dateRangeEnd as string) ?? null,
          dayCount: r.dayCount as number | null,
          sessionCount: r.sessionCount as number | null,
          messageCount: r.messageCount as number | null,
          linesAdded: r.linesAdded as number | null,
          linesRemoved: r.linesRemoved as number | null,
          fileCount: r.fileCount as number | null,
          commitCount: r.commitCount as number | null,
          detectedSkills: normalizeSkills(r.detectedSkills),
          interactionStyle:
            r.interactionStyle as InsightSummary["interactionStyle"],
          atAGlance: r.atAGlance as InsightSummary["atAGlance"],
          author: r.author as InsightSummary["author"],
        }));
        setInsights(mapped);
      })
      .catch(() => setInsights([]))
      .finally(() => setLoading(false));
  }, [sort]);

  const featured = insights[0];
  const grid = insights.slice(1, 7);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="py-12 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            See how other developers use Claude Code
          </h1>
          <p className="mt-3 text-base text-slate-500 sm:text-lg">
            Browse real developer workflows — the tools, skills, plugins, and
            patterns they use across actual coding sessions. All personal data
            removed.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="#profiles"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Browse Profiles
            </a>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-600 px-5 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload Your Insights
            </Link>
          </div>
        </div>
      </section>

      {/* Featured + Grid */}
      <section id="profiles" className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        {/* Sort Tabs */}
        <div className="mb-6 flex items-center gap-4">
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {sortOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSort(value)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  sort === value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-white border border-slate-200 p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-slate-200" />
                  <div className="h-4 w-24 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-3/4 rounded bg-slate-100 mb-2" />
                <div className="h-3 w-1/2 rounded bg-slate-100 mb-3" />
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded bg-slate-100" />
                  <div className="h-5 w-16 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : insights.length > 0 ? (
          <>
            {/* Featured */}
            {featured && (
              <div className="mb-6">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Featured Profile
                </div>
                <ProfileCard insight={featured} featured />
              </div>
            )}

            {/* Grid */}
            {grid.length > 0 && (
              <>
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  Recent Profiles
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {grid.map((insight) => (
                    <ProfileCard key={insight.slug} insight={insight} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              No profiles shared yet
            </h2>
            <p className="text-slate-500 mb-6">
              Be the first to share your Claude Code insights!
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload Your Insights
            </Link>
          </div>
        )}
      </section>

      {/* Harness Profile Upgrade */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        <div className="flex flex-wrap items-center gap-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Mini heatmap preview */}
          <div className="grid shrink-0 grid-cols-8 gap-[3px] opacity-70">
            {[
              0, 1, 2, 0, 3, 1, 2, 4, 1, 3, 0, 2, 1, 4, 3, 0, 2, 0, 4, 3, 0, 1,
              4, 2, 3, 2, 1, 4, 2, 0, 1, 3,
            ].map((level, i) => (
              <div
                key={i}
                className={clsx(
                  "h-5 w-5 rounded-[3px]",
                  level === 0 && "bg-slate-100",
                  level === 1 && "bg-blue-200",
                  level === 2 && "bg-blue-400",
                  level === 3 && "bg-blue-600",
                  level === 4 && "bg-blue-800",
                )}
              />
            ))}
          </div>
          <div className="flex-1 min-w-[240px]">
            <h3 className="text-base font-bold text-slate-900">
              Go deeper with{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-600">
                /harness-profile
              </code>
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              See where your tokens go — agent orchestration, code review,
              planning, debugging, and more. Plus cost analysis and skill
              proficiency scores.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
              <span>
                <span className="mr-1 inline-block h-3.5 w-3.5 rounded-sm bg-slate-100" />{" "}
                10K
              </span>
              <span>
                <span className="mr-1 inline-block h-3.5 w-3.5 rounded-sm bg-blue-200" />{" "}
                50K
              </span>
              <span>
                <span className="mr-1 inline-block h-3.5 w-3.5 rounded-sm bg-blue-400" />{" "}
                100K
              </span>
              <span>
                <span className="mr-1 inline-block h-3.5 w-3.5 rounded-sm bg-blue-800" />{" "}
                250K+
              </span>
            </div>
            <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs font-bold text-slate-600 mb-2">
                Install in 30 seconds:
              </div>
              <div className="rounded-md bg-slate-800 p-3 font-mono text-xs text-slate-200 leading-relaxed">
                <div className="text-slate-500"># Install the skill</div>
                <div>
                  $ <span className="text-blue-400">claude</span> install
                  harness-profile
                </div>
                <div className="mt-1 text-slate-500"># Run it</div>
                <div>
                  $ <span className="text-blue-400">claude</span>{" "}
                  /harness-profile
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Your profile will show token breakdowns, cost tracking, and
                deeper workflow analysis alongside your /insights data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-center text-lg font-bold text-slate-900">
          How It Works
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-xl bg-white border border-slate-200 p-6 text-center shadow-sm">
            <div className="mb-3 text-3xl">📊</div>
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">
              Step 1
            </div>
            <h4 className="mb-2 text-sm font-bold text-slate-900">
              Run /insights
            </h4>
            <p className="text-xs text-slate-500">
              Generate your Claude Code usage report. Takes seconds.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-6 text-center shadow-sm">
            <div className="mb-3 text-3xl">📤</div>
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">
              Step 2
            </div>
            <h4 className="mb-2 text-sm font-bold text-slate-900">
              Upload your insights
            </h4>
            <p className="text-xs text-slate-500">
              Drop the HTML file here. We remove personal data automatically,
              and you can redact any information you&apos;d like before sharing.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-6 text-center shadow-sm">
            <div className="mb-3 text-3xl">🌐</div>
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">
              Step 3
            </div>
            <h4 className="mb-2 text-sm font-bold text-slate-900">
              Share your profile
            </h4>
            <p className="text-xs text-slate-500">
              Get a public page others can browse and learn from.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-blue-50 py-12 text-center">
        <h2 className="text-xl font-extrabold text-slate-900">
          Ready to share your harness?
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Join developers who are learning from each other&apos;s Claude Code
          workflows.
        </p>
        <Link
          href="/upload"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Upload Your Insights
        </Link>
      </section>
    </div>
  );
}
