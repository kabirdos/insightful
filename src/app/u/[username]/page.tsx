"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { User, Heart, FileText, Calendar } from "lucide-react";
import InsightCard from "@/components/InsightCard";

interface UserProfile {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
  totalReports: number;
  totalVotes: number;
  reports: {
    slug: string;
    title: string;
    publishedAt: string;
    dateRangeStart?: string | null;
    dateRangeEnd?: string | null;
    sessionCount?: number | null;
    messageCount?: number | null;
    commitCount?: number | null;
    whatsWorkingPreview?: string | null;
    voteCount: number;
    commentCount: number;
    sectionTags: string[];
  }[];
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((json) => setProfile(json.data ?? json))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="h-6 w-32 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
              <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <User className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
          User not found
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No user with username &quot;{username}&quot; was found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Profile Header */}
      <div className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt=""
            width={80}
            height={80}
            className="rounded-full mb-3 sm:mb-0"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 mb-3 sm:mb-0">
            <User className="h-8 w-8" />
          </div>
        )}

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {profile.displayName || profile.username}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            @{profile.username}
          </p>
          {profile.bio && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {profile.bio}
            </p>
          )}

          {/* Stats */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <FileText className="h-4 w-4" />
              <span className="font-semibold">{profile.totalReports}</span>{" "}
              reports
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <Heart className="h-4 w-4" />
              <span className="font-semibold">{profile.totalVotes}</span> votes
              received
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
              <Calendar className="h-4 w-4" />
              Joined{" "}
              {new Date(profile.createdAt).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Reports */}
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Shared Reports
      </h2>
      {profile.reports.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {profile.reports.map((report) => (
            <InsightCard
              key={report.slug}
              slug={report.slug}
              title={report.title}
              authorUsername={profile.username}
              authorAvatar={profile.avatarUrl}
              authorDisplayName={profile.displayName}
              publishedAt={report.publishedAt}
              dateRangeStart={report.dateRangeStart}
              dateRangeEnd={report.dateRangeEnd}
              sessionCount={report.sessionCount}
              messageCount={report.messageCount}
              commitCount={report.commitCount}
              whatsWorkingPreview={report.whatsWorkingPreview}
              voteCount={report.voteCount}
              commentCount={report.commentCount}
              sectionTags={report.sectionTags}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No reports shared yet.
          </p>
        </div>
      )}
    </div>
  );
}
