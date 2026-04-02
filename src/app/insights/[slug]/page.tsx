"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  MessageSquare,
  GitCommitHorizontal,
  Activity,
  Clock,
  Share2,
} from "lucide-react";
import SectionRenderer from "@/components/SectionRenderer";
import CommentSection from "@/components/CommentSection";
import ProjectLinks from "@/components/ProjectLinks";
import type { InsightsData } from "@/types/insights";

interface ReportData {
  id: string;
  slug: string;
  title: string;
  publishedAt: string;
  sessionCount: number | null;
  messageCount: number | null;
  commitCount: number | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  atAGlance: InsightsData["at_a_glance"] | null;
  interactionStyle: InsightsData["interaction_style"] | null;
  projectAreas: InsightsData["project_areas"] | null;
  impressiveWorkflows: InsightsData["what_works"] | null;
  frictionAnalysis: InsightsData["friction_analysis"] | null;
  suggestions: InsightsData["suggestions"] | null;
  onTheHorizon: InsightsData["on_the_horizon"] | null;
  funEnding: InsightsData["fun_ending"] | null;
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  projectLinks: Array<{
    id: string;
    name: string;
    githubUrl: string | null;
    liveUrl: string | null;
    description: string | null;
  }>;
  annotations: Array<{
    sectionKey: string;
    body: string;
  }>;
  voteCounts: Record<string, number>;
  userVotes: Record<string, boolean>;
  commentCount: number;
}

const SECTIONS: Array<{
  key: string;
  type: string;
  label: string;
  field: keyof ReportData;
}> = [
  {
    key: "at_a_glance",
    type: "at_a_glance",
    label: "At a Glance",
    field: "atAGlance",
  },
  {
    key: "interaction_style",
    type: "interaction_style",
    label: "Your Interaction Style",
    field: "interactionStyle",
  },
  {
    key: "project_areas",
    type: "project_areas",
    label: "Project Areas",
    field: "projectAreas",
  },
  {
    key: "impressive_workflows",
    type: "impressive_workflows",
    label: "Impressive Things You Did",
    field: "impressiveWorkflows",
  },
  {
    key: "friction_analysis",
    type: "friction_analysis",
    label: "Where Things Go Wrong",
    field: "frictionAnalysis",
  },
  {
    key: "suggestions",
    type: "suggestions",
    label: "Suggestions",
    field: "suggestions",
  },
  {
    key: "on_the_horizon",
    type: "on_the_horizon",
    label: "On the Horizon",
    field: "onTheHorizon",
  },
  {
    key: "fun_ending",
    type: "fun_ending",
    label: "Fun Ending",
    field: "funEnding",
  },
];

export default function InsightDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/insights/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Report not found");
        return res.json();
      })
      .then((json) => setReport(json.data || json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-200" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            Report not found
          </h2>
          <p className="text-slate-500">
            {error || "This insight report doesn't exist."}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const annotations = Object.fromEntries(
    (report.annotations || []).map((a) => [a.sectionKey, a.body]),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Author bar */}
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/u/${report.author.username}`}>
          {report.author.avatarUrl ? (
            <Image
              src={report.author.avatarUrl}
              alt={report.author.displayName || report.author.username}
              width={48}
              height={48}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
              {(report.author.displayName ||
                report.author.username)[0].toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1">
          <Link
            href={`/u/${report.author.username}`}
            className="font-semibold text-slate-900 hover:text-blue-600"
          >
            {report.author.displayName || report.author.username}
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(report.publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Share2 className="h-4 w-4" />
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Stats banner */}
      <div className="mb-8 flex flex-wrap gap-8 rounded-xl border border-slate-200 bg-white px-6 py-4">
        {report.sessionCount && (
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-lg font-bold text-slate-900">
                {report.sessionCount}
              </div>
              <div className="text-xs uppercase text-slate-500">Sessions</div>
            </div>
          </div>
        )}
        {report.messageCount && (
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-lg font-bold text-slate-900">
                {report.messageCount.toLocaleString()}
              </div>
              <div className="text-xs uppercase text-slate-500">Messages</div>
            </div>
          </div>
        )}
        {report.commitCount && (
          <div className="flex items-center gap-2">
            <GitCommitHorizontal className="h-5 w-5 text-purple-500" />
            <div>
              <div className="text-lg font-bold text-slate-900">
                {report.commitCount}
              </div>
              <div className="text-xs uppercase text-slate-500">Commits</div>
            </div>
          </div>
        )}
        {report.dateRangeStart && report.dateRangeEnd && (
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {report.dateRangeStart} to {report.dateRangeEnd}
              </div>
              <div className="text-xs uppercase text-slate-500">Period</div>
            </div>
          </div>
        )}
      </div>

      {/* Table of contents */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase text-slate-500">
          Sections
        </h3>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.filter((s) => report[s.field]).map((s) => (
            <a
              key={s.key}
              href={`#${s.key}`}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-200"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {SECTIONS.map((section) => {
          const data = report[section.field];
          if (!data) return null;
          return (
            <div key={section.key} id={section.key}>
              <SectionRenderer
                sectionKey={section.key}
                sectionType={section.type}
                data={data}
                reportId={report.id}
                voteCount={report.voteCounts[section.key] || 0}
                voted={report.userVotes[section.key] || false}
                annotation={annotations[section.key]}
              />
            </div>
          );
        })}
      </div>

      {/* Project Links */}
      {report.projectLinks.length > 0 && (
        <div className="mt-8">
          <ProjectLinks links={report.projectLinks} />
        </div>
      )}

      {/* Comments */}
      <div className="mt-12">
        <CommentSection reportId={report.id} comments={[]} />
      </div>
    </div>
  );
}
