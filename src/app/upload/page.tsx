"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import {
  Upload,
  Check,
  ArrowLeft,
  ArrowRight,
  FileText,
  AlertTriangle,
  Copy,
  ClipboardCheck,
  Link as LinkIcon,
  Plus,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import clsx from "clsx";
import type {
  ParsedInsightsReport,
  RedactionItem,
  InsightsData,
} from "@/types/insights";
import { applyRedactions } from "@/lib/redaction";
import { normalizeChartData } from "@/lib/chart-parser";
import { normalizeSkills } from "@/types/insights";
import SectionRenderer from "@/components/SectionRenderer";
import SnapshotCard from "@/components/SnapshotCard";
import CollapsibleSection from "@/components/CollapsibleSection";
import HeroStats from "@/components/HeroStats";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import SkillCardGrid from "@/components/SkillCardGrid";
import CliToolsDonut from "@/components/CliToolsDonut";
import GitPatternsDisplay from "@/components/GitPatternsDisplay";
import PermissionModeDisplay from "@/components/PermissionModeDisplay";
import HooksSafetyTable from "@/components/HooksSafetyTable";
import WorkflowDiagram from "@/components/WorkflowDiagram";
import HowIWorkCluster from "@/components/HowIWorkCluster";
import ProjectLinks from "@/components/ProjectLinks";
import MiniBarChart from "@/components/MiniBarChart";
import {
  getHiddenHarnessSections,
  stripHiddenHarnessData,
} from "@/lib/harness-section-visibility";
import { resolveLinesAdded, resolveLinesRemoved } from "@/lib/lines-of-code";

type Step = "upload" | "projects" | "review";

/** Library Project as returned by GET /api/projects. */
interface LibraryProject {
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

/** Input shape for the add/edit form. */
interface ProjectFormInput {
  name: string;
  githubUrl: string;
  liveUrl: string;
  description: string;
}

const EMPTY_FORM: ProjectFormInput = {
  name: "",
  githubUrl: "",
  liveUrl: "",
  description: "",
};

const INSIGHTS_PATH = "~/.claude/usage-data/report.html";
const HARNESS_PATH = "~/.claude/usage-data/insight-harness.html";

const SAMPLE_PROFILE_SLUG = "kabirdos-20260412-5x373x";
const SAMPLE_PROFILE_HREF = `/insights/${SAMPLE_PROFILE_SLUG}`;
const SAMPLE_PROFILE_OG = `/api/og/${SAMPLE_PROFILE_SLUG}`;
const SAMPLE_PROFILE_LABEL = "Kabir's Insight Harness — Apr 2026";

function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const doCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={doCopy}
      className={clsx(
        "shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
        copied
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-white/15 border border-white/20 text-slate-200 hover:bg-white/30 dark:text-slate-300",
      )}
    >
      {copied ? (
        <span className="flex items-center gap-1">
          <ClipboardCheck className="h-3 w-3" /> Copied
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Copy className="h-3 w-3" /> {label}
        </span>
      )}
    </button>
  );
}

function CommandBlock({
  command,
  small = false,
}: {
  command: string;
  small?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2.5 font-mono dark:bg-slate-900",
        small ? "text-[11px]" : "text-xs",
      )}
    >
      <span className="text-slate-500">&gt; </span>
      <code className="min-w-0 flex-1 overflow-x-auto text-slate-200">
        {command}
      </code>
      <CopyButton text={command} />
    </div>
  );
}

function MiniDropZone({
  fileInputRef,
  handleFileInput,
  handleDrop,
  dragOver,
  setDragOver,
  path,
  loading,
  filename,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  path: string;
  loading: boolean;
  filename: string;
}) {
  const [pathCopied, setPathCopied] = useState(false);
  const copyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(path);
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 2000);
  };

  return (
    <div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (!loading) fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.stopPropagation();
          handleDrop(e);
        }}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors",
          dragOver
            ? "border-blue-500 bg-blue-100 dark:border-blue-400 dark:bg-blue-950/50"
            : "border-blue-300 bg-blue-50/60 hover:border-blue-500 hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20 dark:hover:border-blue-500 dark:hover:bg-blue-950/40",
        )}
      >
        {loading ? (
          <div className="text-center">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parsing… usually takes 2–3 seconds. Extracting stats and detecting
              sensitive data.
            </p>
          </div>
        ) : (
          <>
            <Upload className="mb-2 h-6 w-6 text-blue-500 dark:text-blue-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Drop{" "}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-[12px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {filename}
              </code>{" "}
              here — or click to choose.
            </p>
            <p className="mt-1 text-[11px] text-blue-600/70 dark:text-blue-300/70">
              Accepts .html files
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".html"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
      {/* Path block */}
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <code className="flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
          {path}
        </code>
        <button
          type="button"
          onClick={copyPath}
          className="shrink-0 rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-200 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          {pathCopied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Finder tip */}
      <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        Tip: In Finder, press{" "}
        <kbd className="rounded border border-slate-300 px-1 py-0.5 text-[10px] dark:border-slate-600">
          ⌘
        </kbd>
        +
        <kbd className="rounded border border-slate-300 px-1 py-0.5 text-[10px] dark:border-slate-600">
          ⇧
        </kbd>
        +
        <kbd className="rounded border border-slate-300 px-1 py-0.5 text-[10px] dark:border-slate-600">
          G
        </kbd>{" "}
        and paste the path
      </p>
    </div>
  );
}

/* DropZoneContent removed — upload step now uses inline two-column layout */

/* ── Eye toggle button ── */
function EyeToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={clsx(
        "rounded p-1 transition-colors",
        enabled
          ? "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          : "text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400",
      )}
      title={enabled ? "Hide this section" : "Show this section"}
    >
      {enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

/* ── Redactable section wrapper — renders profile component with eye toggle overlay ── */
function RedactableSection({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("relative", !enabled && "opacity-40")}>
      <div className="mb-1 flex items-center gap-2">
        <EyeToggle enabled={enabled} onToggle={onToggle} />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </span>
        {!enabled && (
          <span className="text-[10px] font-semibold uppercase text-red-500">
            Will be removed
          </span>
        )}
      </div>
      <div className={clsx(!enabled && "pointer-events-none")}>{children}</div>
    </div>
  );
}

