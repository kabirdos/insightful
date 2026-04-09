"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Eye, EyeOff, ArrowLeft, AlertTriangle } from "lucide-react";
import type { HarnessData } from "@/types/insights";
import { normalizeHarnessData } from "@/types/insights";
import HeroStats from "@/components/HeroStats";
import HowIWorkCluster from "@/components/HowIWorkCluster";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import SkillCardGrid from "@/components/SkillCardGrid";
import WorkflowDiagram from "@/components/WorkflowDiagram";

import CollapsibleSection from "@/components/CollapsibleSection";
import SectionRenderer from "@/components/SectionRenderer";
import Link from "next/link";

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
  harnessData: HarnessData | null;
  atAGlance: unknown;
  interactionStyle: unknown;
  projectAreas: unknown;
  impressiveWorkflows: unknown;
  frictionAnalysis: unknown;
  suggestions: unknown;
  onTheHorizon: unknown;
  funEnding: unknown;
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
  { key: "funEnding", sectionType: "fun_ending", label: "Fun Ending" },
] as const;

function EyeToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="rounded p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
      title={enabled ? "Hide this section" : "Show this section"}
    >
      {enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

export default function EditReportPage() {
  const { slug } = useParams<{ slug: string }>();
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
    fetch(`/api/insights/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          const r = data.data ?? data;
          r.harnessData = r.harnessData
            ? normalizeHarnessData(r.harnessData)
            : null;
          setReport(r);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load report");
        setLoading(false);
      });
  }, [slug]);

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

    // Handle harness sub-section visibility via dedicated allowlisted field
    const hiddenHarness = Object.entries(hiddenSections)
      .filter(([key, hidden]) => hidden && key === "workflowData")
      .map(([key]) => key);
    if (hiddenHarness.length > 0) {
      body.hiddenHarnessSections = hiddenHarness;
    }

    return body;
  };

  const executeSave = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/insights/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      router.push(`/insights/${slug}`);
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
          href={`/insights/${slug}`}
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
          href={`/insights/${slug}`}
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
          href={`/insights/${slug}`}
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/insights/${slug}`}
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
          <HeroStats
            stats={harnessData.stats}
            dayCount={report.dayCount}
            sessionCount={
              report.sessionCount || harnessData.stats?.sessionCount || 0
            }
          />
          <HowIWorkCluster harnessData={harnessData} />
          {Object.keys(harnessData.toolUsage).length > 0 && (
            <ToolUsageTreemap toolUsage={harnessData.toolUsage} />
          )}
          {harnessData.skillInventory.length > 0 && (
            <SkillCardGrid skillInventory={harnessData.skillInventory} />
          )}
          {harnessData.workflowData && (
            <div className={hiddenSections["workflowData"] ? "opacity-40" : ""}>
              <div className="mb-1 flex items-center gap-2">
                <EyeToggle
                  enabled={!hiddenSections["workflowData"]}
                  onToggle={() => toggleSection("workflowData")}
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Workflow Diagrams
                </span>
                {hiddenSections["workflowData"] && (
                  <span className="text-xs text-red-500">Will be removed</span>
                )}
              </div>
              {!hiddenSections["workflowData"] && (
                <>
                  <WorkflowDiagram workflowData={harnessData.workflowData} />
                </>
              )}
            </div>
          )}
        </>
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
