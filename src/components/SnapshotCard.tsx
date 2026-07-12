import type { ChartData, SkillKey, InsightsData } from "@/types/insights";
import SkillBadges from "./SkillBadges";
import { statLabel } from "@/lib/metric-labels";

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
  projectAreas: InsightsData["project_areas"] | null;
}

function perWeek(value: number | null, dayCount: number | null): string | null {
  // A 0 value (e.g. a sourceless commitCount/linesAdded) must yield null, not
  // "0" — rendering "0/wk" is a silent-zero false claim (issue #29). `!value`
  // also drops null/undefined/NaN.
  if (!value || dayCount == null || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  return Math.round(value / weeks).toLocaleString();
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
  detectedSkills,
  keyPattern,
  projectAreas,
}: SnapshotCardProps) {
  const sessionsPerWeek = perWeek(sessionCount, dayCount);
  const msgsPerWeek = perWeek(messageCount, dayCount);
  const filesPerWeek = perWeek(fileCount, dayCount);
  const commitsPerWeek = perWeek(commitCount, dayCount);
  const linesAddedPerWeek = perWeek(linesAdded, dayCount);
  const linesRemovedPerWeek = perWeek(linesRemoved, dayCount);

  // Filter out known plugins/tools from project areas
  const KNOWN_TOOLS = new Set([
    "superpowers",
    "claude-code-plugins",
    "claude-code",
    "plugins",
    "mcp-servers",
    "mcp",
    ".claude",
  ]);
  const areas = (projectAreas?.areas ?? []).filter(
    (a) => !KNOWN_TOOLS.has(a.name.toLowerCase()),
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Per-week stats */}
      <div className="pb-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Weekly Averages
        </div>
        <div className="flex flex-wrap gap-6">
          {sessionsPerWeek != null && (
            <StatCell value={sessionsPerWeek} label={statLabel("sessions")} />
          )}
          {msgsPerWeek != null && (
            <StatCell value={msgsPerWeek} label={statLabel("messages")} />
          )}
          {commitsPerWeek != null && (
            <StatCell value={commitsPerWeek} label={statLabel("commits")} />
          )}
          {filesPerWeek != null && (
            <StatCell value={filesPerWeek} label={statLabel("files")} />
          )}
          {linesAddedPerWeek != null && (
            <StatCell
              value={`+${linesAddedPerWeek}`}
              label={statLabel("linesAdded")}
              className="text-green-600 dark:text-green-400"
            />
          )}
          {linesRemovedPerWeek != null && (
            <StatCell
              value={`-${linesRemovedPerWeek}`}
              label={statLabel("linesRemoved")}
              className="text-red-600 dark:text-red-400"
            />
          )}
        </div>
      </div>

      {/* Projects */}
      {areas.length > 0 && (
        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Project Areas
          </h3>
          <div className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <div
                key={area.name}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {area.name}
                </span>
                {area.session_count != null && (
                  <span className="ml-1.5 text-xs text-slate-400">
                    {area.session_count} sessions
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {detectedSkills.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {statLabel("skills")}
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
    </div>
  );
}
