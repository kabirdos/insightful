import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import type { SkillKey } from "@/types/insights";
import SkillBadges from "./SkillBadges";

interface ContributorRowProps {
  slug: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  publishedAt: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  dayCount: number | null;
  messageCount: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
  commitCount: number | null;
  detectedSkills: SkillKey[];
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
  publishedAt: string,
): string {
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
  if (start && end) return `${fmt(start)} - ${fmtYear(end)}`;
  if (end) return `Through ${fmtYear(end)}`;
  return new Date(publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ContributorRow({
  slug,
  username,
  displayName,
  avatarUrl,
  publishedAt,
  dateRangeStart,
  dateRangeEnd,
  dayCount,
  messageCount,
  linesAdded,
  linesRemoved,
  fileCount,
  commitCount,
  detectedSkills,
}: ContributorRowProps) {
  const msgsPerWeek = perWeek(messageCount, dayCount);
  const commitsPerWeek = perWeek(commitCount, dayCount);
  const linesAddedPerWeek = perWeek(linesAdded, dayCount);
  const linesRemovedPerWeek = perWeek(linesRemoved, dayCount);

  return (
    <Link
      href={`/insights/${slug}`}
      className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-blue-700"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
          <User className="h-6 w-6" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
          {displayName || username}
        </div>
        <div className="text-xs text-slate-400">
          @{username} ·{" "}
          {formatDateRange(dateRangeStart, dateRangeEnd, publishedAt)}
          {dayCount != null && ` · ${dayCount} days`}
        </div>

        {/* Per-week stats */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-400 dark:text-slate-500">
            per week:
          </span>
          {msgsPerWeek != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {msgsPerWeek}
              </strong>{" "}
              msgs
            </span>
          )}
          {commitsPerWeek != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {commitsPerWeek}
              </strong>{" "}
              commits
            </span>
          )}
          {linesAddedPerWeek != null && (
            <span className="text-green-600 dark:text-green-400">
              +{linesAddedPerWeek}
            </span>
          )}
          {linesRemovedPerWeek != null && (
            <span className="text-red-600 dark:text-red-400">
              -{linesRemovedPerWeek}
            </span>
          )}
        </div>

        {/* Skills badges */}
        {detectedSkills.length > 0 && (
          <div className="mt-2">
            <SkillBadges skills={detectedSkills} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
