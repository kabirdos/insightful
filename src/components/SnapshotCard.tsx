import type { ChartData, SkillKey, InsightsData } from "@/types/insights";
import SkillBadges from "./SkillBadges";

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
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  projectAreas: InsightsData["project_areas"] | null;
}

function perWeek(value: number | null, dayCount: number | null): string | null {
  if (value == null || dayCount == null || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  return Math.round(value / weeks).toLocaleString();
}

function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (end) return `Through ${fmt(end)}`;
  return `From ${fmt(start!)}`;
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
  dateRangeStart,
  dateRangeEnd,
  projectAreas,
}: SnapshotCardProps) {
  const dateRange = formatDateRange(dateRangeStart, dateRangeEnd);

  const sessionsPerWeek = perWeek(sessionCount, dayCount);
  const msgsPerWeek = perWeek(messageCount, dayCount);
  const filesPerWeek = perWeek(fileCount, dayCount);
  const commitsPerWeek = perWeek(commitCount, dayCount);
  const linesAddedPerWeek = perWeek(linesAdded, dayCount);
  const linesRemovedPerWeek = perWeek(linesRemoved, dayCount);

  const areas = projectAreas?.areas ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Date range */}
      {dateRange && (
        <div className="mb-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          {dateRange}
          {dayCount != null && ` (${dayCount} days)`}
        </div>
      )}

      {/* Per-week stats */}
      <div className="flex flex-wrap gap-6 pb-5">
        {sessionsPerWeek != null && (
          <StatCell value={sessionsPerWeek} label="Sessions/wk" />
        )}
        {msgsPerWeek != null && (
          <StatCell value={msgsPerWeek} label="Msgs/wk" />
        )}
        {commitsPerWeek != null && (
          <StatCell value={commitsPerWeek} label="Commits/wk" />
        )}
        {filesPerWeek != null && (
          <StatCell value={filesPerWeek} label="Files/wk" />
        )}
        {linesAddedPerWeek != null && (
          <StatCell
            value={`+${linesAddedPerWeek}`}
            label="Added/wk"
            className="text-green-600 dark:text-green-400"
          />
        )}
        {linesRemovedPerWeek != null && (
          <StatCell
            value={`-${linesRemovedPerWeek}`}
            label="Removed/wk"
            className="text-red-600 dark:text-red-400"
          />
        )}
      </div>

      {/* Projects */}
      {areas.length > 0 && (
        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Projects
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

      {/* Skills & Plugins */}
      {detectedSkills.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Skills & Plugins
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
