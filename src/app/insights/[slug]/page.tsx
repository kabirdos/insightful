"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Calendar, Pencil, Share2, Sparkles } from "lucide-react";
import SectionRenderer from "@/components/SectionRenderer";
import CommentSection from "@/components/CommentSection";
import ProjectLinks from "@/components/ProjectLinks";
import SnapshotCard from "@/components/SnapshotCard";
import CollapsibleSection from "@/components/CollapsibleSection";
import {
  normalizeSkills,
  normalizeHarnessData,
  type InsightsData,
  type ChartData,
  type SkillKey,
  type HarnessData,
} from "@/types/insights";
import { normalizeChartData } from "@/lib/chart-parser";

// New redesigned components for harness reports
import HeroStats from "@/components/HeroStats";
import HowIWorkCluster from "@/components/HowIWorkCluster";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import SkillCardGrid from "@/components/SkillCardGrid";
import CliToolsDonut from "@/components/CliToolsDonut";
import GitPatternsDisplay from "@/components/GitPatternsDisplay";
import PermissionModeDisplay from "@/components/PermissionModeDisplay";
import HooksSafetyTable from "@/components/HooksSafetyTable";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import WorkflowDiagram from "@/components/WorkflowDiagram";
import MiniBarChart from "@/components/MiniBarChart";
import { isHarnessSectionHidden } from "@/lib/harness-section-visibility";

interface ReportData {
  id: string;
  slug: string;
  title: string;
  authorId: string;
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
  // v3: Harness fields
  reportType: string;
  totalTokens: number | null;
  durationHours: number | null;
  avgSessionMinutes: number | null;
  prCount: number | null;
  autonomyLabel: string | null;
  harnessData: HarnessData | null;
  hiddenHarnessSections: string[];
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  reportProjects: Array<{
    id: string;
    hidden: boolean;
    position: number;
    project: {
      id: string;
      name: string;
      githubUrl: string | null;
      liveUrl: string | null;
      description: string | null;
      ogImage: string | null;
      ogTitle: string | null;
      ogDescription: string | null;
      favicon: string | null;
      siteName: string | null;
    };
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
];

function getSectionSummary(
  sectionKey: string,
  report: ReportData,
): string | null {
  const atAGlance = report.atAGlance;
  const interactionStyle = report.interactionStyle;
  const projectAreas = report.projectAreas;

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
    default:
      return null;
  }
}

