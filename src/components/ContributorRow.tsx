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
  dayCount: number | null;
  messageCount: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
  commitCount: number | null;
  detectedSkills: SkillKey[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
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
  dayCount,
  messageCount,
  linesAdded,
  linesRemoved,
  fileCount,
  commitCount,
  detectedSkills,
}: ContributorRowProps) {
  // Per-week normalization for comparability
  const msgsPerWeek =
    messageCount && dayCount && dayCount > 0
      ? Math.round(messageCount / (dayCount / 7))
      : null;

  const totalLines = (linesAdded ?? 0) + (linesRemoved ?? 0);
  const linesPerWeek =
    totalLines && dayCount && dayCount > 0
      ? Math.round(totalLines / (dayCount / 7))
      : null;

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
          @{username} · {formatDate(publishedAt)}
          {dayCount != null && ` · ${dayCount} days tracked`}
        </div>

        {/* Stats row */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {msgsPerWeek != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {msgsPerWeek.toLocaleString()}
              </strong>{" "}
              msgs/wk
            </span>
          )}
          {linesPerWeek != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {linesPerWeek.toLocaleString()}
              </strong>{" "}
              lines/wk
            </span>
          )}
          {linesAdded != null && (
            <span className="text-green-600 dark:text-green-400">
              +{linesAdded.toLocaleString()} added
            </span>
          )}
          {linesRemoved != null && (
            <span className="text-red-600 dark:text-red-400">
              -{linesRemoved.toLocaleString()} removed
            </span>
          )}
          {fileCount != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {fileCount}
              </strong>{" "}
              files
            </span>
          )}
          {commitCount != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {commitCount}
              </strong>{" "}
              commits
            </span>
          )}
        </div>

        {/* Skills badges */}
        {detectedSkills.length > 0 && (
          <div className="mt-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Skills Used
            </div>
            <SkillBadges skills={detectedSkills} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