// Maps InsightsData keys to SectionRenderer sectionType and display label
const SECTION_OPTIONS: {
  dataKey: keyof InsightsData;
  sectionType: string;
  label: string;
}[] = [
  {
    dataKey: "at_a_glance",
    sectionType: "at_a_glance",
    label: "At a Glance",
  },
  {
    dataKey: "interaction_style",
    sectionType: "interaction_style",
    label: "Interaction Style",
  },
  {
    dataKey: "project_areas",
    sectionType: "project_areas",
    label: "Project Areas",
  },
  {
    dataKey: "what_works",
    sectionType: "impressive_workflows",
    label: "Impressive Workflows",
  },
  {
    dataKey: "friction_analysis",
    sectionType: "friction_analysis",
    label: "Friction Analysis",
  },
  {
    dataKey: "suggestions",
    sectionType: "suggestions",
    label: "Suggestions",
  },
  {
    dataKey: "on_the_horizon",
    sectionType: "on_the_horizon",
    label: "On the Horizon",
  },
];

/**
 * Shared inline form for adding OR editing a library Project.
 * Used in Step 2 of the upload flow. Shows a "Fetching preview…"
 * loading state while the POST/PATCH is in flight because the
 * server synchronously fetches OG metadata before responding
 * (can take up to ~4 seconds).
 */
