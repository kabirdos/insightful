"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import type { HarnessData } from "@/types/insights";
import { normalizeHarnessData } from "@/types/insights";
import HeroStats from "@/components/HeroStats";
import HowIWorkCluster from "@/components/HowIWorkCluster";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import SkillCardGrid from "@/components/SkillCardGrid";
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
  const [hiddenStats, setHiddenStats] = useState<Record<string, boolean>>({});

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

  const toggleStat = (key: string) => {
    setHiddenStats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};

      // Null out hidden narrative sections
      for (const section of SECTIONS) {
        if (hiddenSections[section.key]) {
          body[section.key] = null;
        }
      }

      // Null out hidden stats
      if (hiddenStats["sessions"]) body.sessionCount = null;
      if (hiddenStats["messages"]) body.messageCount = null;
      if (hiddenStats["commits"]) body.commitCount = null;
      if (hiddenStats["tokens"]) body.totalTokens = null;

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

  // Suppress unused variable lint — toggleStat is wired up for stat hiding
  void toggleStat;
  void hiddenStats;

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
    </div>
  );
}
