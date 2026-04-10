"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  Trash2,
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
  HarnessData,
} from "@/types/insights";
import { applyRedactions } from "@/lib/redaction";
import { normalizeChartData } from "@/lib/chart-parser";
import { normalizeSkills } from "@/types/insights";
import SectionRenderer from "@/components/SectionRenderer";
import ModelDonutChart from "@/components/ModelDonutChart";
import SnapshotCard from "@/components/SnapshotCard";
import CollapsibleSection from "@/components/CollapsibleSection";
import HeroStats from "@/components/HeroStats";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import AutonomyGauge from "@/components/AutonomyGauge";
import FileOpStyleBar from "@/components/FileOpStyleBar";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import SkillCardGrid from "@/components/SkillCardGrid";
import CliToolsDonut from "@/components/CliToolsDonut";
import GitPatternsDisplay from "@/components/GitPatternsDisplay";
import PermissionModeDisplay from "@/components/PermissionModeDisplay";
import HooksSafetyTable from "@/components/HooksSafetyTable";
import WorkflowDiagram from "@/components/WorkflowDiagram";

type Step = "upload" | "projects" | "review";

interface ProjectLinkInput {
  name: string;
  githubUrl: string;
  liveUrl: string;
  description: string;
}

const INSIGHTS_PATH = "~/.claude/usage-data/report.html";
const HARNESS_PATH = "~/.claude/usage-data/insight-harness.html";

