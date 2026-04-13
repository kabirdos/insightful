"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  buildReportApiUrl,
  buildReportSubResourceApiUrl,
  buildReportUrl,
} from "@/lib/urls";
import { useSession } from "next-auth/react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import EyeToggle from "@/components/EyeToggle";
import HideableItem from "@/components/HideableItem";
import type { HarnessData } from "@/types/insights";
import { normalizeHarnessData } from "@/types/insights";
import { buildItemKey } from "@/lib/item-visibility";
import HeroStats from "@/components/HeroStats";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import HowIWorkCluster from "@/components/HowIWorkCluster";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import SkillCardGrid from "@/components/SkillCardGrid";
import WorkflowDiagram from "@/components/WorkflowDiagram";
import CliToolsDonut from "@/components/CliToolsDonut";
import GitPatternsDisplay from "@/components/GitPatternsDisplay";
import PermissionModeDisplay from "@/components/PermissionModeDisplay";
import HooksSafetyTable from "@/components/HooksSafetyTable";
import MiniBarChart from "@/components/MiniBarChart";
import CollapsibleSection from "@/components/CollapsibleSection";
import SectionRenderer from "@/components/SectionRenderer";
import Link from "next/link";
import clsx from "clsx";
import { getHiddenKeypaths } from "@/lib/harness-section-visibility";
import { resolveLinesAdded, resolveLinesRemoved } from "@/lib/lines-of-code";

interface EditProject {
  id: string;
  name: string;
  description: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  ogImage: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  favicon: string | null;
  siteName: string | null;
  metadataFetchedAt: string | null;
}

interface EditReportProject {
  id: string;
  hidden: boolean;
  position: number;
  project: EditProject;
}

interface ReportData {
  id: string;
  slug: string;
  title: string;
  authorId: string;
  reportType: string;
  sessionCount: number | null;
  messageCount: number | null;
  commitCount: number | null;
  dayCount: number | null;
  totalTokens: number | null;
  durationHours: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  harnessData: HarnessData | null;
  hiddenHarnessSections: string[];
  atAGlance: unknown;
  interactionStyle: unknown;
  projectAreas: unknown;
  impressiveWorkflows: unknown;
  frictionAnalysis: unknown;
  suggestions: unknown;
  onTheHorizon: unknown;
  reportProjects: EditReportProject[];
  author: { id: string; username: string; displayName: string | null };
}

// Section config for narrative sections
const SECTIONS = [
  { key: "atAGlance", sectionType: "at_a_glance", label: "At a Glance" },
  {
    key: "interactionStyle",
    sectionType: "interaction_style",
    label: "How They Use Claude Code",
  },
  {
    key: "impressiveWorkflows",
    sectionType: "impressive_workflows",
    label: "Impressive Workflows",
  },
  {
    key: "frictionAnalysis",
    sectionType: "friction_analysis",
    label: "Where Things Go Wrong",
  },
  { key: "suggestions", sectionType: "suggestions", label: "Suggestions" },
  {
    key: "onTheHorizon",
    sectionType: "on_the_horizon",
    label: "On the Horizon",
  },
] as const;

// HideableCard wraps a piece of content with the shared EyeToggle
// component. Used throughout the edit page to give narrative and
// harness subsections a consistent hide/show affordance.
function HideableCard({
  title,
  hidden,
  onToggle,
  children,
}: {
  title: string;
  hidden: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={hidden ? "opacity-40" : ""}>
      <div className="mb-1 flex items-center gap-2">
        <EyeToggle enabled={!hidden} onToggle={onToggle} />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {title}
        </span>
        {hidden && (
          <span className="text-xs text-red-500">Will be removed</span>
        )}
      </div>
      {!hidden && children}
    </div>
  );
}