function ProjectForm({
  formInput,
  setFormInput,
  formSaving,
  formError,
  onSave,
  onCancel,
  saveLabel,
}: {
  formInput: ProjectFormInput;
  setFormInput: (value: ProjectFormInput) => void;
  formSaving: boolean;
  formError: string | null;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const inputClass =
    "rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:outline-none";

  return (
    <div className="grid gap-3">
      <input
        placeholder="Project name"
        value={formInput.name}
        disabled={formSaving}
        onChange={(e) => setFormInput({ ...formInput, name: e.target.value })}
        className={inputClass}
      />
      <input
        placeholder="GitHub URL (optional)"
        value={formInput.githubUrl}
        disabled={formSaving}
        onChange={(e) =>
          setFormInput({ ...formInput, githubUrl: e.target.value })
        }
        className={inputClass}
      />
      <input
        placeholder="Live URL (optional)"
        value={formInput.liveUrl}
        disabled={formSaving}
        onChange={(e) =>
          setFormInput({ ...formInput, liveUrl: e.target.value })
        }
        className={inputClass}
      />
      <input
        placeholder="Short description (optional)"
        value={formInput.description}
        disabled={formSaving}
        onChange={(e) =>
          setFormInput({ ...formInput, description: e.target.value })
        }
        className={inputClass}
      />
      {formError && (
        <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={formSaving || !formInput.name.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          {formSaving ? "Fetching preview…" : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={formSaving}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedInsightsReport | null>(null);
  const [redactions, setRedactions] = useState<RedactionItem[]>([]);

  // Library picker state (Unit 7). `library` is the user's current
  // Project library as loaded from GET /api/projects. `selectedIds`
  // tracks which library projects will be attached to this report on
  // publish. `formInput` powers both "add new" and inline edit.
  const [library, setLibrary] = useState<LibraryProject[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formMode, setFormMode] = useState<"none" | "add" | string>("none"); // "none" | "add" | <projectId>
  const [formInput, setFormInput] = useState<ProjectFormInput>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [disabledSections, setDisabledSections] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragOverHarness, setDragOverHarness] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(true);
  const [showStandard, setShowStandard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const harnessFileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (key: string) => {
    setDisabledSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFile = async (f: File) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", f);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to parse file");
      }

      const data = await res.json();
      setParsed(data);
      setRedactions(data.detectedRedactions || []);
      setStep("projects");
      // Kick off a library fetch so the picker is ready when the
      // user lands on Step 2.
      void loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const loadLibrary = async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error("Failed to load your project library");
      }
      const body = await res.json();
      const items: LibraryProject[] = body.data ?? [];
      // Race-safety: if the user added or edited a project while
      // this GET was in flight, the local state already contains
      // newer data for those rows. Merge by id — the functional
      // update sees the CURRENT state so local saves are never
      // clobbered by this stale fetch.
      setLibrary((prev) => {
        const byId = new Map<string, LibraryProject>();
        // Start with the fetched items (baseline)
        for (const item of items) byId.set(item.id, item);
        // Overwrite with any locally-known rows (newer) and also
        // add rows that don't exist in the fetch at all (freshly
        // created since the fetch started).
        for (const local of prev) byId.set(local.id, local);
        // Preserve a stable order: newest-first. Rows present in
        // `prev` stay at the top because their updatedAt is newer
        // than the stale fetch.
        return [...byId.values()];
      });
    } catch (err) {
      setLibraryError(
        err instanceof Error ? err.message : "Failed to load library",
      );
    } finally {
      setLibraryLoading(false);
    }
  };

  const toggleProjectSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const beginAddProject = () => {
    setFormMode("add");
    setFormInput(EMPTY_FORM);
    setFormError(null);
  };

  const beginEditProject = (project: LibraryProject) => {
    setFormMode(project.id);
    setFormInput({
      name: project.name,
      githubUrl: project.githubUrl ?? "",
      liveUrl: project.liveUrl ?? "",
      description: project.description ?? "",
    });
    setFormError(null);
  };

  const cancelForm = () => {
    setFormMode("none");
    setFormInput(EMPTY_FORM);
    setFormError(null);
  };

  const saveProjectForm = async () => {
    if (!formInput.name.trim()) {
      setFormError("Project name is required");
      return;
    }
    setFormSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formInput.name.trim(),
        description: formInput.description.trim() || null,
        githubUrl: formInput.githubUrl.trim() || null,
        liveUrl: formInput.liveUrl.trim() || null,
      };
      const isEdit = formMode !== "add" && formMode !== "none";
      const res = await fetch(
        isEdit ? `/api/projects/${formMode}` : "/api/projects",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to save project");
      }
      const saved: LibraryProject = body.data;

      setLibrary((prev) => {
        const without = prev.filter((p) => p.id !== saved.id);
        return [saved, ...without];
      });
      if (!isEdit) {
        // Auto-select newly created projects.
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.add(saved.id);
          return next;
        });
      }
      cancelForm();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save project",
      );
    } finally {
      setFormSaving(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setDragOverHarness(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".html")) {
      handleFile(f);
    } else {
      setError(
        "That's not an HTML file. Run /insight-harness in Claude Code — the report saves to ~/.claude/usage-data/insight-harness.html.",
      );
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const updateRedaction = (
    id: string,
    action: RedactionItem["action"],
    alias?: string,
  ) => {
    setRedactions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, action, alias } : r)),
    );
  };

  const applyAllRedactions = () => {
    setRedactions((prev) => prev.map((r) => ({ ...r, action: "redact" })));
  };

  const resetRedactions = () => {
    if (parsed) {
      setRedactions(parsed.detectedRedactions || []);
      setDisabledSections({});
    }
  };

  const handlePublish = async () => {
    if (!parsed) return;
    if (!session) {
      signIn("github", { callbackUrl: "/upload" });
      return;
    }
    setPublishing(true);
    setError(null);

    try {
      // Apply redactions client-side
      const redactedData = applyRedactions(parsed.data, redactions);
      const hiddenHarnessSections = getHiddenHarnessSections(disabledSections);

      // Build the disabled sections set
      const disabledSet = new Set(
        Object.entries(disabledSections)
          .filter(([, v]) => v)
          .map(([k]) => k),
      );

      // Auto-generate title from date range
      const userName = session?.user?.name || "User";
      const firstName = userName.split(" ")[0];
      const endDate = parsed.stats.dateRangeEnd;
      let titleDate = "";
      if (endDate) {
        const d = new Date(endDate + "T00:00:00");
        titleDate = d.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      } else {
        titleDate = new Date().toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      }
      const isHarness = parsed.reportType === "insight-harness";
      const title = isHarness
        ? `${firstName}'s Insight Harness - ${titleDate}`
        : `${firstName}'s Claude Code Insights - ${titleDate}`;

      // Map InsightsData snake_case keys to Prisma camelCase fields
      // and remove disabled sections
      const sectionMap: Record<keyof InsightsData, string> = {
        at_a_glance: "atAGlance",
        interaction_style: "interactionStyle",
        project_areas: "projectAreas",
        what_works: "impressiveWorkflows",
        friction_analysis: "frictionAnalysis",
        suggestions: "suggestions",
        on_the_horizon: "onTheHorizon",
        fun_ending: "funEnding",
      };

      const sectionFields: Record<string, unknown> = {};
      for (const [dataKey, prismaKey] of Object.entries(sectionMap)) {
        if (!disabledSet.has(dataKey)) {
          sectionFields[prismaKey] =
            redactedData[dataKey as keyof InsightsData] ?? null;
        }
      }

      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sessionCount: parsed.stats.sessionCount ?? null,
          messageCount: parsed.stats.messageCount ?? null,
          commitCount: parsed.stats.commitCount ?? null,
          dateRangeStart: parsed.stats.dateRangeStart ?? null,
          dateRangeEnd: parsed.stats.dateRangeEnd ?? null,
          linesAdded: parsed.stats.linesAdded ?? null,
          linesRemoved: parsed.stats.linesRemoved ?? null,
          fileCount: parsed.stats.fileCount ?? null,
          dayCount: parsed.stats.dayCount ?? null,
          msgsPerDay: parsed.stats.msgsPerDay ?? null,
          ...sectionFields,
          projectIds: Array.from(selectedIds),
          chartData: parsed.chartData,
          detectedSkills: parsed.detectedSkills,
          // v3: Harness fields
          reportType: parsed.reportType ?? "insights",
          totalTokens: parsed.harnessData?.stats.totalTokens ?? null,
          durationHours: parsed.harnessData?.stats.durationHours ?? null,
          avgSessionMinutes:
            parsed.harnessData?.stats.avgSessionMinutes ?? null,
          prCount: parsed.harnessData?.stats.prCount ?? null,
          autonomyLabel: parsed.harnessData?.autonomy.label ?? null,
          harnessData: parsed.harnessData
            ? stripHiddenHarnessData(parsed.harnessData, hiddenHarnessSections)
            : null,
          hiddenHarnessSections,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to publish");
      }

      const result = await res.json();
      router.push(`/insights/${result.data?.slug || result.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
    {
      key: "projects",
      label: "Projects",
      icon: <LinkIcon className="h-4 w-4" />,
    },
    {
      key: "review",
      label: "Review & Publish",
      icon: <Send className="h-4 w-4" />,
    },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);
  const normalizedChartData = parsed
    ? normalizeChartData(parsed.chartData)
    : null;
  // Build the preview list for the Review step. After Unit 7, the
  // upload flow no longer keeps inline projectLinks — it tracks a
  // set of selected library project ids. Map those ids back to the
  // full Project rows from the library so the preview can render
  // the same rich card shape as the public detail page.
  const previewProjectLinks = library
    .filter((p) => selectedIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      githubUrl: p.githubUrl,
      liveUrl: p.liveUrl,
      ogImage: p.ogImage,
      ogTitle: p.ogTitle,
      ogDescription: p.ogDescription,
      favicon: p.favicon,
      siteName: p.siteName,
    }));

  // Computed values for the redaction summary bar
  const redactedCount = redactions.filter((r) => r.action === "redact").length;
  const totalSensitive = redactions.length;
  const allRedacted = totalSensitive > 0 && redactedCount === totalSensitive;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Share Your Insights
      </h1>
      <p className="mb-4 text-slate-500 dark:text-slate-400">
        Upload your Claude Code insights report and share it with the community.
      </p>

      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
          <Link
            href={SAMPLE_PROFILE_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="block shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition-opacity hover:opacity-90 dark:border-slate-700 dark:bg-slate-900 sm:w-64"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SAMPLE_PROFILE_OG}
              alt={`Preview of ${SAMPLE_PROFILE_LABEL}`}
              loading="lazy"
              className="block h-auto w-full"
              width={1200}
              height={630}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              What your profile will look like
            </div>
            <div className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {SAMPLE_PROFILE_LABEL}
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              Rich stats, skill inventory, and workflow patterns —
              auto-generated from your local usage data.
            </p>
            <Link
              href={SAMPLE_PROFILE_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              See a sample profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => i <= stepIndex && setStep(s.key)}
              disabled={i > stepIndex}
              className={clsx(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                i === stepIndex
                  ? "bg-blue-600 text-white"
                  : i < stepIndex
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400",
              )}
            >
              {i < stepIndex ? <Check className="h-4 w-4" /> : s.icon}
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div
                className={clsx(
                  "h-px w-8",
                  i < stepIndex
                    ? "bg-blue-300 dark:bg-blue-700"
                    : "bg-slate-200 dark:bg-slate-700",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Sticky navigation -- visible on all steps except upload */}
      {step !== "upload" && (
        <div className="sticky top-16 z-40 -mx-4 mb-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={() => setStep(steps[stepIndex - 1]?.key || "upload")}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {step === "review" ? (
            <button
              onClick={handlePublish}
              disabled={publishing || formSaving}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
            >
              {publishing
                ? "Publishing..."
                : !session
                  ? "Sign in to publish"
                  : "Publish Insights"}
            </button>
          ) : (
            <button
              onClick={() => setStep(steps[stepIndex + 1]?.key || "review")}
              // Block Next while a project add/edit is saving so the
              // user can't navigate past Step 2 (and then publish)
              // before the just-added project is in selectedIds.
              disabled={formSaving}
              title={
                formSaving ? "Finish saving your project first" : undefined
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:dark:bg-slate-700"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Upload — two-column layout */}
      {step === "upload" && (
        <div>
          <div className="mb-3">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Back to home
            </Link>
          </div>
          {/* Header */}
          <div className="mb-7 text-center">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Turn your Claude Code session data into your{" "}
              <span className="text-2xl">profile</span> in one minute
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Generate a report in Claude Code, drop the file below, and preview
              your profile before anything goes public.
            </p>
          </div>

          {/* ── PRIMARY: /insight-harness (Enhanced) ── */}
          <div className="flex flex-col gap-5 rounded-xl border-[1.5px] border-blue-300 bg-white p-6 shadow-[0_0_0_1px_rgba(37,99,235,0.08),0_4px_16px_rgba(37,99,235,0.06)] dark:border-blue-700 dark:bg-slate-800/60 dark:shadow-[0_0_0_1px_rgba(37,99,235,0.15),0_4px_16px_rgba(37,99,235,0.1)] md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" />
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                /insight-harness (Enhanced)
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                Recommended
              </span>
            </div>

            <div>
              <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                A free custom skill that produces a richer report than{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  /insights
                </code>{" "}
                alone. It captures:
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                {[
                  "Token consumption & cost breakdown",
                  "Tool usage frequency",
                  "Skills inventory",
                  "Hooks & MCP servers",
                  "Agent & workflow patterns",
                  "Everything from /insights",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-200"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                  1
                </span>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  Install the skill (one-time setup){" "}
                  <span className="text-[11px] font-normal text-green-600 dark:text-green-400">
                    (free)
                  </span>
                </span>
              </div>
              <CommandBlock
                command="curl -sL https://github.com/craigdossantos/claude-toolkit/archive/main.tar.gz | tar xz -C /tmp && cp -r /tmp/claude-toolkit-main/skills/insight-harness ~/.claude/skills/ && rm -rf /tmp/claude-toolkit-main"
                small
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Then run:
              </p>
              <CommandBlock command="/insight-harness" />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                  2
                </span>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  Upload the report
                </span>
              </div>
              <MiniDropZone
                fileInputRef={harnessFileInputRef}
                handleFileInput={handleFileInput}
                handleDrop={handleDrop}
                dragOver={dragOverHarness}
                setDragOver={setDragOverHarness}
                path={HARNESS_PATH}
                loading={loading}
                filename="insight-harness.html"
              />
            </div>
          </div>

          {/* ── SECONDARY: /insights (Standard) disclosure ── */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowStandard((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <FileText className="h-3.5 w-3.5" />
              Already have an /insights report? Use that instead
              {showStandard ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showStandard && (
              <div className="mt-3 flex flex-col gap-5 rounded-xl border-[1.5px] border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <FileText className="h-[18px] w-[18px] text-slate-500 dark:text-slate-400" />
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                    /insights (Standard)
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      1
                    </span>
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      Run /insights
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Built into Claude Code. Generates a narrative report about
                    your usage patterns.
                  </p>
                  <CommandBlock command="/insights" />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      2
                    </span>
                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                      Upload the report
                    </span>
                  </div>
                  <MiniDropZone
                    fileInputRef={fileInputRef}
                    handleFileInput={handleFileInput}
                    handleDrop={handleDrop}
                    dragOver={dragOver}
                    setDragOver={setDragOver}
                    path={INSIGHTS_PATH}
                    loading={loading}
                    filename="report.html"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Reassurance banner */}
          <div className="mt-7 flex items-start gap-3.5 rounded-xl border-[1.5px] border-green-200 bg-green-50 px-6 py-5 dark:border-green-800 dark:bg-green-950/30">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  3
                </span>
                <span className="text-sm font-bold text-green-800 dark:text-green-300">
                  Review &amp; Redact
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-green-700 dark:text-green-400">
                Your file stays in your browser until you click Publish. We
                auto-flag project names, file paths, emails, and repo URLs — you
                approve every redaction before anything goes live.
              </p>
            </div>
          </div>

          {/* Comparison table */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <h3 className="mb-1 text-sm font-bold text-slate-900 dark:text-slate-100">
              What&apos;s included in each report?
            </h3>

            {/* Preview rows (always visible) */}
            <div className="relative">
              <table className="mt-2 w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="border-b-2 border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">
                      Feature
                    </th>
                    <th className="border-b-2 border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">
                      /insights
                    </th>
                    <th className="border-b-2 border-slate-200 bg-blue-50/50 px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-blue-950/20 dark:text-slate-300">
                      /insight-harness
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      feature: "Usage narrative",
                      insights: true,
                      harness: true,
                    },
                    {
                      feature: "Conversation count",
                      insights: true,
                      harness: true,
                    },
                    {
                      feature: "Active days & streaks",
                      insights: true,
                      harness: true,
                    },
                    {
                      feature: "Model usage breakdown",
                      insights: true,
                      harness: true,
                    },
                    ...(showAllFeatures
                      ? [
                          {
                            feature: "Token consumption stats",
                            insights: false,
                            harness: true,
                          },
                          {
                            feature: "Tool usage breakdown",
                            insights: false,
                            harness: true,
                          },
                          {
                            feature: "Skill inventory",
                            insights: false,
                            harness: true,
                          },
                          {
                            feature: "Hooks & MCP servers",
                            insights: false,
                            harness: true,
                          },
                          {
                            feature: "Agent patterns",
                            insights: false,
                            harness: true,
                          },
                          {
                            feature: "Cost estimation",
                            insights: false,
                            harness: true,
                          },
                        ]
                      : []),
                  ].map((row, i, arr) => (
                    <tr key={row.feature}>
                      <td
                        className={clsx(
                          "px-3 py-[7px] text-slate-700 dark:text-slate-200",
                          i < arr.length - 1 &&
                            "border-b border-slate-100 dark:border-slate-700/50",
                        )}
                      >
                        {row.feature}
                      </td>
                      <td
                        className={clsx(
                          "px-3 py-[7px] text-center",
                          i < arr.length - 1 &&
                            "border-b border-slate-100 dark:border-slate-700/50",
                          row.insights
                            ? "font-bold text-green-600 dark:text-green-400"
                            : "text-slate-300 dark:text-slate-600",
                        )}
                      >
                        {row.insights ? "\u2713" : "\u2014"}
                      </td>
                      <td
                        className={clsx(
                          "bg-blue-50/50 px-3 py-[7px] text-center dark:bg-blue-950/20",
                          i < arr.length - 1 &&
                            "border-b border-slate-100 dark:border-slate-700/50",
                          row.harness
                            ? "font-bold text-green-600 dark:text-green-400"
                            : "text-slate-300 dark:text-slate-600",
                        )}
                      >
                        {row.harness ? "\u2713" : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Gradient fade on 4th row when collapsed */}
              {!showAllFeatures && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white dark:from-slate-800/60" />
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAllFeatures((v) => !v)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-slate-200"
            >
              {showAllFeatures ? (
                <>
                  Show less <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  See all features <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Project Library Picker */}
      {step === "projects" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            Projects to Include (Optional)
          </h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Pick projects from your library to showcase alongside this report.
            Edits propagate to every report that references the project.
          </p>

          {libraryLoading && (
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Loading your library…
            </p>
          )}
          {libraryError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {libraryError}
            </div>
          )}

          {/* Library project list */}
          <div className="mb-4 space-y-2">
            {library.map((project) => {
              const checked = selectedIds.has(project.id);
              const isEditing = formMode === project.id;
              return (
                <div
                  key={project.id}
                  className={clsx(
                    "rounded-lg border bg-white p-3 transition-colors dark:bg-slate-900",
                    checked
                      ? "border-blue-400 dark:border-blue-500"
                      : "border-slate-200 dark:border-slate-700",
                  )}
                >
                  {!isEditing ? (
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProjectSelected(project.id)}
                        className="mt-1 h-4 w-4 cursor-pointer"
                        aria-label={`Include ${project.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 dark:text-white">
                          {project.name}
                        </p>
                        {project.description && (
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {project.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          {project.githubUrl || project.liveUrl || "No URL"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => beginEditProject(project)}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <ProjectForm
                      formInput={formInput}
                      setFormInput={setFormInput}
                      formSaving={formSaving}
                      formError={formError}
                      onSave={saveProjectForm}
                      onCancel={cancelForm}
                      saveLabel="Save changes"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Add-new form OR "Add new project" trigger */}
          {formMode === "add" ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <ProjectForm
                formInput={formInput}
                setFormInput={setFormInput}
                formSaving={formSaving}
                formError={formError}
                onSave={saveProjectForm}
                onCancel={cancelForm}
                saveLabel="Add to library"
              />
            </div>
          ) : (
            formMode === "none" && (
              <button
                type="button"
                onClick={beginAddProject}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
              >
                <Plus className="h-4 w-4" />
                Add a new project
              </button>
            )
          )}
        </div>
      )}

      {/* Step 3: Review & Publish -- combined redact + preview */}
      {step === "review" && parsed && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            Final Preview
          </h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            This mirrors your published report layout. Use the eye toggles to
            hide cards before publishing.
          </p>

          {/* Redaction summary bar */}
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/20">
            <span className="text-lg text-amber-600 dark:text-amber-400">
              ⚠
            </span>
            <span
              className={clsx(
                "text-sm font-medium",
                allRedacted
                  ? "text-green-700 dark:text-green-400"
                  : "text-amber-800 dark:text-amber-300",
              )}
            >
              {totalSensitive} potentially sensitive items detected in your
              report, {redactedCount} of {totalSensitive} marked for redaction
            </span>
            {totalSensitive > 0 && (
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = document.getElementById(
                      "sensitive-data-review",
                    );
                    if (!target) return;
                    target.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                    // Move focus into the target so keyboard/screen-reader
                    // users land in the section after scrolling.
                    target.focus({ preventScroll: true });
                  }}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/40"
                >
                  Review sensitive items
                </button>
              </div>
            )}
          </div>

          {/* ── Harness Report Preview — mirrors profile page layout ── */}
          {parsed.reportType === "insight-harness" && parsed.harnessData ? (
            <>
              {/* Hero Stats */}
              <RedactableSection
                title="Hero Stats"
                enabled={!disabledSections["heroStats"]}
                onToggle={() => toggleSection("heroStats")}
              >
                <HeroStats
                  stats={parsed.harnessData.stats}
                  dayCount={parsed.stats.dayCount ?? null}
                  sessionCount={
                    parsed.stats.sessionCount ??
                    parsed.harnessData.stats.sessionCount ??
                    0
                  }
                  linesAdded={resolveLinesAdded({
                    linesAdded: parsed.stats.linesAdded ?? null,
                    linesRemoved: parsed.stats.linesRemoved ?? null,
                    harnessData: parsed.harnessData,
                  })}
                  linesRemoved={resolveLinesRemoved({
                    linesAdded: parsed.stats.linesAdded ?? null,
                    linesRemoved: parsed.stats.linesRemoved ?? null,
                    harnessData: parsed.harnessData,
                  })}
                />
              </RedactableSection>

              {/* Activity Heatmap */}
              <RedactableSection
                title="Activity Heatmap"
                enabled={!disabledSections["activityHeatmap"]}
                onToggle={() => toggleSection("activityHeatmap")}
              >
                <ActivityHeatmap
                  totalSessions={
                    parsed.stats.sessionCount ??
                    parsed.harnessData.stats.sessionCount ??
                    undefined
                  }
                  totalTokens={
                    parsed.harnessData.stats.totalTokens ?? undefined
                  }
                  dayCount={parsed.stats.dayCount ?? undefined}
                  dateRangeStart={parsed.stats.dateRangeStart ?? undefined}
                  slug="preview"
                  models={parsed.harnessData.models}
                  perModelTokens={parsed.harnessData.perModelTokens}
                />
              </RedactableSection>

              {/* How I Work cluster */}
              <RedactableSection
                title="How I Work"
                enabled={!disabledSections["howIWork"]}
                onToggle={() => toggleSection("howIWork")}
              >
                <HowIWorkCluster harnessData={parsed.harnessData} />
              </RedactableSection>

              {/* Tool Usage Treemap */}
              {Object.keys(parsed.harnessData.toolUsage).length > 0 && (
                <RedactableSection
                  title="Tool Usage"
                  enabled={!disabledSections["toolUsage"]}
                  onToggle={() => toggleSection("toolUsage")}
                >
                  <ToolUsageTreemap toolUsage={parsed.harnessData.toolUsage} />
                </RedactableSection>
              )}

              {/* Workflow Diagrams */}
              {parsed.harnessData.workflowData && (
                <RedactableSection
                  title="Workflow Diagrams"
                  enabled={!disabledSections["workflowData"]}
                  onToggle={() => toggleSection("workflowData")}
                >
                  <WorkflowDiagram
                    workflowData={parsed.harnessData.workflowData}
                    agentDispatch={parsed.harnessData.agentDispatch}
                  />
                </RedactableSection>
              )}

              {/* Skills Card Grid */}
              {parsed.harnessData.skillInventory.length > 0 && (
                <RedactableSection
                  title="Skills"
                  enabled={!disabledSections["skillInventory"]}
                  onToggle={() => toggleSection("skillInventory")}
                >
                  <SkillCardGrid
                    skillInventory={parsed.harnessData.skillInventory}
                  />
                </RedactableSection>
              )}

              {/* Plugins */}
              {parsed.harnessData.plugins.length > 0 && (
                <RedactableSection
                  title="Plugins"
                  enabled={!disabledSections["plugins"]}
                  onToggle={() => toggleSection("plugins")}
                >
                  <CollapsibleSection
                    icon="🔌"
                    iconBgClass="bg-teal-100 dark:bg-teal-900/30"
                    title="Plugins"
                    defaultOpen={true}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {parsed.harnessData.plugins.map((plugin) => (
                        <div
                          key={plugin.name}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {plugin.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                plugin.active
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                              }`}
                            >
                              {plugin.active ? "on" : "off"}
                            </span>
                          </div>
                          {(plugin.version || plugin.marketplace) && (
                            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                              {plugin.version && `v${plugin.version}`}
                              {plugin.version && plugin.marketplace && " · "}
                              {plugin.marketplace}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                </RedactableSection>
              )}

              {/* CLI Tools Donut */}
              {Object.keys(parsed.harnessData.cliTools).length > 0 && (
                <RedactableSection
                  title="CLI Tools"
                  enabled={!disabledSections["cliTools"]}
                  onToggle={() => toggleSection("cliTools")}
                >
                  <CliToolsDonut cliTools={parsed.harnessData.cliTools} />
                </RedactableSection>
              )}

              {/* Git Patterns */}
              <RedactableSection
                title="Git Patterns"
                enabled={!disabledSections["gitPatterns"]}
                onToggle={() => toggleSection("gitPatterns")}
              >
                <GitPatternsDisplay
                  gitPatterns={parsed.harnessData.gitPatterns}
                />
              </RedactableSection>

              {/* Permission Mode & Safety */}
              <RedactableSection
                title="Permission Mode & Safety"
                enabled={!disabledSections["permissionModes"]}
                onToggle={() => toggleSection("permissionModes")}
              >
                <PermissionModeDisplay
                  permissionModes={parsed.harnessData.permissionModes}
                  featurePills={parsed.harnessData.featurePills}
                />
              </RedactableSection>

              {/* Hooks & Safety */}
              {parsed.harnessData.hookDefinitions.length > 0 && (
                <RedactableSection
                  title="Hooks & Safety"
                  enabled={!disabledSections["hookDefinitions"]}
                  onToggle={() => toggleSection("hookDefinitions")}
                >
                  <HooksSafetyTable
                    hookDefinitions={parsed.harnessData.hookDefinitions}
                  />
                </RedactableSection>
              )}

              {/* Agent Dispatch */}
              {parsed.harnessData.agentDispatch &&
                parsed.harnessData.agentDispatch.totalAgents > 0 && (
                  <RedactableSection
                    title="Agent Dispatch"
                    enabled={!disabledSections["agentDispatch"]}
                    onToggle={() => toggleSection("agentDispatch")}
                  >
                    <CollapsibleSection
                      icon="🤖"
                      iconBgClass="bg-indigo-100 dark:bg-indigo-900/30"
                      title={`Agent Dispatch (${parsed.harnessData.agentDispatch.totalAgents} agents)`}
                      defaultOpen={false}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        {Object.keys(parsed.harnessData.agentDispatch.types)
                          .length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Agent Types
                            </h4>
                            <MiniBarChart
                              data={Object.entries(
                                parsed.harnessData.agentDispatch.types,
                              ).map(([label, value]) => ({ label, value }))}
                              title=""
                              color="bg-indigo-500"
                            />
                          </div>
                        )}
                        {Object.keys(parsed.harnessData.agentDispatch.models)
                          .length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Model Tiering
                            </h4>
                            <MiniBarChart
                              data={Object.entries(
                                parsed.harnessData.agentDispatch.models,
                              ).map(([label, value]) => ({ label, value }))}
                              title=""
                              color="bg-purple-500"
                            />
                            {parsed.harnessData.agentDispatch.backgroundPct >
                              0 && (
                              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                {parsed.harnessData.agentDispatch.backgroundPct}
                                % run in background
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {parsed.harnessData.agentDispatch.customAgents.length >
                        0 && (
                        <div className="mt-3">
                          <h4 className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Custom Agents
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {parsed.harnessData.agentDispatch.customAgents.map(
                              (agent) => (
                                <span
                                  key={agent}
                                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                                >
                                  {agent}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </CollapsibleSection>
                  </RedactableSection>
                )}

              {/* Languages */}
              {Object.keys(parsed.harnessData.languages).length > 0 && (
                <RedactableSection
                  title="Languages"
                  enabled={!disabledSections["languages"]}
                  onToggle={() => toggleSection("languages")}
                >
                  <CollapsibleSection
                    icon="💻"
                    iconBgClass="bg-green-100 dark:bg-green-900/30"
                    title="Languages"
                    defaultOpen={false}
                  >
                    <MiniBarChart
                      data={Object.entries(parsed.harnessData.languages)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 12)
                        .map(([label, value]) => ({ label, value }))}
                      title=""
                      color="bg-green-500"
                    />
                  </CollapsibleSection>
                </RedactableSection>
              )}

              {/* MCP Servers */}
              {Object.keys(parsed.harnessData.mcpServers).length > 0 && (
                <RedactableSection
                  title="MCP Servers"
                  enabled={!disabledSections["mcpServers"]}
                  onToggle={() => toggleSection("mcpServers")}
                >
                  <CollapsibleSection
                    icon="🔗"
                    iconBgClass="bg-cyan-100 dark:bg-cyan-900/30"
                    title="MCP Servers"
                    defaultOpen={false}
                  >
                    <div className="space-y-1">
                      {Object.entries(parsed.harnessData.mcpServers)
                        .sort((a, b) => b[1] - a[1])
                        .map(([server, calls]) => (
                          <div
                            key={server}
                            className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800"
                          >
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                              {server}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {calls.toLocaleString()} calls
                            </span>
                          </div>
                        ))}
                    </div>
                  </CollapsibleSection>
                </RedactableSection>
              )}

              {/* Versions */}
              {parsed.harnessData.versions.length > 0 && (
                <RedactableSection
                  title="Claude Code Versions"
                  enabled={!disabledSections["versions"]}
                  onToggle={() => toggleSection("versions")}
                >
                  <CollapsibleSection
                    icon="📦"
                    iconBgClass="bg-slate-100 dark:bg-slate-900/30"
                    title="Claude Code Versions"
                    defaultOpen={false}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {parsed.harnessData.versions.map((version) => (
                        <span
                          key={version}
                          className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                        >
                          {version}
                        </span>
                      ))}
                    </div>
                  </CollapsibleSection>
                </RedactableSection>
              )}

              {/* Writeup Sections */}
              {parsed.harnessData.writeupSections.length > 0 && (
                <RedactableSection
                  title="Writeup Analysis"
                  enabled={!disabledSections["writeupSections"]}
                  onToggle={() => toggleSection("writeupSections")}
                >
                  <CollapsibleSection
                    icon="📝"
                    iconBgClass="bg-blue-100 dark:bg-blue-900/30"
                    title="Writeup Analysis"
                    defaultOpen={false}
                  >
                    <div className="space-y-6">
                      {parsed.harnessData.writeupSections.map((section) => (
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
                </RedactableSection>
              )}

              {/* Harness Files */}
              {parsed.harnessData.harnessFiles.length > 0 && (
                <RedactableSection
                  title="Harness File Ecosystem"
                  enabled={!disabledSections["harnessFiles"]}
                  onToggle={() => toggleSection("harnessFiles")}
                >
                  <CollapsibleSection
                    icon="📁"
                    iconBgClass="bg-orange-100 dark:bg-orange-900/30"
                    title="Harness File Ecosystem"
                    defaultOpen={false}
                  >
                    <div className="space-y-1">
                      {parsed.harnessData.harnessFiles.map((file) => (
                        <div
                          key={file}
                          className="border-b border-slate-100 py-1 font-mono text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400"
                        >
                          {file}
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                </RedactableSection>
              )}

              {/* Project Links */}
              {previewProjectLinks.length > 0 && (
                <div className="mb-6">
                  <ProjectLinks links={previewProjectLinks} />
                </div>
              )}

              {/* Narrative Sections (mirrors profile page) */}
              <div className="mt-6 space-y-4">
                {SECTION_OPTIONS.filter(
                  ({ dataKey }) => dataKey !== "fun_ending",
                ).map(({ dataKey, sectionType, label }) => {
                  const sectionData = parsed.data[dataKey];
                  if (!sectionData) return null;
                  const enabled = !disabledSections[dataKey];
                  return (
                    <RedactableSection
                      key={dataKey}
                      title={label}
                      enabled={enabled}
                      onToggle={() => toggleSection(dataKey)}
                    >
                      <CollapsibleSection
                        icon=""
                        title={label}
                        defaultOpen={dataKey === "at_a_glance"}
                      >
                        <SectionRenderer
                          slug="preview"
                          sectionKey={dataKey}
                          sectionType={sectionType}
                          data={sectionData}
                          reportId="preview"
                          voteCount={0}
                          voted={false}
                          readOnly
                        />
                      </CollapsibleSection>
                    </RedactableSection>
                  );
                })}
              </div>
            </>
          ) : (
            /* ── Standard Insights Report Preview ── */
            <>
              <SnapshotCard
                sessionCount={parsed.stats.sessionCount ?? null}
                messageCount={parsed.stats.messageCount ?? null}
                linesAdded={parsed.stats.linesAdded ?? null}
                linesRemoved={parsed.stats.linesRemoved ?? null}
                fileCount={parsed.stats.fileCount ?? null}
                dayCount={parsed.stats.dayCount ?? null}
                commitCount={parsed.stats.commitCount ?? null}
                chartData={normalizedChartData}
                detectedSkills={normalizeSkills(parsed.detectedSkills)}
                keyPattern={parsed.data.interaction_style?.key_pattern ?? null}
                projectAreas={
                  disabledSections["project_areas"]
                    ? null
                    : parsed.data.project_areas
                }
              />

              {normalizedChartData && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {normalizedChartData.toolUsage &&
                    normalizedChartData.toolUsage.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.toolUsage}
                          title="Tool Usage"
                          color="bg-blue-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.languages &&
                    normalizedChartData.languages.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.languages}
                          title="Languages"
                          color="bg-green-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.requestTypes &&
                    normalizedChartData.requestTypes.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.requestTypes}
                          title="Request Types"
                          color="bg-violet-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.sessionTypes &&
                    normalizedChartData.sessionTypes.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.sessionTypes}
                          title="Session Types"
                          color="bg-amber-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.responseTimeDistribution &&
                    normalizedChartData.responseTimeDistribution.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.responseTimeDistribution}
                          title="Response Time Distribution"
                          color="bg-cyan-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.toolErrors &&
                    normalizedChartData.toolErrors.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.toolErrors}
                          title="Tool Errors"
                          color="bg-red-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.whatHelpedMost &&
                    normalizedChartData.whatHelpedMost.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.whatHelpedMost}
                          title="What Helped Most"
                          color="bg-emerald-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.outcomes &&
                    normalizedChartData.outcomes.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.outcomes}
                          title="Outcomes"
                          color="bg-teal-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.frictionTypes &&
                    normalizedChartData.frictionTypes.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.frictionTypes}
                          title="Friction Types"
                          color="bg-orange-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.satisfaction &&
                    normalizedChartData.satisfaction.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.satisfaction}
                          title="Satisfaction"
                          color="bg-pink-500"
                        />
                      </div>
                    )}
                  {normalizedChartData.timeOfDay &&
                    normalizedChartData.timeOfDay.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
                        <MiniBarChart
                          data={normalizedChartData.timeOfDay}
                          title="Time of Day"
                          color="bg-indigo-500"
                        />
                      </div>
                    )}
                </div>
              )}

              {previewProjectLinks.length > 0 && (
                <div className="mt-6">
                  <ProjectLinks links={previewProjectLinks} />
                </div>
              )}

              <div className="mt-6 space-y-4">
                {SECTION_OPTIONS.filter(
                  ({ dataKey }) => dataKey !== "fun_ending",
                ).map(({ dataKey, sectionType, label }) => {
                  const sectionData = parsed.data[dataKey];
                  if (!sectionData) return null;
                  const enabled = !disabledSections[dataKey];
                  return (
                    <RedactableSection
                      key={dataKey}
                      title={label}
                      enabled={enabled}
                      onToggle={() => toggleSection(dataKey)}
                    >
                      <CollapsibleSection
                        icon=""
                        title={label}
                        defaultOpen={dataKey === "at_a_glance"}
                      >
                        <SectionRenderer
                          slug="preview"
                          sectionKey={dataKey}
                          sectionType={sectionType}
                          data={sectionData}
                          reportId="preview"
                          voteCount={0}
                          voted={false}
                          readOnly
                        />
                      </CollapsibleSection>
                    </RedactableSection>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Inline Sensitive Data Controls ── */}
          {redactions.length > 0 && (
            <div
              id="sensitive-data-review"
              tabIndex={-1}
              className="mb-6 scroll-mt-24 focus:outline-none"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Sensitive Data Review
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyAllRedactions}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/40"
                  >
                    Redact all sensitive items
                  </button>
                  <button
                    type="button"
                    onClick={resetRedactions}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/40"
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-300">
                  Redact: removes the text entirely
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/20 dark:text-blue-300">
                  Use alias: replaces it with a safe label
                </span>
                <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-800 dark:border-green-800/60 dark:bg-green-950/20 dark:text-green-300">
                  Keep: leaves the original text visible
                </span>
              </div>
              <div className="space-y-2">
                {redactions.map((item) => (
                  <div
                    key={item.id}
                    className={clsx(
                      "flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3",
                      item.action === "redact"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/20"
                        : item.action === "alias"
                          ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
                          : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20",
                    )}
                  >
                    {/* Type badge */}
                    <span
                      className={clsx(
                        "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
                        {
                          project_name:
                            "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
                          file_path:
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
                          github_url:
                            "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
                          email:
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                          code_snippet:
                            "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
                        }[item.type],
                      )}
                    >
                      {item.type.replace("_", " ")}
                    </span>

                    {/* Text value */}
                    <span
                      className={clsx(
                        "flex-1 font-mono text-xs",
                        item.action === "redact"
                          ? "text-amber-900 dark:text-amber-200"
                          : item.action === "alias"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-green-700 dark:text-green-300",
                      )}
                    >
                      {item.action === "alias" && item.alias
                        ? item.alias
                        : item.text}
                    </span>

                    <span
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        item.action === "redact"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                          : item.action === "alias"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                            : "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
                      )}
                    >
                      {item.action === "redact"
                        ? "Will redact"
                        : item.action === "alias"
                          ? "Using alias"
                          : "Keep as-is"}
                    </span>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => updateRedaction(item.id, "redact")}
                        className={clsx(
                          "rounded px-3 py-1.5 text-[11px] font-semibold transition-colors",
                          item.action === "redact"
                            ? "bg-amber-600 text-white"
                            : "bg-white text-slate-600 hover:bg-amber-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-900/30",
                        )}
                        title="Redact this item"
                        aria-label="Redact this item"
                      >
                        Redact
                      </button>
                      <button
                        onClick={() => {
                          const alias = prompt(
                            "Enter replacement text:",
                            `[Project ${redactions.indexOf(item) + 1}]`,
                          );
                          if (alias) updateRedaction(item.id, "alias", alias);
                        }}
                        className={clsx(
                          "rounded px-3 py-1.5 text-[11px] font-semibold transition-colors",
                          item.action === "alias"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-slate-600 hover:bg-blue-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-900/30",
                        )}
                        title="Replace with alias"
                        aria-label="Alias this item"
                      >
                        Use alias
                      </button>
                      <button
                        onClick={() => updateRedaction(item.id, "keep")}
                        className={clsx(
                          "rounded px-3 py-1.5 text-[11px] font-semibold transition-colors",
                          item.action === "keep"
                            ? "bg-green-600 text-white"
                            : "bg-white text-slate-600 hover:bg-green-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-green-900/30",
                        )}
                        title="Keep original text"
                        aria-label="Keep this item"
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Bottom Publish CTA ── */}
          <div className="mt-8 flex flex-col items-end gap-2">
            {!session && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sign in to publish your profile — your data stays in this
                browser until you do.
              </p>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing || formSaving}
              className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
            >
              {publishing
                ? "Publishing..."
                : !session
                  ? "Sign in to publish"
                  : "Publish Insights"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
