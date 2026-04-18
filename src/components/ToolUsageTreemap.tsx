"use client";

import { formatCompactNumber as formatNumber } from "@/lib/number-format";

interface ToolUsageTreemapProps {
  toolUsage: Record<string, number>;
}

// Categorize tools by type for color coding
const TOOL_CATEGORIES: Record<string, { bg: string; label: string }> = {
  Read: { bg: "bg-blue-500", label: "file" },
  Edit: { bg: "bg-blue-600", label: "file" },
  Write: { bg: "bg-blue-400", label: "file" },
  Glob: { bg: "bg-blue-300", label: "file" },
  Grep: { bg: "bg-blue-300", label: "file" },
  Bash: { bg: "bg-amber-500", label: "shell" },
  Agent: { bg: "bg-violet-500", label: "agent" },
  TodoWrite: { bg: "bg-violet-400", label: "agent" },
  Skill: { bg: "bg-violet-400", label: "agent" },
};

function getToolBg(name: string): string {
  return TOOL_CATEGORIES[name]?.bg ?? "bg-slate-500";
}

function getToolCategory(name: string): string {
  return TOOL_CATEGORIES[name]?.label ?? "other";
}

export default function ToolUsageTreemap({ toolUsage }: ToolUsageTreemapProps) {
  const entries = Object.entries(toolUsage).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
        Tool Usage
      </h3>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
      >
        {entries.map(([name, value]) => {
          const pct = (value / total) * 100;
          const minHeight = pct >= 25 ? 118 : pct >= 14 ? 102 : 88;
          return (
            <div
              key={name}
              className={`flex flex-col justify-between rounded-xl ${getToolBg(name)} cursor-default p-3 text-white transition-opacity hover:opacity-90`}
              style={{
                minHeight: `${minHeight}px`,
              }}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
                    {getToolCategory(name)}
                  </span>
                  <span className="text-[11px] font-semibold text-white/80">
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="break-words text-sm font-bold leading-tight">
                  {name}
                </div>
              </div>
              <div className="mt-3 text-lg font-extrabold tracking-tight text-white">
                {formatNumber(value)}
              </div>
            </div>
          );
        })}
      </div>
      {/* Category legend */}
      <div className="mt-3 flex flex-wrap gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            File ops
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Shell
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Agent/orchestration
          </span>
        </div>
      </div>
    </div>
  );
}
