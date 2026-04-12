"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Clock, Flame, Upload } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import {
  normalizeSkills,
  SKILL_METADATA,
  type SkillKey,
} from "@/types/insights";
import { homepage as copy } from "@/content/homepage";
import { estimateApiCostUsd } from "@/lib/api-cost";
import { resolveLinesAdded, resolveLinesRemoved } from "@/lib/lines-of-code";

// Parse a skill identifier into its plugin source and short name.
// Skills are in the form "plugin-name:skill-name" or just "skill-name" (custom).
// Copied from WorkflowDiagram.tsx to avoid pulling in mermaid as a homepage dep.
function parseSkillSource(skill: string): {
  plugin: string;
  shortName: string;
} {
  const colonIdx = skill.indexOf(":");
  if (colonIdx === -1) {
    return { plugin: "custom", shortName: skill };
  }
  return {
    plugin: skill.slice(0, colonIdx),
    shortName: skill.slice(colonIdx + 1),
  };
}

type SortOption = "newest" | "most_voted" | "trending";

// ── Data shape ──────────────────────────────────────────────
// Narrow view of HarnessData the homepage card actually reads.
// Mirrors the canonical shape in src/types/insights.ts#HarnessData —
// `models` and `permissionModes` live at the TOP LEVEL, not under `stats`.
// The old version of this type put `models` under `stats` by mistake,
// which meant every card fell back to the default blended rate and
// computed wrong api-cost/wk numbers for mixed-model profiles.
interface HarnessStatsSlice {
  totalTokens?: number;
  durationHours?: number;
  sessionCount?: number;
  commitCount?: number;
}

interface HarnessPluginSlice {
  name: string;
  version?: string;
  marketplace?: string;
}

interface HarnessWorkflowSlice {
  skillInvocations?: Record<string, number>;
  workflowPatterns?: Array<{ sequence: string[]; count: number }>;
}

interface HarnessSlice {
  stats?: HarnessStatsSlice;
  skillInventory?: Array<{ name: string }>;
  plugins?: HarnessPluginSlice[];
  workflowData?: HarnessWorkflowSlice | null;
  /** Top-level per-model token counts used for API cost estimation. */
  models?: Record<string, number>;
  /** 4-way per-model breakdown (input/output/cache_read/cache_create) for accurate cost. */
  perModelTokens?: Record<
    string,
    { input: number; output: number; cache_read: number; cache_create: number }
  > | null;
  /**
   * Git patterns slice — used by the lines-of-code resolver when the
   * scalar `linesAdded` / `linesRemoved` columns on the report are null
   * (real harness uploads today). See src/lib/lines-of-code.ts and #35.
   */
  gitPatterns?: {
    linesAdded?: string | number | null;
    linesRemoved?: string | number | null;
  } | null;
}