export default function InsightDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: session } = useSession();
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
      .then((json) => {
        const raw = json.data || json;
        if (raw) {
          raw.detectedSkills = normalizeSkills(raw.detectedSkills);
          raw.chartData = normalizeChartData(raw.chartData);
          raw.harnessData = normalizeHarnessData(raw.harnessData);
        }
        setReport(raw);
      })
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
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-96 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
            Report not found
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            {error || "This insight report doesn't exist."}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-600 hover:underline dark:text-blue-400"
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

  const isHarness = report.reportType === "insight-harness";
  const hiddenHarnessSections = report.hiddenHarnessSections ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Author bar */}
      <div className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-6 dark:border-slate-700">
        <Link href={`/u/${report.author.username}`}>
          {report.author.avatarUrl ? (
            <Image
              src={report.author.avatarUrl}
              alt={report.author.displayName || report.author.username}
              width={52}
              height={52}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-lg font-bold text-white">
              {(report.author.displayName ||
                report.author.username)[0].toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1">
          <Link
            href={`/u/${report.author.username}`}
            className="font-semibold text-slate-900 hover:text-blue-600 dark:text-white"
          >
            {report.author.displayName || report.author.username}
          </Link>
          {isHarness && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-blue-100 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:from-violet-900/30 dark:to-blue-900/30 dark:border-violet-700 dark:text-violet-300">
              <Sparkles className="h-3 w-3" />
              Insight Harness
            </span>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="h-3.5 w-3.5" />
            {report.dateRangeStart && report.dateRangeEnd
              ? `${new Date(report.dateRangeStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(report.dateRangeEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : new Date(report.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
            {report.dayCount != null && ` · ${report.dayCount} days`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Share2 className="h-4 w-4" />
            {copied ? "Copied!" : "Share"}
          </button>
          {session?.user?.id === report.authorId && (
            <Link
              href={`/insights/${slug}/edit`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* ── Harness Report Layout ── */}
      {isHarness && report.harnessData ? (
        <>
          {/* Hero Stats */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "heroStats") && (
            <HeroStats
              stats={report.harnessData.stats}
              dayCount={report.dayCount}
              sessionCount={
                report.sessionCount ||
                report.harnessData?.stats?.sessionCount ||
                0
              }
              linesAdded={report.linesAdded ?? null}
              linesRemoved={report.linesRemoved ?? null}
            />
          )}

          {/* Activity Heatmap — generated from aggregate stats */}
          {!isHarnessSectionHidden(
            hiddenHarnessSections,
            "activityHeatmap",
          ) && (
            <ActivityHeatmap
              totalSessions={
                report.sessionCount ??
                report.harnessData?.stats?.sessionCount ??
                undefined
              }
              totalTokens={report.totalTokens ?? undefined}
              dayCount={report.dayCount ?? undefined}
              dateRangeStart={report.dateRangeStart ?? undefined}
              slug={slug}
              models={report.harnessData?.models ?? undefined}
            />
          )}

          {/* Project Links — rich stacked cards with OG metadata.
              Rendered directly under the activity card per issue #27. */}
          {report.reportProjects.length > 0 && (
            <div className="mb-6">
              <ProjectLinks
                links={report.reportProjects.map((rp) => rp.project)}
              />
            </div>
          )}

          {/* How I Work cluster: Autonomy + Model Donut + File Ops */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "howIWork") && (
            <HowIWorkCluster harnessData={report.harnessData} />
          )}

          {/* Tool Usage Treemap */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "toolUsage") &&
            Object.keys(report.harnessData.toolUsage).length > 0 && (
            <ToolUsageTreemap toolUsage={report.harnessData.toolUsage} />
          )}

          {/* Workflow Diagrams */}
          {report.harnessData.workflowData &&
            !isHarnessSectionHidden(hiddenHarnessSections, "workflowData") && (
              <WorkflowDiagram
                workflowData={report.harnessData.workflowData}
                agentDispatch={report.harnessData.agentDispatch}
                authorHandle={report.author.username}
              />
            )}

          {/* Skills Card Grid */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "skillInventory") &&
            report.harnessData.skillInventory.length > 0 && (
            <SkillCardGrid skillInventory={report.harnessData.skillInventory} />
          )}

          {/* Plugins */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "plugins") &&
            report.harnessData.plugins.length > 0 && (
            <CollapsibleSection
              icon="🔌"
              iconBgClass="bg-teal-100 dark:bg-teal-900/30"
              title="Plugins"
              defaultOpen={true}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {report.harnessData.plugins.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {p.name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          p.active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                        }`}
                      >
                        {p.active ? "on" : "off"}
                      </span>
                    </div>
                    {(p.version || p.marketplace) && (
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {p.version && `v${p.version}`}
                        {p.version && p.marketplace && " · "}
                        {p.marketplace}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* CLI Tools Donut */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "cliTools") &&
            Object.keys(report.harnessData.cliTools).length > 0 && (
            <CliToolsDonut cliTools={report.harnessData.cliTools} />
          )}

          {/* Git Patterns */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "gitPatterns") && (
            <GitPatternsDisplay gitPatterns={report.harnessData.gitPatterns} />
          )}

          {/* Permission Mode & Safety */}
          {!isHarnessSectionHidden(
            hiddenHarnessSections,
            "permissionModes",
          ) && (
            <PermissionModeDisplay
              permissionModes={report.harnessData.permissionModes}
              featurePills={report.harnessData.featurePills}
            />
          )}

          {/* Hooks & Safety */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "hookDefinitions") && (
            <HooksSafetyTable
              hookDefinitions={report.harnessData.hookDefinitions}
            />
          )}

          {/* Agent Dispatch */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "agentDispatch") &&
            report.harnessData.agentDispatch &&
            report.harnessData.agentDispatch.totalAgents > 0 && (
              <CollapsibleSection
                icon="🤖"
                iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
                title={`Agent Dispatch (${report.harnessData.agentDispatch.totalAgents} agents)`}
                defaultOpen={false}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.keys(report.harnessData.agentDispatch.types).length >
                    0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-slate-500">
                        Agent Types
                      </h4>
                      <MiniBarChart
                        data={Object.entries(
                          report.harnessData.agentDispatch.types,
                        ).map(([label, value]) => ({ label, value }))}
                        title=""
                        color="bg-indigo-500"
                      />
                    </div>
                  )}
                  {Object.keys(report.harnessData.agentDispatch.models).length >
                    0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-slate-500">
                        Model Tiering
                      </h4>
                      <MiniBarChart
                        data={Object.entries(
                          report.harnessData.agentDispatch.models,
                        ).map(([label, value]) => ({ label, value }))}
                        title=""
                        color="bg-purple-500"
                      />
                      {report.harnessData.agentDispatch.backgroundPct > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          {report.harnessData.agentDispatch.backgroundPct}% run
                          in background
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {report.harnessData.agentDispatch.customAgents.length > 0 && (
                  <div className="mt-3">
                    <h4 className="mb-1 text-xs font-semibold text-slate-500">
                      Custom Agents
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {report.harnessData.agentDispatch.customAgents.map(
                        (a) => (
                          <span
                            key={a}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                          >
                            {a}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </CollapsibleSection>
          )}

          {/* Languages */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "languages") &&
            Object.keys(report.harnessData.languages).length > 0 && (
            <CollapsibleSection
              icon="💻"
              iconBgClass="bg-green-100 dark:bg-green-900/30"
              title="Languages"
              defaultOpen={false}
            >
              <MiniBarChart
                data={Object.entries(report.harnessData.languages)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12)
                  .map(([label, value]) => ({ label, value }))}
                title=""
                color="bg-green-500"
              />
            </CollapsibleSection>
          )}

          {/* MCP Servers */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "mcpServers") &&
            Object.keys(report.harnessData.mcpServers).length > 0 && (
            <CollapsibleSection
              icon="🔗"
              iconBgClass="bg-cyan-100 dark:bg-cyan-900/30"
              title="MCP Servers"
              defaultOpen={false}
            >
              <div className="space-y-1">
                {Object.entries(report.harnessData.mcpServers)
                  .sort((a, b) => b[1] - a[1])
                  .map(([server, calls]) => (
                    <div
                      key={server}
                      className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800"
                    >
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {server}
                      </span>
                      <span className="text-xs text-slate-400">
                        {calls.toLocaleString()} calls
                      </span>
                    </div>
                  ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Versions */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "versions") &&
            report.harnessData.versions.length > 0 && (
            <CollapsibleSection
              icon="📦"
              iconBgClass="bg-slate-100 dark:bg-slate-900/30"
              title="Claude Code Versions"
              defaultOpen={false}
            >
              <div className="flex flex-wrap gap-1.5">
                {report.harnessData.versions.map((v) => (
                  <span
                    key={v}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Writeup Sections */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "writeupSections") &&
            report.harnessData.writeupSections.length > 0 && (
            <CollapsibleSection
              icon="📝"
              iconBgClass="bg-blue-100 dark:bg-blue-900/30"
              title="Writeup Analysis"
              defaultOpen={false}
            >
              <div className="space-y-6">
                {report.harnessData.writeupSections.map((section) => (
                  <div key={section.title}>
                    <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {section.title}
                    </h4>
                    <div
                      className="prose prose-sm max-w-none text-slate-600 dark:text-slate-400 [&_p]:mb-2 [&_li]:mb-1"
                      dangerouslySetInnerHTML={{
                        __html: section.contentHtml,
                      }}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Harness Files */}
          {!isHarnessSectionHidden(hiddenHarnessSections, "harnessFiles") &&
            report.harnessData.harnessFiles.length > 0 && (
            <CollapsibleSection
              icon="📁"
              iconBgClass="bg-orange-100 dark:bg-orange-900/30"
              title="Harness File Ecosystem"
              defaultOpen={false}
            >
              <div className="space-y-1">
                {report.harnessData.harnessFiles.map((f) => (
                  <div
                    key={f}
                    className="border-b border-slate-100 py-1 font-mono text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400"
                  >
                    {f}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Narrative Sections */}
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
        </>
      ) : (
        /* ── Standard /insights Report Layout ── */
        <>
          {/* Snapshot Card */}
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
              projectAreas={report.projectAreas}
            />
          </div>

          {/* Project Links — rich stacked cards with OG metadata.
              Rendered directly under the activity/snapshot card per issue #27. */}
          {report.reportProjects.length > 0 && (
            <div className="mb-6">
              <ProjectLinks
                links={report.reportProjects.map((rp) => rp.project)}
              />
            </div>
          )}

          {/* Chart Data Visualizations (wire up orphaned chartData) */}
          {report.chartData && (
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              {report.chartData.toolUsage &&
                report.chartData.toolUsage.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.toolUsage}
                      title="Tool Usage"
                      color="bg-blue-500"
                    />
                  </div>
                )}
              {report.chartData.languages &&
                report.chartData.languages.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.languages}
                      title="Languages"
                      color="bg-green-500"
                    />
                  </div>
                )}
              {report.chartData.requestTypes &&
                report.chartData.requestTypes.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.requestTypes}
                      title="Request Types"
                      color="bg-violet-500"
                    />
                  </div>
                )}
              {report.chartData.sessionTypes &&
                report.chartData.sessionTypes.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.sessionTypes}
                      title="Session Types"
                      color="bg-amber-500"
                    />
                  </div>
                )}
              {report.chartData.responseTimeDistribution &&
                report.chartData.responseTimeDistribution.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.responseTimeDistribution}
                      title="Response Time Distribution"
                      color="bg-cyan-500"
                    />
                  </div>
                )}
              {report.chartData.toolErrors &&
                report.chartData.toolErrors.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.toolErrors}
                      title="Tool Errors"
                      color="bg-red-500"
                    />
                  </div>
                )}
              {report.chartData.whatHelpedMost &&
                report.chartData.whatHelpedMost.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.whatHelpedMost}
                      title="What Helped Most"
                      color="bg-emerald-500"
                    />
                  </div>
                )}
              {report.chartData.outcomes &&
                report.chartData.outcomes.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.outcomes}
                      title="Outcomes"
                      color="bg-teal-500"
                    />
                  </div>
                )}
              {report.chartData.frictionTypes &&
                report.chartData.frictionTypes.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.frictionTypes}
                      title="Friction Types"
                      color="bg-orange-500"
                    />
                  </div>
                )}
              {report.chartData.satisfaction &&
                report.chartData.satisfaction.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.satisfaction}
                      title="Satisfaction"
                      color="bg-pink-500"
                    />
                  </div>
                )}
              {report.chartData.timeOfDay &&
                report.chartData.timeOfDay.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                    <MiniBarChart
                      data={report.chartData.timeOfDay}
                      title="Time of Day"
                      color="bg-indigo-500"
                    />
                  </div>
                )}
            </div>
          )}

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
        </>
      )}

      {/* Comments */}
      <div className="mt-12">
        <CommentSection reportId={report.id} slug={slug} comments={[]} />
      </div>
    </div>
  );
}
