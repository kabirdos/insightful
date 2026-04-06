"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Upload,
  Eye,
  EyeOff,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  FileText,
  AlertTriangle,
  Copy,
  ClipboardCheck,
  Link as LinkIcon,
  Plus,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type {
  ParsedInsightsReport,
  RedactionItem,
  InsightsData,
} from "@/types/insights";
import { normalizeSkills } from "@/types/insights";
import { normalizeChartData } from "@/lib/chart-parser";
import { applyRedactions } from "@/lib/redaction";
import SectionRenderer from "@/components/SectionRenderer";
import SnapshotCard from "@/components/SnapshotCard";
import CollapsibleSection from "@/components/CollapsibleSection";

type Step = "upload" | "redact" | "projects" | "preview";

interface ProjectLinkInput {
  name: string;
  githubUrl: string;
  liveUrl: string;
  description: string;
}

const INSIGHTS_PATH = "~/.claude/usage-data/report.html";
const HARNESS_PATH = "~/.claude/usage-data/insight-harness.html";

function CopyablePathBlock({
  label,
  path,
  description,
  accent = false,
}: {
  label: string;
  path: string;
  description: string;
  accent?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copyPath = async () => {
    await navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${accent ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"}`}
    >
      <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </p>
      <p className="mb-2 text-[11px] text-slate-400 dark:text-slate-500">
        {description}
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
          {path}
        </code>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copyPath();
          }}
          className="shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          title="Copy path"
        >
          {copied ? (
            <ClipboardCheck className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function DropZoneContent({
  fileInputRef,
  handleFileInput,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <FileText className="mb-4 h-12 w-12 text-slate-400" />
      <h3 className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-200">
        Upload your report
      </h3>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        Drop either your <strong>/insights</strong> report or your upgraded{" "}
        <strong>/insight-harness</strong> report. Both work.
      </p>

      <div
        className="mx-auto mb-5 grid max-w-lg gap-3 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <CopyablePathBlock
          label="/insights (standard)"
          path={INSIGHTS_PATH}
          description="Run /insights in Claude Code to generate this file."
        />
        <CopyablePathBlock
          label="/insight-harness (upgraded)"
          path={HARNESS_PATH}
          description="Includes everything from /insights plus token usage, tool breakdowns, skill inventory, and more."
          accent
        />
      </div>

      <p className="mb-4 text-[11px] text-slate-400 dark:text-slate-500">
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
        and paste the path to find the file
      </p>

      <span className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
        Click or drop file to upload
      </span>
      <input
        ref={fileInputRef}
        type="file"
        accept=".html"
        onChange={handleFileInput}
        className="hidden"
      />
    </>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    { dataKey: "fun_ending", sectionType: "fun_ending", label: "Fun Ending" },
  ];

  const toggleSection = (key: string) => {
    setDisabledSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFile = async (f: File) => {
    setFile(f);
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
      setStep("redact");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".html")) {
      handleFile(f);
    } else {
      setError("Please upload an HTML file");
    }
  }, []);

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

  const keepAll = () => {
    setRedactions((prev) => prev.map((r) => ({ ...r, action: "keep" })));
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
      const title = `${firstName}'s Claude Code Insights - ${titleDate}`;

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
    { key: "redact", label: "Review", icon: <EyeOff className="h-4 w-4" /> },
    {
      key: "projects",
      label: "Projects",
      icon: <LinkIcon className="h-4 w-4" />,
    },
    { key: "preview", label: "Preview", icon: <Eye className="h-4 w-4" /> },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Upload className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <h2 className="mb-2 text-xl font-semibold text-slate-900">
            Sign in to share your insights
          </h2>
          <p className="text-slate-500">
            You need to be logged in to upload insights.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">
        Share Your Insights
      </h1>
      <p className="mb-8 text-slate-500">
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
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {i < stepIndex ? <Check className="h-4 w-4" /> : s.icon}
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <div
                className={clsx(
                  "h-px w-8",
                  i < stepIndex ? "bg-blue-300" : "bg-slate-200",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Sticky navigation — visible on all steps except upload */}
      {step !== "upload" && (
        <div className="sticky top-16 z-40 -mx-4 mb-6 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={() => setStep(steps[stepIndex - 1]?.key || "upload")}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {step === "preview" ? (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
            >
              {publishing ? "Publishing..." : "Publish Insights"}
            </button>
          ) : (
            <button
              onClick={() => setStep(steps[stepIndex + 1]?.key || "preview")}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div
          onClick={() => !loading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={clsx(
            "flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 bg-slate-50 hover:border-slate-400",
          )}
        >
          {loading ? (
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="text-slate-600">Parsing your insights...</p>
            </div>
          ) : (
            <DropZoneContent
              fileInputRef={fileInputRef}
              handleFileInput={handleFileInput}
            />
          )}
        </div>
      )}

      {/* Step 2: Redaction Review */}
      {step === "redact" && parsed && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Review Detected Sensitive Data
              </h2>
              <p className="text-sm text-slate-500">
                {redactions.length} items detected. Choose what to redact before
                sharing.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyAllRedactions}
                className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Redact All
              </button>
              <button
                onClick={keepAll}
                className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-200"
              >
                Keep All
              </button>
            </div>
          </div>

          {/* Section Toggles */}
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Include/Exclude Sections
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Toggle off any sections you don&apos;t want to share publicly.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTION_OPTIONS.map(({ dataKey, label }) => {
                const hasData = parsed?.data?.[dataKey] != null;
                if (!hasData) return null;
                const disabled = !!disabledSections[dataKey];
                return (
                  <button
                    key={dataKey}
                    onClick={() => toggleSection(dataKey)}
                    className={clsx(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      disabled
                        ? "border-slate-200 bg-slate-50 text-slate-400"
                        : "border-green-200 bg-green-50 text-green-700",
                    )}
                  >
                    <span>{label}</span>
                    {disabled ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {redactions.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
              <Check className="mx-auto mb-2 h-8 w-8 text-green-600" />
              <p className="text-green-700">
                No sensitive data detected. Your report looks clean!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {redactions.map((item) => (
                <div
                  key={item.id}
                  className={clsx(
                    "rounded-lg border p-4",
                    item.action === "redact"
                      ? "border-red-200 bg-red-50"
                      : item.action === "alias"
                        ? "border-amber-200 bg-amber-50"
                        : "border-green-200 bg-green-50",
                  )}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <span
                        className={clsx(
                          "mb-1 inline-block rounded px-2 py-0.5 text-xs font-medium",
                          {
                            project_name: "bg-purple-100 text-purple-700",
                            file_path: "bg-blue-100 text-blue-700",
                            github_url: "bg-slate-100 text-slate-700",
                            email: "bg-amber-100 text-amber-700",
                            code_snippet: "bg-teal-100 text-teal-700",
                          }[item.type],
                        )}
                      >
                        {item.type.replace("_", " ")}
                      </span>
                      <p className="font-mono text-sm text-slate-900">
                        {item.text}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        ...{item.context}...
                      </p>
                    </div>
                    <div className="ml-4 flex gap-1.5">
                      <button
                        onClick={() => updateRedaction(item.id, "redact")}
                        className={clsx(
                          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          item.action === "redact"
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-red-100",
                        )}
                      >
                        <EyeOff className="inline h-3 w-3" /> Redact
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
                          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          item.action === "alias"
                            ? "bg-amber-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-amber-100",
                        )}
                      >
                        Alias
                      </button>
                      <button
                        onClick={() => updateRedaction(item.id, "keep")}
                        className={clsx(
                          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          item.action === "keep"
                            ? "bg-green-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-green-100",
                        )}
                      >
                        <Eye className="inline h-3 w-3" /> Keep
                      </button>
                    </div>
                  </div>
                  {item.action === "alias" && item.alias && (
                    <p className="mt-2 text-xs text-amber-700">
                      Will be replaced with: <strong>{item.alias}</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Styled preview — matches how it will look when published */}
          <div className="mt-8">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Preview: How your report will appear
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              This is what others will see. Review carefully before publishing.
            </p>
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
            <div className="mt-4 space-y-3">
              {SECTION_OPTIONS.map(({ dataKey, sectionType, label }) => {
                if (disabledSections[dataKey]) return null;
                if (dataKey === "project_areas") return null;
                const sectionData = parsed.data[dataKey];
                if (!sectionData) return null;
                return (
                  <CollapsibleSection
                    key={dataKey}
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
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Project Links */}
      {step === "projects" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            Add Project Links (Optional)
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            Link projects you&apos;re building to showcase them alongside your
            insights.
          </p>

          {projectLinks.map((link, i) => (
            <div
              key={i}
              className="mb-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-900">{link.name}</p>
                <p className="text-xs text-slate-500">
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

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="grid gap-3">
              <input
                placeholder="Project name"
                value={newLink.name}
                onChange={(e) =>
                  setNewLink({ ...newLink, name: e.target.value })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                placeholder="GitHub URL (optional)"
                value={newLink.githubUrl}
                onChange={(e) =>
                  setNewLink({ ...newLink, githubUrl: e.target.value })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                placeholder="Live URL (optional)"
                value={newLink.liveUrl}
                onChange={(e) =>
                  setNewLink({ ...newLink, liveUrl: e.target.value })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <input
                placeholder="Short description (optional)"
                value={newLink.description}
                onChange={(e) =>
                  setNewLink({ ...newLink, description: e.target.value })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                onClick={addProjectLink}
                disabled={!newLink.name}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" />
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Preview — shows exactly how the published page will look */}
      {step === "preview" && parsed && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            Final Preview
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            This is exactly how your report will appear. Hit Publish when ready.
          </p>

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

          <div className="mt-4 space-y-3">
            {SECTION_OPTIONS.map(({ dataKey, sectionType, label }) => {
              if (disabledSections[dataKey]) return null;
              if (dataKey === "project_areas") return null;
              const sectionData = parsed.data[dataKey];
              if (!sectionData) return null;
              return (
                <CollapsibleSection
                  key={dataKey}
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
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
            >
              {publishing ? "Publishing..." : "Publish Insights"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
