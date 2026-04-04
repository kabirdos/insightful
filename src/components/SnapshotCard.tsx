import type { ChartData, SkillKey } from "@/types/insights";
import SkillBadges from "./SkillBadges";
import ToolUsageChart from "./ToolUsageChart";

interface SnapshotCardProps {
  sessionCount: number | null;
  messageCount: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
  dayCount: number | null;
  commitCount: number | null;
  chartData: ChartData | null;
  detectedSkills: SkillKey[];
  keyPattern: string | null;
}

function StatCell({
  value,
  label,
  className = "",
}: {
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </div>
    </div>
  );
}

export default function SnapshotCard({
  sessionCount,
  messageCount,
  linesAdded,
  linesRemoved,
  fileCount,
  dayCount,
  commitCount,
  chartData,
  detectedSkills,
  keyPattern,
}: SnapshotCardProps) {
  const msgsPerWeek =
    messageCount && dayCount ? Math.round(messageCount / (dayCount / 7)) : null;

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-6 pb-5">
        {sessionCount != null && (
          <StatCell value={sessionCount} label="Sessions" />
        )}
        {messageCount != null && (
          <StatCell value={messageCount.toLocaleString()} label="Messages" />
        )}
        {msgsPerWeek != null && (
          <StatCell value={msgsPerWeek.toLocaleString()} label="Msgs/Week" />
        )}
        {linesAdded != null && (
          <StatCell
            value={`+${linesAdded.toLocaleString()}`}
            label="Lines Added"
            className="text-green-600 dark:text-green-400"
          />
        )}
        {linesRemoved != null && (
          <StatCell
            value={`-${linesRemoved.toLocaleString()}`}
            label="Removed"
            className="text-red-600 dark:text-red-400"
          />
        )}
        {fileCount != null && <StatCell value={fileCount} label="Files" />}
        {commitCount != null && (
          <StatCell value={commitCount} label="Commits" />
        )}
      </div>

      {/* Skills badges */}
      {detectedSkills.length > 0 && (
        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Skills & Features Used
          </h3>
          <SkillBadges skills={detectedSkills} />
        </div>
      )}

      {/* Key pattern */}
      {keyPattern && (
        <div className="mt-5 rounded-lg border-l-4 border-blue-500 bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
          <p className="text-sm italic leading-relaxed text-slate-700 dark:text-slate-300">
            &ldquo;{keyPattern}&rdquo;
          </p>
        </div>
      )}

      {/* Tool usage chart — collapsed by default */}
      {chartData?.toolUsage && chartData.toolUsage.length > 0 && (
        <details className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600">
            Top Tools Used ▸
          </summary>
          <div className="mt-3">
            <ToolUsageChart data={chartData.toolUsage} />
          </div>
        </details>
      )}
    </div>
  );
}