export default function EditReportPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>(
    {},
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<Record<
    string,
    unknown
  > | null>(null);

  useEffect(() => {
    // includeHidden=true surfaces per-report hidden junction rows so
    // the owner can toggle them back on. The server enforces
    // ownership before honoring the flag.
    fetch(`${buildReportApiUrl(username, slug)}?includeHidden=true`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          const r = data.data ?? data;
          r.harnessData = r.harnessData
            ? normalizeHarnessData(r.harnessData)
            : null;
          if (!Array.isArray(r.reportProjects)) {
            r.reportProjects = [];
          }
          setReport(r);
          setHiddenSections(
            Object.fromEntries(
              (r.hiddenHarnessSections ?? []).map((key: string) => [key, true]),
            ),
          );
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load report");
        setLoading(false);
      });
  }, [username, slug]);

  // ── Project actions ────────────────────────────────────────────
  // Flip a ReportProject.hidden via PATCH. Updates local state
  // optimistically; on failure we revert and show the error.
  // All three async handlers use functional setReport(prev => ...)
  // updates so concurrent actions don't clobber each other. If the
  // user fires a second action while the first is in flight, each
  // handler reads the LATEST state at the moment of the update, not
  // a stale closure snapshot from the original click.

  const toggleProjectHidden = async (projectId: string) => {
    const current = report?.reportProjects.find(
      (rp) => rp.project.id === projectId,
    );
    if (!current) return;
    const nextHidden = !current.hidden;

    // Optimistic update
    setReport((prev) =>
      prev
        ? {
            ...prev,
            reportProjects: prev.reportProjects.map((rp) =>
              rp.project.id === projectId ? { ...rp, hidden: nextHidden } : rp,
            ),
          }
        : prev,
    );

    try {
      const res = await fetch(
        buildReportSubResourceApiUrl(username, slug, `projects/${projectId}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: nextHidden }),
        },
      );
      if (!res.ok) throw new Error("Failed to update project visibility");
    } catch (err) {
      // Revert on failure via functional update.
      setReport((prev) =>
        prev
          ? {
              ...prev,
              reportProjects: prev.reportProjects.map((rp) =>
                rp.project.id === projectId
                  ? { ...rp, hidden: current.hidden }
                  : rp,
              ),
            }
          : prev,
      );
      setError(err instanceof Error ? err.message : "Failed to update project");
    }
  };

  const deleteProjectFromLibrary = async (projectId: string) => {
    if (!report) return;
    if (
      !confirm(
        "Delete this project from your library? It will be removed from every report that references it. This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete project");
      }
      // Remove from local state via functional update so a
      // concurrent toggle/refresh on another project isn't lost.
      setReport((prev) =>
        prev
          ? {
              ...prev,
              reportProjects: prev.reportProjects.filter(
                (rp) => rp.project.id !== projectId,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  const refreshProjectMetadata = async (projectId: string) => {
    if (!report) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/refresh-metadata`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to refresh metadata");
      }
      const body = await res.json();
      const updated: EditProject = body.data;
      // Functional update: if a concurrent delete removed the row,
      // the map leaves prev untouched and this refresh is a no-op.
      setReport((prev) =>
        prev
          ? {
              ...prev,
              reportProjects: prev.reportProjects.map((rp) =>
                rp.project.id === projectId ? { ...rp, project: updated } : rp,
              ),
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh metadata",
      );
    }
  };

  const toggleSection = (key: string) => {
    setHiddenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildSaveBody = () => {
    const body: Record<string, unknown> = {};

    // Null out hidden narrative sections
    for (const section of SECTIONS) {
      if (hiddenSections[section.key]) {
        body[section.key] = null;
      }
    }

    body.hiddenHarnessSections = getHiddenKeypaths(hiddenSections);

    return body;
  };

  const executeSave = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(buildReportApiUrl(username, slug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      router.push(buildReportUrl(username, slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!report) return;

    const body = buildSaveBody();

    // Check if any sections are being removed
    const removedSections = SECTIONS.filter((s) => hiddenSections[s.key]).map(
      (s) => s.label,
    );

    if (removedSections.length > 0) {
      setPendingSave(body);
      setShowConfirmModal(true);
      return;
    }

    await executeSave(body);
  };

  const handleConfirmSave = async () => {
    if (!pendingSave) return;
    setShowConfirmModal(false);
    await executeSave(pendingSave);
    setPendingSave(null);
  };

  const handleCancelSave = () => {
    setShowConfirmModal(false);
    setPendingSave(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-red-600">{error}</p>
        <Link
          href={buildReportUrl(username, slug)}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to report
        </Link>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Report not found.</p>
        <Link
          href={buildReportUrl(username, slug)}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to report
        </Link>
      </div>
    );
  }

  // Check ownership
  if (session?.user?.id !== report.author.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">
          You can only edit your own reports.
        </p>
        <Link
          href={buildReportUrl(username, slug)}
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          Back to report
        </Link>
      </div>
    );
  }

  const isHarness = report.reportType === "insight-harness";
  const harnessData = report.harnessData;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={buildReportUrl(username, slug)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to report
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
        Edit Report Visibility
      </h1>
      <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
        Toggle sections on/off to control what&apos;s visible on your public
        profile. Hidden sections will be removed.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Report preview with harness sections */}
      {isHarness && harnessData && (
        <>
          <HideableCard
            title="Hero Stats"
            hidden={!!hiddenSections["heroStats"]}
            onToggle={() => toggleSection("heroStats")}
          >
            <HeroStats
              stats={harnessData.stats}
              dayCount={report.dayCount}
              sessionCount={
                report.sessionCount || harnessData.stats?.sessionCount || 0
              }
              linesAdded={resolveLinesAdded({
                linesAdded: report.linesAdded,
                linesRemoved: report.linesRemoved,
                harnessData,
              })}
              linesRemoved={resolveLinesRemoved({
                linesAdded: report.linesAdded,
                linesRemoved: report.linesRemoved,
                harnessData,
              })}
            />
          </HideableCard>

          <HideableCard
            title="Activity Heatmap"
            hidden={!!hiddenSections["activityHeatmap"]}
            onToggle={() => toggleSection("activityHeatmap")}
          >
            <ActivityHeatmap
              totalSessions={
                report.sessionCount ??
                harnessData.stats.sessionCount ??
                undefined
              }
              totalTokens={harnessData.stats.totalTokens ?? undefined}
              dayCount={report.dayCount ?? undefined}
              slug={report.slug}
              models={harnessData.models}
              perModelTokens={harnessData.perModelTokens}
            />
          </HideableCard>

          <HideableCard
            title="How I Work"
            hidden={!!hiddenSections["howIWork"]}
            onToggle={() => toggleSection("howIWork")}
          >
            <HowIWorkCluster harnessData={harnessData} />
          </HideableCard>

          {Object.keys(harnessData.toolUsage).length > 0 && (
            <HideableCard
              title="Tool Usage"
              hidden={!!hiddenSections["toolUsage"]}
              onToggle={() => toggleSection("toolUsage")}
            >
              <ToolUsageTreemap toolUsage={harnessData.toolUsage} />
            </HideableCard>
          )}

          {harnessData.workflowData && (
            <HideableCard
              title="Workflow Diagrams"
              hidden={!!hiddenSections["workflowData"]}
              onToggle={() => toggleSection("workflowData")}
            >
              <WorkflowDiagram
                workflowData={harnessData.workflowData}
                agentDispatch={harnessData.agentDispatch}
              />
            </HideableCard>
          )}

          {harnessData.skillInventory.length > 0 && (
            <HideableCard
              title="Skills"
              hidden={!!hiddenSections["skillInventory"]}
              onToggle={() => toggleSection("skillInventory")}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {harnessData.skillInventory.map((skill, i) => {
                  const itemKey = buildItemKey(
                    harnessData.skillInventory,
                    i,
                    (s) => s.name,
                  );
                  const keypath = `skillInventory.${itemKey}`;
                  return (
                    <HideableItem
                      key={itemKey}
                      hidden={!!hiddenSections[keypath]}
                      onToggle={() => toggleSection(keypath)}
                    >
                      <SkillCardGrid skillInventory={[skill]} />
                    </HideableItem>
                  );
                })}
              </div>
            </HideableCard>
          )}

          {harnessData.plugins.length > 0 && (
            <HideableCard
              title="Plugins"
              hidden={!!hiddenSections["plugins"]}
              onToggle={() => toggleSection("plugins")}
            >
              <CollapsibleSection
                icon="🔌"
                iconBgClass="bg-teal-100 dark:bg-teal-900/30"
                title="Plugins"
                defaultOpen={true}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {harnessData.plugins.map((plugin, i) => {
                    const itemKey = buildItemKey(
                      harnessData.plugins,
                      i,
                      (p) => p.name,
                    );
                    const keypath = `plugins.${itemKey}`;
                    return (
                      <HideableItem
                        key={itemKey}
                        hidden={!!hiddenSections[keypath]}
                        onToggle={() => toggleSection(keypath)}
                      >
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {plugin.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                plugin.active
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                              }`}
                            >
                              {plugin.active ? "on" : "off"}
                            </span>
                          </div>
                          {(plugin.version || plugin.marketplace) && (
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {plugin.version && `v${plugin.version}`}
                              {plugin.version && plugin.marketplace && " · "}
                              {plugin.marketplace}
                            </div>
                          )}
                        </div>
                      </HideableItem>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </HideableCard>
          )}

          {Object.keys(harnessData.cliTools).length > 0 && (
            <HideableCard
              title="CLI Tools"
              hidden={!!hiddenSections["cliTools"]}
              onToggle={() => toggleSection("cliTools")}
            >
              <CliToolsDonut cliTools={harnessData.cliTools} />
            </HideableCard>
          )}

          <HideableCard
            title="Git Patterns"
            hidden={!!hiddenSections["gitPatterns"]}
            onToggle={() => toggleSection("gitPatterns")}
          >
            <GitPatternsDisplay gitPatterns={harnessData.gitPatterns} />
          </HideableCard>

          <HideableCard
            title="Permission Mode & Safety"
            hidden={!!hiddenSections["permissionModes"]}
            onToggle={() => toggleSection("permissionModes")}
          >
            <PermissionModeDisplay
              permissionModes={harnessData.permissionModes}
              featurePills={harnessData.featurePills}
            />
          </HideableCard>

          {harnessData.hookDefinitions.length > 0 && (
            <HideableCard
              title="Hooks & Safety"
              hidden={!!hiddenSections["hookDefinitions"]}
              onToggle={() => toggleSection("hookDefinitions")}
            >
              <HooksSafetyTable hookDefinitions={harnessData.hookDefinitions} />
            </HideableCard>
          )}

          {harnessData.agentDispatch &&
            harnessData.agentDispatch.totalAgents > 0 && (
              <HideableCard
                title="Agent Dispatch"
                hidden={!!hiddenSections["agentDispatch"]}
                onToggle={() => toggleSection("agentDispatch")}
              >
                <CollapsibleSection
                  icon="🤖"
                  iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
                  title={`Agent Dispatch (${harnessData.agentDispatch.totalAgents} agents)`}
                  defaultOpen={false}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Object.keys(harnessData.agentDispatch.types).length >
                      0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-slate-500">
                          Agent Types
                        </h4>
                        {Object.entries(harnessData.agentDispatch.types).map(
                          ([typeName, value]) => {
                            const keypath = `agentDispatch.${buildItemKey(
                              Object.keys(harnessData.agentDispatch!.types),
                              Object.keys(
                                harnessData.agentDispatch!.types,
                              ).indexOf(typeName),
                              (k) => k,
                            )}`;
                            return (
                              <HideableItem
                                key={typeName}
                                hidden={!!hiddenSections[keypath]}
                                onToggle={() => toggleSection(keypath)}
                              >
                                <MiniBarChart
                                  data={[{ label: typeName, value }]}
                                  title=""
                                  color="bg-indigo-500"
                                />
                              </HideableItem>
                            );
                          },
                        )}
                      </div>
                    )}
                    {Object.keys(harnessData.agentDispatch.models).length >
                      0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold text-slate-500">
                          Model Tiering
                        </h4>
                        {Object.entries(harnessData.agentDispatch.models).map(
                          ([modelName, value]) => {
                            const keypath = `agentDispatch.${buildItemKey(
                              Object.keys(harnessData.agentDispatch!.models),
                              Object.keys(
                                harnessData.agentDispatch!.models,
                              ).indexOf(modelName),
                              (k) => k,
                            )}`;
                            return (
                              <HideableItem
                                key={modelName}
                                hidden={!!hiddenSections[keypath]}
                                onToggle={() => toggleSection(keypath)}
                              >
                                <MiniBarChart
                                  data={[{ label: modelName, value }]}
                                  title=""
                                  color="bg-purple-500"
                                />
                              </HideableItem>
                            );
                          },
                        )}
                        {harnessData.agentDispatch.backgroundPct > 0 && (
                          <p className="mt-1 text-xs text-slate-400">
                            {harnessData.agentDispatch.backgroundPct}% run in
                            background
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </HideableCard>
            )}

          {Object.keys(harnessData.languages).length > 0 && (
            <HideableCard
              title="Languages"
              hidden={!!hiddenSections["languages"]}
              onToggle={() => toggleSection("languages")}
            >
              <CollapsibleSection
                icon="💻"
                iconBgClass="bg-green-100 dark:bg-green-900/30"
                title="Languages"
                defaultOpen={false}
              >
                {Object.entries(harnessData.languages)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12)
                  .map(([lang, value]) => {
                    const keypath = `languages.${buildItemKey(
                      Object.keys(harnessData.languages),
                      Object.keys(harnessData.languages).indexOf(lang),
                      (k) => k,
                    )}`;
                    return (
                      <HideableItem
                        key={lang}
                        hidden={!!hiddenSections[keypath]}
                        onToggle={() => toggleSection(keypath)}
                      >
                        <MiniBarChart
                          data={[{ label: lang, value }]}
                          title=""
                          color="bg-green-500"
                        />
                      </HideableItem>
                    );
                  })}
              </CollapsibleSection>
            </HideableCard>
          )}

          {Object.keys(harnessData.mcpServers).length > 0 && (
            <HideableCard
              title="MCP Servers"
              hidden={!!hiddenSections["mcpServers"]}
              onToggle={() => toggleSection("mcpServers")}
            >
              <CollapsibleSection
                icon="🔗"
                iconBgClass="bg-cyan-100 dark:bg-cyan-900/30"
                title="MCP Servers"
                defaultOpen={false}
              >
                <div className="space-y-1">
                  {Object.entries(harnessData.mcpServers)
                    .sort((a, b) => b[1] - a[1])
                    .map(([server, calls]) => {
                      const keypath = `mcpServers.${buildItemKey(
                        Object.keys(harnessData.mcpServers),
                        Object.keys(harnessData.mcpServers).indexOf(server),
                        (k) => k,
                      )}`;
                      return (
                        <HideableItem
                          key={server}
                          hidden={!!hiddenSections[keypath]}
                          onToggle={() => toggleSection(keypath)}
                        >
                          <div className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                              {server}
                            </span>
                            <span className="text-xs text-slate-400">
                              {calls.toLocaleString()} calls
                            </span>
                          </div>
                        </HideableItem>
                      );
                    })}
                </div>
              </CollapsibleSection>
            </HideableCard>
          )}

          {harnessData.versions.length > 0 && (
            <HideableCard
              title="Claude Code Versions"
              hidden={!!hiddenSections["versions"]}
              onToggle={() => toggleSection("versions")}
            >
              <CollapsibleSection
                icon="📦"
                iconBgClass="bg-slate-100 dark:bg-slate-900/30"
                title="Claude Code Versions"
                defaultOpen={false}
              >
                <div className="flex flex-wrap gap-1.5">
                  {harnessData.versions.map((version, i) => {
                    const itemKey = buildItemKey(
                      harnessData.versions,
                      i,
                      (v) => v,
                    );
                    const keypath = `versions.${itemKey}`;
                    return (
                      <HideableItem
                        key={itemKey}
                        hidden={!!hiddenSections[keypath]}
                        onToggle={() => toggleSection(keypath)}
                      >
                        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                          {version}
                        </span>
                      </HideableItem>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </HideableCard>
          )}

          {harnessData.writeupSections.length > 0 && (
            <HideableCard
              title="Writeup Analysis"
              hidden={!!hiddenSections["writeupSections"]}
              onToggle={() => toggleSection("writeupSections")}
            >
              <CollapsibleSection
                icon="📝"
                iconBgClass="bg-blue-100 dark:bg-blue-900/30"
                title="Writeup Analysis"
                defaultOpen={false}
              >
                <div className="space-y-6">
                  {harnessData.writeupSections.map((section, i) => {
                    const itemKey = buildItemKey(
                      harnessData.writeupSections,
                      i,
                      (w) => w.title,
                    );
                    const keypath = `writeupSections.${itemKey}`;
                    return (
                      <HideableItem
                        key={itemKey}
                        hidden={!!hiddenSections[keypath]}
                        onToggle={() => toggleSection(keypath)}
                      >
                        <div>
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
                      </HideableItem>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </HideableCard>
          )}

          {harnessData.harnessFiles.length > 0 && (
            <HideableCard
              title="Harness File Ecosystem"
              hidden={!!hiddenSections["harnessFiles"]}
              onToggle={() => toggleSection("harnessFiles")}
            >
              <CollapsibleSection
                icon="📁"
                iconBgClass="bg-orange-100 dark:bg-orange-900/30"
                title="Harness File Ecosystem"
                defaultOpen={false}
              >
                <div className="space-y-1">
                  {harnessData.harnessFiles.map((file, i) => {
                    const itemKey = buildItemKey(
                      harnessData.harnessFiles,
                      i,
                      (f) => f,
                    );
                    const keypath = `harnessFiles.${itemKey}`;
                    return (
                      <HideableItem
                        key={itemKey}
                        hidden={!!hiddenSections[keypath]}
                        onToggle={() => toggleSection(keypath)}
                      >
                        <div className="border-b border-slate-100 py-1 font-mono text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
                          {file}
                        </div>
                      </HideableItem>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </HideableCard>
          )}
        </>
      )}

      {/* Projects attached to this report */}
      {report.reportProjects.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Projects
          </h3>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Hide a project from this report, or delete it from your library
            (which removes it from every report).
          </p>
          <div className="space-y-2">
            {report.reportProjects.map((rp) => (
              <div
                key={rp.id}
                className={clsx(
                  "flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900",
                  rp.hidden && "opacity-50",
                )}
              >
                <div className="pt-0.5">
                  <EyeToggle
                    enabled={!rp.hidden}
                    onToggle={() => toggleProjectHidden(rp.project.id)}
                    showLabel="Show on this report"
                    hideLabel="Hide from this report"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">
                    {rp.project.name}
                  </p>
                  {rp.project.description && (
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {rp.project.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {rp.project.githubUrl || rp.project.liveUrl || "No URL"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => refreshProjectMetadata(rp.project.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    Refresh preview
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProjectFromLibrary(rp.project.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Delete from library
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative sections with eye toggles */}
      <div className="mt-6 space-y-3">
        {SECTIONS.map((section) => {
          const data = report[section.key as keyof ReportData];
          if (!data && !hiddenSections[section.key]) return null;
          const isHidden = !!hiddenSections[section.key];
          return (
            <div key={section.key} className={isHidden ? "opacity-40" : ""}>
              <div className="mb-1 flex items-center gap-2">
                <EyeToggle
                  enabled={!isHidden}
                  onToggle={() => toggleSection(section.key)}
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {section.label}
                </span>
                {isHidden && (
                  <span className="text-xs text-red-500">Will be removed</span>
                )}
              </div>
              {!isHidden && data != null && (
                <CollapsibleSection
                  icon=""
                  title={section.label}
                  defaultOpen={false}
                >
                  <SectionRenderer
                    slug={slug}
                    sectionKey={section.key}
                    sectionType={section.sectionType}
                    data={data}
                    reportId={report.id}
                    voteCount={0}
                    voted={false}
                    readOnly
                  />
                </CollapsibleSection>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button at bottom */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Confirmation modal for destructive saves */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Confirm Removal
              </h2>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              This will permanently remove the following sections from your
              published report:
            </p>
            <ul className="mb-4 space-y-1">
              {SECTIONS.filter((s) => hiddenSections[s.key]).map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {s.label}
                </li>
              ))}
            </ul>
            <p className="mb-6 text-sm font-medium text-red-600 dark:text-red-400">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelSave}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Remove &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
