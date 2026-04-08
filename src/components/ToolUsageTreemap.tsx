"use client";

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

function formatNumber(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
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
      <div className="flex flex-wrap gap-[3px]">
        {entries.map(([name, value]) => {
          const pct = (value / total) * 100;
          // Minimum width for readability
          const width = Math.max(pct, 4);
          // Scale height based on proportion
          const minHeight = pct > 8 ? 80 : 60;
          return (
            <div
              key={name}
              className={`flex flex-col items-center justify-center rounded-md ${getToolBg(name)} cursor-default transition-opacity hover:opacity-85`}
              style={{
                width: `calc(${width}% - 3px)`,
                minHeight: `${minHeight}px`,
                flexGrow: pct > 15 ? 2 : 1,
              }}
            >
              <span className="text-[13px] font-bold text-white">{name}</span>
              <span className="text-[10px] font-medium text-white/80">
                {formatNumber(value)}
              </span>
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