function stripDisabledHarnessSections(
  data: HarnessData,
  disabled: Record<string, boolean>,
): HarnessData {
  const copy = { ...data };
  for (const key of Object.keys(disabled)) {
    if (disabled[key] && key in copy) {
      const k = key as keyof HarnessData;
      const val = copy[k];
      if (Array.isArray(val)) {
        (copy as Record<string, unknown>)[key] = [];
      } else if (typeof val === "object" && val !== null) {
        (copy as Record<string, unknown>)[key] = {};
      } else if (typeof val === "string") {
        (copy as Record<string, unknown>)[key] = "";
      }
    }
  }
  return copy;
}

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
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  path: string;
  loading: boolean;
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
            ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-slate-500",
        )}
      >
        {loading ? (
          <div className="text-center">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parsing...
            </p>
          </div>
        ) : (
          <>
            <Upload className="mb-2 h-6 w-6 text-slate-400 dark:text-slate-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Drop file here or click to browse
            </p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
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

export default function UploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedInsightsReport | null>(null);
  const [redactions, setRedactions] = useState<RedactionItem[]>([]);
  const [projectLinks, setProjectLinks] = useState<ProjectLinkInput[]>([]);
  const [newLink, setNewLink] = useState<ProjectLinkInput>({
    name: "",
    githubUrl: "",
    liveUrl: "",
    description: "",
  });
  const [disabledSections, setDisabledSections] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragOverHarness, setDragOverHarness] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setLoading(false);
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
      setError("Please upload an HTML file");
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

  const addProjectLink = () => {
    if (newLink.name) {
      setProjectLinks((prev) => [...prev, { ...newLink }]);
      setNewLink({ name: "", githubUrl: "", liveUrl: "", description: "" });
    }
  };

  const removeProjectLink = (index: number) => {
    setProjectLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!parsed) return;
    setPublishing(true);
    setError(null);

    try {
      // Apply redactions client-side
      const redactedData = applyRedactions(parsed.data, redactions);

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
          projectLinks,
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
            ? stripDisabledHarnessSections(parsed.harnessData, disabledSections)
            : null,
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

  // Computed values for the redaction summary bar
  const redactedCount = redactions.filter((r) => r.action === "redact").length;
  const totalSensitive = redactions.length;
  const allRedacted = totalSensitive > 0 && redactedCount === totalSensitive;

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Upload className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
            Sign in to share your insights
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            You need to be logged in to upload insights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Share Your Insights
      </h1>
      <p className="mb-8 text-slate-500 dark:text-slate-400">
        Upload your Claude Code insights report and share it with the community.
      </p>

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
              disabled={publishing}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
            >
              {publishing ? "Publishing..." : "Publish Insights"}
            </button>
          ) : (
            <button
              onClick={() => setStep(steps[stepIndex + 1]?.key || "review")}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
          {/* Header */}
          <div className="mb-7 text-center">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Upload Your Report
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Choose your report type, generate it in Claude Code, then upload
              the file.
            </p>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* ── LEFT: /insights (Standard) ── */}
            <div className="flex flex-col gap-5 rounded-xl border-[1.5px] border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
              {/* Column header */}
              <div className="flex items-center gap-2">
                <FileText className="h-[18px] w-[18px] text-slate-500 dark:text-slate-400" />
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  /insights (Standard)
                </span>
              </div>

              {/* Step 1 */}
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

              {/* Step 2 */}
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
                />
              </div>
            </div>

            {/* ── RIGHT: /insight-harness (Enhanced) ── */}
            <div className="flex flex-col gap-5 rounded-xl border-[1.5px] border-blue-300 bg-white p-6 shadow-[0_0_0_1px_rgba(37,99,235,0.08),0_4px_16px_rgba(37,99,235,0.06)] dark:border-blue-700 dark:bg-slate-800/60 dark:shadow-[0_0_0_1px_rgba(37,99,235,0.15),0_4px_16px_rgba(37,99,235,0.1)]">
              {/* Column header */}
              <div className="flex items-center gap-2">
                <Sparkles className="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" />
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  /insight-harness (Enhanced)
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  Recommended
                </span>
              </div>

              {/* Step 1 */}
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
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Everything from /insights PLUS token usage, tool breakdowns,
                  skill inventory, hooks, agent patterns, and more.
                </p>
                <CommandBlock
                  command="curl -sL https://github.com/craigdossantos/claude-toolkit/archive/main.tar.gz | tar xz -C /tmp && cp -r /tmp/claude-toolkit-main/skills/insight-harness ~/.claude/skills/ && rm -rf /tmp/claude-toolkit-main"
                  small
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Then run:
                </p>
                <CommandBlock command="/insight-harness" />
              </div>

              {/* Step 2 */}
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
                />
              </div>
            </div>
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
                We automatically detect non-public information (project names,
                file paths, emails) and let you review before sharing. Nothing
                is published without your approval.
              </p>
            </div>
          </div>

          {/* Bottom note */}
          <p className="mt-6 text-center text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            Both report types work. The Enhanced report includes everything from
            /insights plus detailed harness data.
          </p>

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

      {/* Step 2: Project Links */}
      {step === "projects" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            Add Project Links (Optional)
          </h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Link projects you&apos;re building to showcase them alongside your
            insights.
          </p>

          {projectLinks.map((link, i) => (
            <div
              key={i}
              className="mb-3 flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-white">
                  {link.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {link.githubUrl || link.liveUrl || "No URL"}
                </p>
              </div>
              <button
                onClick={() => removeProjectLink(i)}
                className="text-slate-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <div className="grid gap-3">
              <input
                placeholder="Project name"
                value={newLink.name}
                onChange={(e) =>
                  setNewLink({ ...newLink, name: e.target.value })
                }
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
              />
              <input
                placeholder="GitHub URL (optional)"
                value={newLink.githubUrl}
                onChange={(e) =>
                  setNewLink({ ...newLink, githubUrl: e.target.value })
                }
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
              />
              <input
                placeholder="Live URL (optional)"
                value={newLink.liveUrl}
                onChange={(e) =>
                  setNewLink({ ...newLink, liveUrl: e.target.value })
                }
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
              />
              <input
                placeholder="Short description (optional)"
                value={newLink.description}
                onChange={(e) =>
                  setNewLink({ ...newLink, description: e.target.value })
                }
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
              />
              <button
                onClick={addProjectLink}
                disabled={!newLink.name}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review & Publish -- combined redact + preview */}
      {step === "review" && parsed && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            Final Preview
          </h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            This is exactly how your report will appear on your profile page.
            Use the eye toggles to hide sections before publishing.
          </p>

          {/* Redaction summary bar */}
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <span
              className={clsx(
                "text-sm font-medium",
                allRedacted
                  ? "text-green-700 dark:text-green-400"
                  : "text-amber-700 dark:text-amber-400",
              )}
            >
              {totalSensitive} potentially sensitive items detected,{" "}
              {redactedCount} of {totalSensitive} redacted
            </span>
            {totalSensitive > 0 && (
              <div className="ml-auto flex gap-2">
                <button
                  onClick={applyAllRedactions}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Redact All
                </button>
                <button
                  onClick={resetRedactions}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Reset
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
                />
              </RedactableSection>

              {/* How I Work cluster: Autonomy + Model Donut + File Ops */}
              <RedactableSection
                title="How I Work"
                enabled={!disabledSections["howIWork"]}
                onToggle={() => toggleSection("howIWork")}
              >
                <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
                  <h3 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
                    How I Work
                  </h3>
                  <div className="grid gap-6 sm:grid-cols-3">
                    {parsed.harnessData.autonomy.label && (
                      <div className="flex items-center justify-center">
                        <AutonomyGauge autonomy={parsed.harnessData.autonomy} />
                      </div>
                    )}
                    {Object.keys(parsed.harnessData.models).length > 0 && (
                      <div className="flex items-center justify-center">
                        <ModelDonutChart models={parsed.harnessData.models} />
                      </div>
                    )}
                    {parsed.harnessData.fileOpStyle.style && (
                      <div className="flex items-center justify-center">
                        <FileOpStyleBar
                          fileOpStyle={parsed.harnessData.fileOpStyle}
                        />
                      </div>
                    )}
                  </div>
                </div>
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
                    skillInventory={parsed.harnessData.skillInventory}
                    cliTools={parsed.harnessData.cliTools}
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
                chartData={normalizeChartData(parsed.chartData)}
                detectedSkills={normalizeSkills(parsed.detectedSkills)}
                keyPattern={parsed.data.interaction_style?.key_pattern ?? null}
                projectAreas={
                  disabledSections["project_areas"]
                    ? null
                    : parsed.data.project_areas
                }
              />

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
            <div className="mb-6">
              <h3 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                Sensitive Data Review
              </h3>
              <div className="space-y-2">
                {redactions.map((item) => (
                  <div
                    key={item.id}
                    className={clsx(
                      "flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3",
                      item.action === "redact"
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                        : item.action === "alias"
                          ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
                          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
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
                          ? "text-red-600 line-through dark:text-red-400"
                          : item.action === "alias"
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-700 dark:text-slate-300",
                      )}
                    >
                      {item.action === "alias" && item.alias
                        ? item.alias
                        : item.text}
                    </span>

                    {/* Action buttons: R | A | K */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateRedaction(item.id, "redact")}
                        className={clsx(
                          "rounded px-2 py-1 text-[10px] font-bold transition-colors",
                          item.action === "redact"
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-red-100 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-red-900/30",
                        )}
                        title="Redact"
                        aria-label="Redact this item"
                      >
                        R
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
                          "rounded px-2 py-1 text-[10px] font-bold transition-colors",
                          item.action === "alias"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-blue-100 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-blue-900/30",
                        )}
                        title="Alias"
                        aria-label="Alias this item"
                      >
                        A
                      </button>
                      <button
                        onClick={() => updateRedaction(item.id, "keep")}
                        className={clsx(
                          "rounded px-2 py-1 text-[10px] font-bold transition-colors",
                          item.action === "keep"
                            ? "bg-green-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-green-100 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-green-900/30",
                        )}
                        title="Keep"
                        aria-label="Keep this item"
                      >
                        K
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Bottom Publish CTA ── */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700"
            >
              {publishing ? "Publishing..." : "Publish Insights"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
