"use client";

import type { HarnessGitPatterns } from "@/types/insights";
import { formatInteger } from "@/lib/number-format";

interface GitPatternsDisplayProps {
  gitPatterns: HarnessGitPatterns;
}

const PREFIX_COLORS: Record<string, { bar: string; badge: string }> = {
  "feat/": {
    bar: "bg-green-500",
    badge:
      "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400",
  },
  "fix/": {
    bar: "bg-blue-500",
    badge: "bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
  },
  "chore/": {
    bar: "bg-blue-400",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  },
  "docs/": {
    bar: "bg-blue-300",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  },
  "refactor/": {
    bar: "bg-violet-500",
    badge:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  },
  "test/": {
    bar: "bg-amber-500",
    badge:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  },
};

function getColors(prefix: string) {
  return (
    PREFIX_COLORS[prefix] ?? {
      bar: "bg-slate-400",
      badge: "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    }
  );
}

export default function GitPatternsDisplay({
  gitPatterns,
}: GitPatternsDisplayProps) {
  if (gitPatterns.prCount === 0 && gitPatterns.commitCount === 0) return null;

  const prefixEntries = Object.entries(gitPatterns.branchPrefixes).sort(
    (a, b) => b[1] - a[1],
  );
  const totalPrefixes = prefixEntries.reduce((sum, [, v]) => sum + v, 0);

  // Determine developer style based on dominant prefix
  const topPrefix = prefixEntries[0]?.[0] ?? "";
  const style = topPrefix.startsWith("feat")
    ? "Feature-driven developer"
    : topPrefix.startsWith("fix")
      ? "Bug-fix focused developer"
      : topPrefix.startsWith("refactor")
        ? "Refactoring-focused developer"
        : "Balanced developer";

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Git Patterns
      </h3>
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        {/* Waffle chart */}
        {totalPrefixes > 0 && (
          <div>
            <div className="grid grid-cols-10 gap-[3px]">
              {prefixEntries.flatMap(([prefix, count]) => {
                const cells = Math.max(
                  1,
                  Math.round((count / totalPrefixes) * 100),
                );
                const colors = getColors(prefix);
                return Array.from({ length: cells }, (_, i) => (
                  <div
                    key={`${prefix}-${i}`}
                    className={`h-[14px] w-[14px] rounded-[2px] ${colors.bar}`}
                  />
                ));
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {prefixEntries.map(([prefix, count]) => {
                const pct =
                  totalPrefixes > 0
                    ? Math.round((count / totalPrefixes) * 100)
                    : 0;
                const colors = getColors(prefix);
                return (
                  <div key={prefix} className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-sm ${colors.bar}`} />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {prefix} {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div>
          <div className="mb-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {style}
          </div>
          <div className="mb-5 flex gap-6">
            {gitPatterns.prCount > 0 && (
              <div className="text-center">
                <div className="text-[28px] font-extrabold text-blue-500">
                  {formatInteger(gitPatterns.prCount)}
                </div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  PRs
                </div>
              </div>
            )}
            {gitPatterns.commitCount > 0 && (
              <div className="text-center">
                <div className="text-[28px] font-extrabold text-blue-700 dark:text-blue-400">
                  {formatInteger(gitPatterns.commitCount)}
                </div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Commits
                </div>
              </div>
            )}
            {gitPatterns.linesAdded !== "0" && (
              <div className="text-center">
                <div className="text-[28px] font-extrabold text-green-500">
                  +{gitPatterns.linesAdded}
                </div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Lines
                </div>
              </div>
            )}
          </div>

          {/* Branch prefix bars */}
          {prefixEntries.length > 0 && (
            <>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Branch Prefix Breakdown
              </div>
              <div className="flex flex-col gap-1">
                {prefixEntries.map(([prefix, count]) => {
                  const pct =
                    totalPrefixes > 0
                      ? Math.round((count / totalPrefixes) * 100)
                      : 0;
                  const colors = getColors(prefix);
                  return (
                    <div key={prefix} className="flex items-center gap-2">
                      <span className="w-14 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                        {prefix}
                      </span>
                      <div className="h-3.5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded ${colors.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[11px] text-slate-500 dark:text-slate-400">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