interface InsightSummary {
  slug: string;
  title: string;
  publishedAt: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  dayCount: number | null;
  sessionCount: number | null;
  messageCount: number | null;
  commitCount: number | null;
  totalTokens: number | null;
  durationHours: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  detectedSkills: SkillKey[];
  harnessData: HarnessSlice | null;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

// ── Helpers: formatting ─────────────────────────────────────
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

function formatCost(n: number): string {
  if (n === 0) return "$0";
  if (n >= 100) return `$${Math.round(n)}`;
  if (n >= 10) return `$${n.toFixed(0)}`;
  if (n >= 1) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
}

function formatHours(n: number): string {
  if (n >= 100) return `${Math.round(n)}h`;
  if (n >= 10) return `${n.toFixed(0)}h`;
  return `${n.toFixed(1)}h`;
}

// Compact formatter for lines-of-code counts. Keeps one decimal in the
// k-range so values like 18,400 render as "18.4k" (matching the format
// called out in issue #24) and stay readable in the narrow vanity strip.
function formatLines(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

function perWeek(
  value: number | null | undefined,
  dayCount: number | null | undefined,
): number | null {
  if (value == null || dayCount == null || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  return value / weeks;
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

// ── Helpers: cost estimation ────────────────────────────────
// API cost estimation now lives in src/lib/api-cost.ts. The
// `estimateApiCostUsd` helper applies per-model rates against the
// per-model token breakdown shipped in harnessData.models, with a
// Sonnet 4.6 blended fallback when no breakdown is available
// (issue #26).

// ── Helpers: heatmap data (seeded PRNG) ─────────────────────
const HEATMAP_CELLS = 28; // 4 weeks × 7 days

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
  if (days <= 0 || total <= 0) return Array<number>(HEATMAP_CELLS).fill(0);
  let s = hashString(seed);
  const arr = Array<number>(HEATMAP_CELLS).fill(0);
  const effectiveDays = Math.min(days, HEATMAP_CELLS);
  const offset = HEATMAP_CELLS - effectiveDays;
  let remaining = total;
  for (let i = 0; i < effectiveDays - 1; i++) {
    s = (s * 16807 + 12345) % 2147483647;
    const weight = 0.5 + (s % 100) / 100; // 0.5 – 1.5x
    const avg = remaining / (effectiveDays - i);
    const value = Math.max(0, Math.round(avg * weight));
    arr[offset + i] = value;
    remaining -= value;
  }
  arr[HEATMAP_CELLS - 1] = Math.max(0, remaining);
  return arr;
}

// ── Helpers: plugin source → color ──────────────────────────
interface PluginTheme {
  bg: string;
  border: string;
  text: string;
}
const PLUGIN_THEME: Record<string, PluginTheme> = {
  superpowers: {
    bg: "bg-blue-100 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-300",
  },
  "compound-engineering": {
    bg: "bg-purple-100 dark:bg-purple-950/40",
    border: "border-purple-300 dark:border-purple-800",
    text: "text-purple-800 dark:text-purple-300",
  },
  "pr-review-toolkit": {
    bg: "bg-amber-100 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-300",
  },
  "commit-commands": {
    bg: "bg-green-100 dark:bg-green-950/40",
    border: "border-green-300 dark:border-green-800",
    text: "text-green-800 dark:text-green-300",
  },
  "code-review": {
    bg: "bg-pink-100 dark:bg-pink-950/40",
    border: "border-pink-300 dark:border-pink-800",
    text: "text-pink-800 dark:text-pink-300",
  },
  anthropics: {
    bg: "bg-cyan-100 dark:bg-cyan-950/40",
    border: "border-cyan-300 dark:border-cyan-800",
    text: "text-cyan-800 dark:text-cyan-300",
  },
  custom: {
    bg: "bg-slate-100 dark:bg-slate-800",
    border: "border-slate-300 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-300",
  },
};
function pluginTheme(plugin: string): PluginTheme {
  return PLUGIN_THEME[plugin] ?? PLUGIN_THEME.custom;
}

// ── Helpers: workflow chain extraction ──────────────────────
// Returns the dominant workflow pattern as a list of `plugin:skill`
// identifiers, trimmed to `max` steps. Returns an empty array if
// there's no real workflow data — caller should render detectedSkills
// badges as a fallback instead of a fake chain.
function extractWorkflowChain(
  harnessData: HarnessSlice | null,
  max: number = 4,
): string[] {
  const wf = harnessData?.workflowData;
  if (wf?.workflowPatterns && wf.workflowPatterns.length > 0) {
    const top = [...wf.workflowPatterns].sort((a, b) => b.count - a.count)[0];
    if (top?.sequence && top.sequence.length > 0) {
      return top.sequence.slice(0, max);
    }
  }
  if (wf?.skillInvocations && Object.keys(wf.skillInvocations).length > 0) {
    const sorted = Object.entries(wf.skillInvocations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([k]) => k);
    if (sorted.length > 0) return sorted;
  }
  return [];
}

// Extract unique plugin sources from workflow/skill inventory
function extractPluginNames(
  harnessData: HarnessSlice | null,
  chain: string[],
): string[] {
  if (harnessData?.plugins && harnessData.plugins.length > 0) {
    return harnessData.plugins.map((p) => p.name).slice(0, 4);
  }
  // Derive from chain
  const unique = new Set<string>();
  for (const s of chain) {
    const { plugin } = parseSkillSource(s);
    if (plugin !== "custom") unique.add(plugin);
  }
  return Array.from(unique).slice(0, 4);
}

// ── Heatmap level helpers ───────────────────────────────────
function tokenLevelClass(value: number, max: number): string {
  if (value === 0) return "bg-slate-100 dark:bg-slate-800";
  const pct = value / Math.max(max, 1);
  if (pct <= 0.2) return "bg-amber-100 dark:bg-amber-950/50";
  if (pct <= 0.4) return "bg-amber-300 dark:bg-amber-800";
  if (pct <= 0.6) return "bg-amber-400 dark:bg-amber-700";
  if (pct <= 0.8) return "bg-amber-500 dark:bg-amber-600";
  return "bg-amber-700 dark:bg-amber-500";
}

function costLevelClass(value: number, max: number): string {
  if (value === 0) return "bg-slate-100 dark:bg-slate-800";
  const pct = value / Math.max(max, 1);
  if (pct <= 0.2) return "bg-green-100 dark:bg-green-950/50";
  if (pct <= 0.4) return "bg-green-300 dark:bg-green-800";
  if (pct <= 0.6) return "bg-green-400 dark:bg-green-700";
  if (pct <= 0.8) return "bg-green-500 dark:bg-green-600";
  return "bg-green-700 dark:bg-green-500";
}

// ── Sub-components ──────────────────────────────────────────
const sortOptions: {
  value: SortOption;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "newest", label: "Newest", icon: Clock },
  { value: "most_voted", label: "Most Voted", icon: TrendingUp },
  { value: "trending", label: "Trending", icon: Flame },
];

function Avatar({
  insight,
  size = 40,
  className,
}: {
  insight: InsightSummary;
  size?: number;
  className?: string;
}) {
  if (insight.author.avatarUrl) {
    return (
      <Image
        src={insight.author.avatarUrl}
        alt=""
        width={size}
        height={size}
        className={clsx("rounded-full", className)}
      />
    );
  }
  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
    >
      {(insight.author.displayName || insight.author.username)[0].toUpperCase()}
    </div>
  );
}

function TokenHeatmap({
  data,
  max,
  variant = "token",
  size = "sm",
}: {
  data: number[];
  max: number;
  variant?: "token" | "cost";
  size?: "sm" | "md";
}) {
  const levelFn = variant === "cost" ? costLevelClass : tokenLevelClass;
  const gap = size === "md" ? "gap-[3px]" : "gap-[2px]";
  // Cap width so cells stay small squares even when the outer column is wide.
  const maxW = size === "md" ? "max-w-[220px]" : "max-w-[180px]";
  return (
    <div
      className={clsx("grid", gap, maxW)}
      style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
    >
      {data.slice(0, 28).map((value, i) => (
        <div
          key={i}
          className={clsx("aspect-square rounded-[2px]", levelFn(value, max))}
        />
      ))}
    </div>
  );
}

function WorkflowChain({ chain }: { chain: string[] }) {
  if (chain.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chain.map((skill, i) => {
        const { plugin, shortName } = parseSkillSource(skill);
        const theme = pluginTheme(plugin);
        return (
          <span key={`${skill}-${i}`} className="flex items-center gap-1">
            <span
              className={clsx(
                "inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                theme.bg,
                theme.border,
                theme.text,
              )}
            >
              {shortName}
            </span>
            {i < chain.length - 1 && (
              <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">
                →
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function PluginPills({ plugins }: { plugins: string[] }) {
  if (plugins.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {plugins.map((p) => {
        const theme = pluginTheme(p);
        return (
          <span
            key={p}
            className={clsx(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              theme.bg,
              theme.text,
            )}
          >
            {p}
          </span>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
      {children}
    </div>
  );
}

// Fallback when a report has no workflow patterns — show the detected skills
// using their canonical label + colored badge from SKILL_METADATA.
function DetectedSkillBadges({
  skills,
  max,
}: {
  skills: SkillKey[];
  max: number;
}) {
  if (skills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.slice(0, max).map((s) => {
        const meta = SKILL_METADATA[s];
        if (!meta) return null;
        return (
          <span
            key={s}
            className={clsx(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
              meta.colorClass,
            )}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── The main card ───────────────────────────────────────────
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

  const effectiveSessionCount =
    insight.sessionCount ?? insight.harnessData?.stats?.sessionCount ?? null;
  const effectiveTokens =
    insight.totalTokens ?? insight.harnessData?.stats?.totalTokens ?? null;
  const effectiveHours =
    insight.durationHours ?? insight.harnessData?.stats?.durationHours ?? null;

  const tokensWk = perWeek(effectiveTokens, insight.dayCount);
  const sessionsWk = perWeek(effectiveSessionCount, insight.dayCount);
  const hoursWk = perWeek(effectiveHours, insight.dayCount);
  const commitsWk = perWeek(insight.commitCount, insight.dayCount);

  // API cost: estimate total, then per-week slice
  const totalCost = estimateApiCostUsd(
    insight.harnessData?.models,
    effectiveTokens ?? 0,
    insight.harnessData?.perModelTokens,
  );
  const costWk = perWeek(totalCost, insight.dayCount);

  // Skills & plugins counts
  const skillsCount =
    insight.harnessData?.skillInventory?.length ??
    insight.detectedSkills.length;
  const pluginsCount = insight.harnessData?.plugins?.length ?? 0;

  // Workflow chain — top pattern, plugin-colored. Empty array if no real
  // harness workflow data (we'll fall back to detected-skill badges).
  const chain = useMemo(
    () => extractWorkflowChain(insight.harnessData, featured ? 5 : 3),
    [insight.harnessData, featured],
  );
  const pluginNames = useMemo(
    () => extractPluginNames(insight.harnessData, chain),
    [insight.harnessData, chain],
  );

  // Heatmap data — deterministic from slug + totals
  const tokenDaily = useMemo(
    () =>
      generateDailyData(
        effectiveTokens ?? 0,
        insight.dayCount ?? 0,
        `${insight.slug}-tokens`,
      ),
    [effectiveTokens, insight.dayCount, insight.slug],
  );
  const tokenMax = Math.max(...tokenDaily, 1);

  // Scale the token-daily series by the cost-per-token ratio. React Compiler
  // will auto-memoize this; manual useMemo conflicted with its inference.
  const costDaily =
    tokenDaily.every((v) => v === 0) || (effectiveTokens ?? 0) === 0
      ? Array<number>(HEATMAP_CELLS).fill(0)
      : tokenDaily.map(
          (v) => v * (totalCost / Math.max(effectiveTokens ?? 1, 1)),
        );
  const costMax = Math.max(...costDaily, 1);

  const identityName = insight.author.displayName || insight.author.username;
  const hasHeatmap = tokenDaily.some((v) => v > 0);

  return (
    <Link
      href={`/insights/${insight.slug}`}
      className={clsx(
        "group relative block overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900",
        featured
          ? "border-slate-200 dark:border-slate-700"
          : "border-slate-200 dark:border-slate-700",
      )}
    >
      {/* Gradient accent bar */}
      <div
        className={clsx(
          "h-[3px] w-full bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600",
          featured && "h-1",
        )}
      />

      <div className={clsx("p-5", featured && "p-5 sm:p-6")}>
        {/* Header row: identity left, big tokens + cost right */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              insight={insight}
              size={featured ? 48 : 38}
              className="shrink-0"
            />
            <div className="min-w-0">
              <div
                className={clsx(
                  "truncate font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400",
                  featured ? "text-lg" : "text-base",
                )}
              >
                {identityName}
              </div>
              <div className="truncate text-xs text-slate-400">
                @{insight.author.username}
                {dateRange && <> · {dateRange}</>}
              </div>
            </div>
          </div>

          {/* Hero: tokens (blue) + cost (amber) */}
          <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
            {tokensWk != null && (
              <div>
                <div
                  className={clsx(
                    "font-mono font-bold leading-none text-blue-600 dark:text-blue-400",
                    featured ? "text-5xl" : "text-3xl",
                  )}
                >
                  {formatTokens(tokensWk)}
                </div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  tokens / wk
                </div>
              </div>
            )}
            {costWk != null && costWk > 0 && (
              <div>
                <div
                  className={clsx(
                    "font-mono font-bold leading-none text-amber-600 dark:text-amber-400",
                    featured ? "text-2xl" : "text-lg",
                  )}
                >
                  {formatCost(costWk)}
                </div>
                <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  api cost / wk
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vanity metrics strip */}
        <div
          className={clsx(
            "my-4 flex flex-wrap items-stretch border-y border-slate-100 py-2.5 font-mono dark:border-slate-800",
            featured && "my-4 py-2.5",
          )}
        >
          {sessionsWk != null && (
            <div className="flex flex-1 flex-col border-r border-slate-100 px-3 first:pl-0 dark:border-slate-800">
              <span className="text-[15px] font-bold leading-none text-green-600 dark:text-green-400">
                {Math.round(sessionsWk).toLocaleString()}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                sessions / wk
              </span>
            </div>
          )}
          {hoursWk != null && hoursWk > 0 && (
            <div className="flex flex-1 flex-col border-r border-slate-100 px-3 dark:border-slate-800">
              <span className="text-[15px] font-bold leading-none text-cyan-600 dark:text-cyan-400">
                {formatHours(hoursWk)}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                active / wk
              </span>
            </div>
          )}
          <div className="flex flex-1 flex-col border-r border-slate-100 px-3 dark:border-slate-800">
            <span className="text-[15px] font-bold leading-none text-slate-800 dark:text-slate-200">
              {skillsCount}
            </span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              skills
            </span>
          </div>
          {(() => {
            // Lines-of-code: prefer the scalar columns, fall back to the
            // harness JSON string (see src/lib/lines-of-code.ts, #35).
            // Real harness uploads leave the scalars null, so reading
            // `insight.linesAdded` directly used to hide this cell for
            // every user-uploaded report. #29 fixed this in the OG card
            // only; #35 extends the fix to ProfileCard.
            const resolvedAdded = resolveLinesAdded({
              linesAdded: insight.linesAdded,
              linesRemoved: insight.linesRemoved,
              harnessData: insight.harnessData,
            });
            const resolvedRemoved = resolveLinesRemoved({
              linesAdded: insight.linesAdded,
              linesRemoved: insight.linesRemoved,
              harnessData: insight.harnessData,
            });
            const addedDisplay = resolvedAdded ?? 0;
            const removedDisplay = resolvedRemoved ?? 0;
            const hasLines = addedDisplay > 0 || removedDisplay > 0;
            // Harness reports carry only additions in gitPatterns — when
            // the scalar removed is null and only the additions fallback
            // resolved, hide the "/ -0" half so we don't claim zero
            // deletions we can't actually verify.
            const showRemoved = resolvedRemoved != null;
            if (!hasLines) return null;
            return (
              <div className="flex flex-1 flex-col border-l border-slate-100 px-3 last:pr-0 dark:border-slate-800">
                <span className="whitespace-nowrap text-[15px] font-bold leading-none">
                  <span className="text-green-600 dark:text-green-400">
                    +{formatLines(addedDisplay)}
                  </span>
                  {showRemoved && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">
                        {" / "}
                      </span>
                      <span className="text-red-600 dark:text-red-400">
                        -{formatLines(removedDisplay)}
                      </span>
                    </>
                  )}
                </span>
                <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  lines
                </span>
              </div>
            );
          })()}
          {featured && commitsWk != null && commitsWk > 0 && (
            <div className="flex flex-1 flex-col border-l border-slate-100 px-3 dark:border-slate-800">
              <span className="text-[15px] font-bold leading-none text-cyan-600 dark:text-cyan-400">
                {Math.round(commitsWk).toLocaleString()}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                commits / wk
              </span>
            </div>
          )}
        </div>

        {/* Content row: workflow + plugins (left) / heatmap(s) (right).
            Featured cards give the left column more weight since the
            right column is compressed (side-by-side heatmaps). */}
        <div
          className={clsx(
            "grid grid-cols-1 gap-5",
            featured
              ? "sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
              : "sm:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]",
          )}
        >
          <div className="min-w-0 space-y-3">
            {chain.length > 0 ? (
              <div>
                <SectionLabel>Workflow</SectionLabel>
                <WorkflowChain chain={chain} />
              </div>
            ) : (
              insight.detectedSkills.length > 0 && (
                <div>
                  <SectionLabel>Skills</SectionLabel>
                  <DetectedSkillBadges
                    skills={insight.detectedSkills}
                    max={featured ? 8 : 5}
                  />
                </div>
              )
            )}
            {pluginNames.length > 0 && (
              <div>
                <SectionLabel>Plugins</SectionLabel>
                <PluginPills plugins={pluginNames} />
              </div>
            )}
          </div>

          {hasHeatmap && (
            <div
              className={clsx(
                // Featured card: tokens + api cost heatmaps side-by-side
                // so the right column stays short. Small card: just the
                // one tokens heatmap.
                featured ? "grid grid-cols-2 gap-3" : "space-y-3",
              )}
            >
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <SectionLabel>Tokens · 4w</SectionLabel>
                  <span className="font-mono text-[10px] text-slate-500">
                    {formatTokens(effectiveTokens ?? 0)}
                  </span>
                </div>
                <TokenHeatmap
                  data={tokenDaily}
                  max={tokenMax}
                  variant="token"
                  size="sm"
                />
              </div>
              {featured && costWk != null && costWk > 0 && (
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <SectionLabel>API cost · 4w</SectionLabel>
                    <span className="font-mono text-[10px] text-slate-500">
                      {formatCost(totalCost)}
                    </span>
                  </div>
                  <TokenHeatmap
                    data={costDaily}
                    max={costMax}
                    variant="cost"
                    size="sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer strip */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-900/60">
        <span className="truncate">
          insightharness.com/@{insight.author.username}
        </span>
        <span className="shrink-0 text-blue-600 dark:text-blue-400">
          ↗ view
        </span>
      </div>
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────
export default function HomePage() {
  const [insights, setInsights] = useState<InsightSummary[]>([]);
  const [sort, setSort] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(true);

  // Loading is flipped true in the sort-change handler below; the initial
  // render already starts with loading=true, so the effect never needs to
  // set it synchronously (which would trip react-hooks/set-state-in-effect).
  useEffect(() => {
    // Fetch a wider window than we display so the client-side author
    // dedupe (below) doesn't leave the "Recent Profiles" grid short
    // when one author has multiple recent reports. 30 > default 20
    // and comfortably covers 7 unique cards even if most are duplicates.
    fetch(`/api/insights?sort=${sort}&limit=30`)
      .then((r) => r.json())
      .then((json) => {
        const reports = json.data || json.insights || [];
        const mapped: InsightSummary[] = reports.map(
          (r: Record<string, unknown>) => ({
            slug: r.slug as string,
            title: r.title as string,
            publishedAt: r.publishedAt as string,
            dateRangeStart: (r.dateRangeStart as string) ?? null,
            dateRangeEnd: (r.dateRangeEnd as string) ?? null,
            dayCount: (r.dayCount as number) ?? null,
            sessionCount: (r.sessionCount as number) ?? null,
            messageCount: (r.messageCount as number) ?? null,
            commitCount: (r.commitCount as number) ?? null,
            totalTokens: (r.totalTokens as number) ?? null,
            durationHours: (r.durationHours as number) ?? null,
            linesAdded: (r.linesAdded as number) ?? null,
            linesRemoved: (r.linesRemoved as number) ?? null,
            detectedSkills: normalizeSkills(r.detectedSkills),
            harnessData: (r.harnessData as HarnessSlice) ?? null,
            author: r.author as InsightSummary["author"],
          }),
        );
        setInsights(mapped);
      })
      .catch(() => setInsights([]))
      .finally(() => setLoading(false));
  }, [sort]);

  // Dedupe by author so the featured person doesn't also appear in the
  // "Recent Profiles" grid. One card per author.
  const seenAuthors = new Set<string>();
  const uniqueByAuthor: InsightSummary[] = [];
  for (const i of insights) {
    const key = i.author.username;
    if (seenAuthors.has(key)) continue;
    seenAuthors.add(key);
    uniqueByAuthor.push(i);
  }
  const featured = uniqueByAuthor[0];
  const grid = uniqueByAuthor.slice(1, 7);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero */}
      <section className="py-12 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {copy.hero.headline}
          </h1>
          <p className="mt-3 text-base text-slate-500 dark:text-slate-400 sm:text-lg">
            {copy.hero.subtext}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="#profiles"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {copy.hero.primaryCta}
            </a>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-600 px-5 py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
            >
              <Upload className="h-4 w-4" />
              {copy.hero.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* Featured + Grid */}
      <section id="profiles" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        {/* Sort Tabs */}
        <div className="mb-6 flex items-center gap-4">
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {sortOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  if (value === sort) return;
                  setLoading(true);
                  setSort(value);
                }}
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
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="h-[3px] w-full bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600" />
                <div className="p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                    <div className="h-8 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="my-4 h-12 rounded bg-slate-50 dark:bg-slate-800/50" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-16 rounded bg-slate-50 dark:bg-slate-800/50" />
                    <div className="h-16 rounded bg-slate-50 dark:bg-slate-800/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : insights.length > 0 ? (
          <>
            {/* Featured */}
            {featured && (
              <div className="mb-8">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {copy.profiles.featuredLabel}
                </div>
                <ProfileCard insight={featured} featured />
              </div>
            )}

            {/* Grid — 2-col for horizontal cards */}
            {grid.length > 0 && (
              <>
                <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                  {copy.profiles.recentHeading}
                </h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {grid.map((insight) => (
                    <ProfileCard key={insight.slug} insight={insight} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
              {copy.profiles.emptyTitle}
            </h2>
            <p className="mb-6 text-slate-500 dark:text-slate-400">
              {copy.profiles.emptySubtext}
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {copy.profiles.emptyCta}
            </Link>
          </div>
        )}
      </section>

      {/* Upgrade teaser — simplified callout (no basic-vs-rich comparison) */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
          <div className="absolute left-0 right-0 top-0 h-[3px] bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600" />
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl text-white">
              ⚡
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                {copy.upgrade.heading}{" "}
                <code className="rounded bg-slate-900 px-2 py-0.5 text-base font-mono text-slate-100 dark:bg-slate-800">
                  {copy.upgrade.skillName}
                </code>
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Adds token usage, API cost tracking, workflow chains, skill
                inventory, and plugin breakdown — everything you see on the
                cards above.
              </p>
            </div>
            <a
              href="#how-it-works"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              See how it works ↓
            </a>
          </div>
        </div>
      </section>

      {/* How It Works — three commands to a public profile */}
      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-4 pb-16 sm:px-6"
      >
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {copy.howItWorks.heading}
          </h2>
          {"subheading" in copy.howItWorks &&
            (copy.howItWorks as { subheading?: string }).subheading && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {(copy.howItWorks as { subheading: string }).subheading}
              </p>
            )}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {copy.howItWorks.steps.map((step, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-3 text-3xl">{step.icon}</div>
              <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                Step {String(i + 1).padStart(2, "0")}
              </div>
              <h4 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                {step.title}
              </h4>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-slate-900 py-14 text-center dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {copy.footerCta.heading}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {copy.footerCta.subtext}
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {copy.footerCta.cta}
          </Link>
        </div>
      </section>
    </div>
  );
}
