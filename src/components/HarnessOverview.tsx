import type { HarnessData } from "@/types/insights";

interface HarnessOverviewProps {
  harnessData: HarnessData;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

export default function HarnessOverview({ harnessData }: HarnessOverviewProps) {
  const { stats, autonomy, featurePills } = harnessData;

  return (
    <div className="space-y-4">
      {/* Extra stats row */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Harness Stats
        </div>
        <div className="flex flex-wrap gap-6">
          {stats.totalTokens > 0 && (
            <StatCell value={formatNumber(stats.totalTokens)} label="Tokens" />
          )}
          {stats.durationHours > 0 && (
            <StatCell value={`${stats.durationHours}h`} label="Duration" />
          )}
          {stats.avgSessionMinutes > 0 && (
            <StatCell
              value={`${Math.round(stats.avgSessionMinutes)}m`}
              label="Avg Session"
            />
          )}
          {stats.skillsUsedCount > 0 && (
            <StatCell value={stats.skillsUsedCount.toString()} label="Skills" />
          )}
          {stats.hooksCount > 0 && (
            <StatCell value={stats.hooksCount.toString()} label="Hooks" />
          )}
          {stats.prCount > 0 && (
            <StatCell value={stats.prCount.toString()} label="PRs" />
          )}
        </div>
      </div>

      {/* Autonomy box */}
      {autonomy.label && (
        <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white dark:from-slate-700 dark:to-slate-800">
          <div className="text-xl font-bold">{autonomy.label}</div>
          {autonomy.userMessages > 0 && autonomy.assistantMessages > 0 && (
            <div className="mt-1 text-sm text-slate-300">
              For every message you send, Claude sends ~
              {Math.round(autonomy.assistantMessages / autonomy.userMessages)}{" "}
              back
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 border-t border-white/10 pt-3">
            {autonomy.userMessages > 0 && (
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-white">
                  {autonomy.userMessages.toLocaleString()}
                </span>{" "}
                you sent
              </div>
            )}
            {autonomy.assistantMessages > 0 && (
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-white">
                  {autonomy.assistantMessages.toLocaleString()}
                </span>{" "}
                Claude sent
              </div>
            )}
            {autonomy.turnCount > 0 && (
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-white">
                  {autonomy.turnCount.toLocaleString()}
                </span>{" "}
                turns
              </div>
            )}
            {autonomy.errorRate && autonomy.errorRate !== "0%" && (
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-white">
                  {autonomy.errorRate}
                </span>{" "}
                error rate
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature pills */}
      {featurePills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {featurePills.map((pill) => (
            <span
              key={pill.name}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                pill.active
                  ? "border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                  : "border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50"
              }`}
            >
              {pill.name}
              {pill.value && ` (${pill.value})`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
