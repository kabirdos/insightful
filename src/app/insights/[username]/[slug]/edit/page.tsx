"use client";

import { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import {
  buildReportApiUrl,
  buildReportSubResourceApiUrl,
  buildReportUrl,
} from "@/lib/urls";
import { useSession } from "next-auth/react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import EyeToggle from "@/components/EyeToggle";
import HideableItem from "@/components/HideableItem";
import type {
  CodexHarnessData,
  HarnessData,
  HarnessToolsEnvelope,
  HarnessToolKey,
} from "@/types/insights";
import {
  getClaudeHarnessData,
  getCodexHarnessData,
  listHarnessTools,
  normalizeHarnessEnvelope,
} from "@/types/insights";
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
  isDraft: boolean;
  reportType: string;
  sessionCount: number | null;
  messageCount: number | null;
  commitCount: number | null;
  dayCount: number | null;
  totalTokens: number | null;
  durationHours: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  harnessData: HarnessToolsEnvelope | null;
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

type CodexVisibilitySectionKey =
  | "toolUsage"
  | "skillInventory"
  | "plugins"
  | "cliTools"
  | "workflowData";

const CODEX_VISIBILITY_PREFIX = "tools.codex";

export function buildCodexVisibilityKey(
  sectionKey: CodexVisibilitySectionKey,
  itemKey?: string,
): string {
  return itemKey
    ? `${CODEX_VISIBILITY_PREFIX}.${sectionKey}.${itemKey}`
    : `${CODEX_VISIBILITY_PREFIX}.${sectionKey}`;
}

export function getEditHarnessPreviewData(raw: unknown): {
  availableTools: HarnessToolKey[];
  claudeHarnessData: HarnessData | null;
  codexHarnessData: CodexHarnessData | null;
} {
  return {
    availableTools: listHarnessTools(raw),
    claudeHarnessData: getClaudeHarnessData(raw),
    codexHarnessData: getCodexHarnessData(raw),
  };
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

function CodexRecordSection({
  title,
  sectionKey,
  entries,
  color,
  hiddenSections,
  onToggle,
}: {
  title: string;
  sectionKey: "toolUsage" | "cliTools";
  entries: Array<[string, number]>;
  color: string;
  hiddenSections: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  if (entries.length === 0) return null;

  const visibilityKey = buildCodexVisibilityKey(sectionKey);

  return (
    <HideableCard
      title={title}
      hidden={!!hiddenSections[visibilityKey]}
      onToggle={() => onToggle(visibilityKey)}
    >
      <CollapsibleSection icon="" title={title} defaultOpen={false}>
        <MiniBarChart
          data={entries
            .sort((a, b) => b[1] - a[1])
            .map(([label, value]) => ({ label, value }))}
          title=""
          color={color}
        />
      </CollapsibleSection>
    </HideableCard>
  );
}

function CodexVisibilityPreview({
  codexData,
  hiddenSections,
  onToggle,
}: {
  codexData: CodexHarnessData;
  hiddenSections: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const skillSectionKey = buildCodexVisibilityKey("skillInventory");
  const pluginSectionKey = buildCodexVisibilityKey("plugins");
  const workflowSectionKey = buildCodexVisibilityKey("workflowData");
  const toolEntries = Object.entries(codexData.toolUsage ?? {});
  const cliEntries = Object.entries(codexData.cliTools ?? {});
  const workflowKeys = codexData.workflowData
    ? Object.keys(codexData.workflowData)
    : [];

  return (
    <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Codex Visibility
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Hide Codex-specific sections without changing the uploaded harness
          data.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          {typeof codexData.stats.totalTokens === "number" && (
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
              {codexData.stats.totalTokens.toLocaleString()} tokens
            </span>
          )}
          {typeof codexData.stats.sessionCount === "number" && (
            <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
              {codexData.stats.sessionCount.toLocaleString()} sessions
            </span>
          )}
          {codexData.localOnly && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              local CLI report
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <CodexRecordSection
          title="Codex Tool Usage"
          sectionKey="toolUsage"
          entries={toolEntries}
          color="bg-cyan-500"
          hiddenSections={hiddenSections}
          onToggle={onToggle}
        />

        <CodexRecordSection
          title="Codex CLI Tools"
          sectionKey="cliTools"
          entries={cliEntries}
          color="bg-emerald-500"
          hiddenSections={hiddenSections}
          onToggle={onToggle}
        />

        {codexData.skillInventory.length > 0 && (
          <HideableCard
            title="Codex Skills"
            hidden={!!hiddenSections[skillSectionKey]}
            onToggle={() => onToggle(skillSectionKey)}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {codexData.skillInventory.map((skill, i) => {
                const itemKey = buildItemKey(
                  codexData.skillInventory,
                  i,
                  (s) => s.name,
                );
                const keypath = buildCodexVisibilityKey(
                  "skillInventory",
                  itemKey,
                );
                return (
                  <HideableItem
                    key={itemKey}
                    hidden={!!hiddenSections[keypath]}
                    onToggle={() => onToggle(keypath)}
                  >
                    <div className="h-full rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {skill.name}
                      </div>
                      {skill.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {skill.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-400">
                        {skill.source && <span>{skill.source}</span>}
                        {skill.category && <span>{skill.category}</span>}
                        {typeof skill.calls === "number" && (
                          <span>{skill.calls.toLocaleString()} calls</span>
                        )}
                      </div>
                    </div>
                  </HideableItem>
                );
              })}
            </div>
          </HideableCard>
        )}

        {codexData.plugins.length > 0 && (
          <HideableCard
            title="Codex Plugins"
            hidden={!!hiddenSections[pluginSectionKey]}
            onToggle={() => onToggle(pluginSectionKey)}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {codexData.plugins.map((plugin, i) => {
                const itemKey = buildItemKey(
                  codexData.plugins,
                  i,
                  (p) => p.name,
                );
                const keypath = buildCodexVisibilityKey("plugins", itemKey);
                return (
                  <HideableItem
                    key={itemKey}
                    hidden={!!hiddenSections[keypath]}
                    onToggle={() => onToggle(keypath)}
                  >
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {plugin.name}
                        </span>
                        {typeof plugin.enabled === "boolean" && (
                          <span
                            className={clsx(
                              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                              plugin.enabled
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800",
                            )}
                          >
                            {plugin.enabled ? "on" : "off"}
                          </span>
                        )}
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
          </HideableCard>
        )}

        {workflowKeys.length > 0 && (
          <HideableCard
            title="Codex Workflow Data"
            hidden={!!hiddenSections[workflowSectionKey]}
            onToggle={() => onToggle(workflowSectionKey)}
          >
            <CollapsibleSection
              icon=""
              title="Codex Workflow Data"
              defaultOpen={false}
            >
              <div className="flex flex-wrap gap-2">
                {workflowKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                  >
                    {key}
                  </span>
                ))}
              </div>
            </CollapsibleSection>
          </HideableCard>
        )}

        {toolEntries.length === 0 &&
          cliEntries.length === 0 &&
          codexData.skillInventory.length === 0 &&
          codexData.plugins.length === 0 &&
          workflowKeys.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              This Codex report does not include hideable Codex sections.
            </p>
          )}
      </div>
    </div>
  );
}

export default function EditReportPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // R9b: when the report is missing (404) or it's a draft the viewer
  // doesn't own, surface Next's notFound() instead of the read-only
  // "you can only edit your own reports" message. The 404 path covers
  // anonymous viewers and non-owners of drafts (the API filters those
  // out via draftVisibilityClause). The render-time guard below covers
  // the defense-in-depth case where a draft slips through.
  const [reportNotFound, setReportNotFound] = useState(false);
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>(
    {},
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<Record<
    string,
    unknown
  > | null>(null);
  // When the modal was triggered by the "Make public" path (vs the
  // ordinary "Save Changes" path), confirm runs the publish flow
  // (which router.refresh()es and flips local state) instead of
  // executeSave (which router.push()es to the public URL). Without
  // this flag, confirming a publish with hidden sections would
  // either redirect to a still-draft URL or permanently delete the
  // sections without asking — codex P2 on 779cc45.
  const [pendingIsPublish, setPendingIsPublish] = useState(false);

  useEffect(() => {
    // includeHidden=true surfaces per-report hidden junction rows so
    // the owner can toggle them back on. The server enforces
    // ownership before honoring the flag.
    fetch(`${buildReportApiUrl(username, slug)}?includeHidden=true`)
      .then(async (response) => {
        // 404 covers: report doesn't exist; the viewer is anonymous /
        // non-owner and the report is a draft (API hides drafts from
        // non-owners via draftVisibilityClause). Render-side this
        // becomes a Next.js notFound() instead of the read-only
        // message. Any other error code falls through to the error
        // state. (R9b)
        if (response.status === 404) {
          setReportNotFound(true);
          setLoading(false);
          return;
        }
        const data = await response.json();
        if (data.error) {
          setError(data.error);
        } else {
          const r = data.data ?? data;
          r.harnessData = r.harnessData
            ? normalizeHarnessEnvelope(r.harnessData)
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
      // Reset publish intent — the modal could otherwise have been
      // opened by a prior Make public click whose pendingIsPublish
      // is still set. Without this, confirming would route the
      // plain save through executePublish() and leave the UI saying
      // "public" while the server kept the row as draft. (codex P2
      // on 16de842.)
      setPendingIsPublish(false);
      setShowConfirmModal(true);
      return;
    }

    await executeSave(body);
  };

  const handleConfirmSave = async () => {
    if (!pendingSave) return;
    setShowConfirmModal(false);
    if (pendingIsPublish) {
      await executePublish(pendingSave);
    } else {
      await executeSave(pendingSave);
    }
    setPendingSave(null);
    setPendingIsPublish(false);
  };

  const handleCancelSave = () => {
    setShowConfirmModal(false);
    setPendingSave(null);
    setPendingIsPublish(false);
  };

  /**
   * Underlying PUT for the publish path. Reused by both the
   * straight-publish (no removals) and the confirm-modal (with
   * removals) flows.
   */
  const executePublish = async (body: Record<string, unknown>) => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(buildReportApiUrl(username, slug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Failed to publish");
      }
      // Reflect the new public state in the local fetch cache + the
      // read-only views that already loaded.
      router.refresh();
      // Also flip our local copy so the button disappears immediately
      // — router.refresh re-renders server components only, not this
      // client component's fetched state.
      setReport((prev) => (prev ? { ...prev, isDraft: false } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  /**
   * "Make public" (R10/R11): the only path that flips a report's
   * isDraft from true to false. Server-side, the PUT handler
   * enforces one-way semantics (rejects false → true with 400) and
   * stamps publishedAt to NOW() on the flip. On 200 we
   * `router.refresh()` so the read-only public-page links and the
   * edit-page header reflect the new state without a hard reload.
   *
   * Pending visibility edits (hidden sections / per-item hides) ride
   * along with the publish in a single PUT (codex P1 on fc78b3b).
   * If those pending edits include narrative-section removals, route
   * through the existing destructive-save confirmation modal so the
   * author has a final chance to cancel before content is permanently
   * deleted (codex P2 on 779cc45).
   */
  const handleMakePublic = async () => {
    if (!report) return;
    const body = { ...buildSaveBody(), isDraft: false };
    const removedSections = SECTIONS.filter((s) => hiddenSections[s.key]).map(
      (s) => s.label,
    );
    if (removedSections.length > 0) {
      setPendingSave(body);
      setPendingIsPublish(true);
      setShowConfirmModal(true);
      return;
    }
    await executePublish(body);
  };

  // Hold the spinner until BOTH the report fetch and the next-auth
  // session have resolved. Without the sessionStatus guard the
  // ownership branch below can fire `notFound()` for the legitimate
  // owner of a draft if the API fetch resolves before next-auth's
  // initial session call (codex P1 on the prior commit).
  if (loading || sessionStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // R9b: when the API responded 404, surface Next's notFound() rather
  // than rendering an inline error. This happens for: (a) the report
  // genuinely doesn't exist, (b) a non-owner / anonymous viewer hitting
  // a draft's edit URL — drafts are filtered from non-owner reads by
  // `draftVisibilityClause`, so the API returns 404 from this page's
  // perspective.
  if (reportNotFound) {
    notFound();
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

  // Check ownership. Drafts are not addressable by non-owners (R9b):
  // the API already filters them out via draftVisibilityClause, so
  // hitting this branch with `report.isDraft` would only happen if the
  // API filter regressed. Fail closed with notFound() rather than
  // exposing the read-only message that would tip off a guesser to the
  // existence of someone else's draft. Public reports keep their
  // existing read-only behavior so non-owners with the URL still see a
  // helpful message.
  if (session?.user?.id !== report.author.id) {
    if (report.isDraft) {
      notFound();
    }
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
  const {
    availableTools: availableHarnessTools,
    claudeHarnessData: harnessData,
    codexHarnessData,
  } = getEditHarnessPreviewData(report.harnessData);

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
          {/* R10/R11: "Make public" appears only when the current
              report is a draft. The ownership check above guarantees
              the viewer is the author by the time we render here, so
              the button is implicitly owner-only. */}
          {report.isDraft && (
            <button
              type="button"
              onClick={handleMakePublic}
              disabled={publishing || saving}
              className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              {publishing ? "Publishing…" : "Make public"}
            </button>
          )}
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
      {isHarness && availableHarnessTools.length > 1 && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          This report includes {availableHarnessTools.length} harness tools.
          Claude Code and Codex visibility are edited separately below.
        </div>
      )}

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

          {Object.keys(harnessData.toolUsage).length > 0 && (
            <HideableCard
              title="Tool Usage"
              hidden={!!hiddenSections["toolUsage"]}
              onToggle={() => toggleSection("toolUsage")}
            >
              <ToolUsageTreemap toolUsage={harnessData.toolUsage} />
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

      {isHarness && codexHarnessData && (
        <CodexVisibilityPreview
          codexData={codexHarnessData}
          hiddenSections={hiddenSections}
          onToggle={toggleSection}
        />
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
                    username={username}
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
