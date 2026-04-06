"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Clock, Flame, Upload, Copy, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import {
  normalizeSkills,
  SKILL_METADATA,
  type SkillKey,
} from "@/types/insights";
import { homepage as copy } from "@/content/homepage";

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

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2">
      <code className="flex-1 truncate font-mono text-xs text-slate-200">
        {text}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded p-1 text-slate-400 hover:text-white transition-colors"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
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
            <strong className="text-slate-600">
              {copy.profiles.strengthsLabel}
            </strong>{" "}
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
            {copy.hero.headline}
          </h1>
          <p className="mt-3 text-base text-slate-500 sm:text-lg">
            {copy.hero.subtext}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="#profiles"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              {copy.hero.primaryCta}
            </a>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-600 px-5 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {copy.hero.secondaryCta}
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
                  {copy.profiles.featuredLabel}
                </div>
                <ProfileCard insight={featured} featured />
              </div>
            )}

            {/* Grid */}
            {grid.length > 0 && (
              <>
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  {copy.profiles.recentHeading}
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
              {copy.profiles.emptyTitle}
            </h2>
            <p className="text-slate-500 mb-6">{copy.profiles.emptySubtext}</p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {copy.profiles.emptyCta}
            </Link>
          </div>
        )}
      </section>

      {/* Harness Profile Upgrade */}
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg">
              ⚡
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {copy.upgrade.heading}{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-600">
                  {copy.upgrade.skillName}
                </code>
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {copy.upgrade.description}
              </p>
            </div>
          </div>

          {/* Comparison table */}
          <div className="mb-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    {copy.upgrade.table.headers.feature}
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                    {copy.upgrade.table.headers.insights}
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50">
                    {copy.upgrade.table.headers.harness}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {copy.upgrade.table.shared.map((feature) => (
                  <tr key={feature}>
                    <td className="px-4 py-2 text-slate-600">{feature}</td>
                    <td className="px-4 py-2 text-center text-green-600">✓</td>
                    <td className="px-4 py-2 text-center text-green-600 bg-blue-50/30">
                      ✓
                    </td>
                  </tr>
                ))}
                {copy.upgrade.table.harnessOnly.map((feature) => (
                  <tr key={feature} className="bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-700 font-medium">
                      {feature}
                    </td>
                    <td className="px-4 py-2 text-center text-slate-300">—</td>
                    <td className="px-4 py-2 text-center text-green-600 bg-blue-50/30 font-semibold">
                      ✓
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Install + copy */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs font-bold text-slate-600 mb-2">
                {copy.upgrade.installTitle}
              </div>
              <CopyBlock text={copy.upgrade.installCommand} />
              <p className="mt-2 text-[11px] text-slate-400">
                {copy.upgrade.installHint}{" "}
                <code className="bg-slate-200 px-1 rounded text-[10px]">
                  {copy.upgrade.installSlashCommand}
                </code>{" "}
                {copy.upgrade.installSuffix}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <div className="text-xs font-bold text-slate-600 mb-2">
                {copy.upgrade.promptTitle}
              </div>
              <CopyBlock text={copy.upgrade.promptCommand} />
              <p className="mt-2 text-[11px] text-slate-400">
                {copy.upgrade.promptHint}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
            <a
              href={copy.upgrade.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              {copy.upgrade.githubLabel}
            </a>
            <span>•</span>
            <span>{copy.upgrade.privacyNote}</span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-center text-lg font-bold text-slate-900">
          {copy.howItWorks.heading}
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {copy.howItWorks.steps.map((step, i) => (
            <div
              key={i}
              className="rounded-xl bg-white border border-slate-200 p-6 text-center shadow-sm"
            >
              <div className="mb-3 text-3xl">{step.icon}</div>
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">
                Step {i + 1}
              </div>
              <h4 className="mb-2 text-sm font-bold text-slate-900">
                {step.title}
              </h4>
              <p className="text-xs text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-blue-50 py-12 text-center">
        <h2 className="text-xl font-extrabold text-slate-900">
          {copy.footerCta.heading}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{copy.footerCta.subtext}</p>
        <Link
          href="/upload"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          {copy.footerCta.cta}
        </Link>
      </section>
    </div>
  );
}
