"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Share2 } from "lucide-react";
import SectionRenderer from "@/components/SectionRenderer";
import CommentSection from "@/components/CommentSection";
import ProjectLinks from "@/components/ProjectLinks";
import SnapshotCard from "@/components/SnapshotCard";
import CollapsibleSection from "@/components/CollapsibleSection";
import type { InsightsData, ChartData, SkillKey } from "@/types/insights";

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
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
  dayCount: number | null;
  msgsPerDay: number | null;
  chartData: ChartData | null;
  detectedSkills: SkillKey[];
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
  label: string;
  dataKey: keyof ReportData;
  sectionType: string;
  icon: string;
  iconBgClass: string;
}> = [
  {
    key: "at_a_glance",
    label: "At a Glance",
    dataKey: "atAGlance",
    sectionType: "at_a_glance",
    icon: "✨",
    iconBgClass: "bg-amber-100 dark:bg-amber-900/30",
  },
  {
    key: "interaction_style",
    label: "How They Use Claude Code",
    dataKey: "interactionStyle",
    sectionType: "interaction_style",
    icon: "🎯",
    iconBgClass: "bg-indigo-100 dark:bg-indigo-900/30",
  },
  {
    key: "project_areas",
    label: "Project Areas",
    dataKey: "projectAreas",
    sectionType: "project_areas",
    icon: "📁",
    iconBgClass: "bg-slate-100 dark:bg-slate-800",
  },
  {
    key: "impressive_workflows",
    label: "Impressive Workflows",
    dataKey: "impressiveWorkflows",
    sectionType: "impressive_workflows",
    icon: "🏆",
    iconBgClass: "bg-green-100 dark:bg-green-900/30",
  },
  {
    key: "friction_analysis",
    label: "Where Things Go Wrong",
    dataKey: "frictionAnalysis",
    sectionType: "friction_analysis",
    icon: "⚡",
    iconBgClass: "bg-red-100 dark:bg-red-900/30",
  },
  {
    key: "suggestions",
    label: "Suggestions",
    dataKey: "suggestions",
    sectionType: "suggestions",
    icon: "💡",
    iconBgClass: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  {
    key: "on_the_horizon",
    label: "On the Horizon",
    dataKey: "onTheHorizon",
    sectionType: "on_the_horizon",
    icon: "🔮",
    iconBgClass: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    key: "fun_ending",
    label: "Fun Ending",
    dataKey: "funEnding",
    sectionType: "fun_ending",
    icon: "🎉",
    iconBgClass: "bg-pink-100 dark:bg-pink-900/30",
  },
];

function getSectionSummary(
  sectionKey: string,
  report: ReportData,
): string | null {
  const atAGlance = report.atAGlance;
  const interactionStyle = report.interactionStyle;
  const projectAreas = report.projectAreas;
  const funEnding = report.funEnding;

  switch (sectionKey) {
    case "interaction_style": {
      if (!interactionStyle?.narrative) return null;
      const sentences = interactionStyle.narrative.match(/[^.!?]+[.!?]+/g);
      return sentences?.slice(0, 2).join(" ").trim() || null;
    }
    case "project_areas": {
      const areas = projectAreas?.areas ?? [];
      if (areas.length === 0) return null;
      const total = areas.reduce((sum, a) => sum + (a.session_count ?? 0), 0);
      const topNames = areas
        .slice(0, 2)
        .map((a) => a.name)
        .join(", ");
      return `${areas.length} project areas across ~${total} sessions. Major projects include ${topNames}.`;
    }
    case "impressive_workflows":
      return atAGlance?.whats_working ?? null;
    case "friction_analysis":
      return atAGlance?.whats_hindering ?? null;
    case "suggestions":
      return atAGlance?.quick_wins ?? null;
    case "on_the_horizon":
      return atAGlance?.ambitious_workflows ?? null;
    case "fun_ending": {
      if (!funEnding?.headline) return null;
      return funEnding.detail
        ? `${funEnding.headline}. ${funEnding.detail.split(".")[0]}.`
        : funEnding.headline;
    }
    default:
      return null;
  }
}

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

      {/* Snapshot */}
      <div className="mb-8">
        <SnapshotCard
          sessionCount={report.sessionCount}
          messageCount={report.messageCount}
          linesAdded={report.linesAdded ?? null}
          linesRemoved={report.linesRemoved ?? null}
          fileCount={report.fileCount ?? null}
          dayCount={report.dayCount ?? null}
          commitCount={report.commitCount}
          chartData={report.chartData}
          detectedSkills={report.detectedSkills}
          keyPattern={report.interactionStyle?.key_pattern ?? null}
        />
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const data = (report as unknown as Record<string, unknown>)[
            section.dataKey
          ];
          if (!data) return null;
          const summary = getSectionSummary(section.key, report);
          const isAtAGlance = section.key === "at_a_glance";
          return (
            <CollapsibleSection
              key={section.key}
              icon={section.icon}
              iconBgClass={section.iconBgClass}
              title={section.label}
              summary={isAtAGlance ? null : summary}
              defaultOpen={isAtAGlance}
            >
              <SectionRenderer
                slug={slug}
                sectionKey={section.key}
                sectionType={section.sectionType}
                data={data}
                reportId={report.id}
                voteCount={report.voteCounts[section.key] ?? 0}
                voted={report.userVotes[section.key] ?? false}
                annotation={annotations[section.key]}
              />
            </CollapsibleSection>
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
        <CommentSection reportId={report.id} slug={slug} comments={[]} />
      </div>
    </div>
  );
}
