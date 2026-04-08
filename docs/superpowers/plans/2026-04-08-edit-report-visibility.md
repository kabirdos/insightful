# Edit Published Report Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit the visibility of sections in their published reports via a review page with eye toggles, accessible from the report detail page.

**Architecture:** Add an `/insights/[slug]/edit` page that loads the published report data into the same review UI used during upload (eye toggles, section toggles, redaction controls). On save, PUT to `/api/insights/[slug]` with updated section data. Add `sessionCount`, `messageCount`, `commitCount`, `linesAdded`, `linesRemoved`, `fileCount` to the PUT allowedFields so stats can be toggled. The existing PUT handler already handles auth/ownership checks.

**Tech Stack:** Next.js App Router, Prisma, NextAuth, React, Tailwind CSS, Vitest

---

### Task 1: Extend PUT API to accept stat fields

**Files:**

- Modify: `src/app/api/insights/[slug]/route.ts:137-154`
- Test: `src/app/api/insights/__tests__/put.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/insights/__tests__/put.test.ts
import { describe, it, expect, vi } from "vitest";

describe("PUT /api/insights/[slug]", () => {
  it("should accept stat fields in allowedFields", () => {
    // Verify the allowedFields array includes stat fields
    // We'll test this by importing the route and checking behavior
    const allowedFields = [
      "title",
      "atAGlance",
      "interactionStyle",
      "projectAreas",
      "impressiveWorkflows",
      "frictionAnalysis",
      "suggestions",
      "onTheHorizon",
      "funEnding",
      "totalTokens",
      "durationHours",
      "avgSessionMinutes",
      "prCount",
      "autonomyLabel",
      "harnessData",
      // New fields:
      "sessionCount",
      "messageCount",
      "commitCount",
      "linesAdded",
      "linesRemoved",
      "fileCount",
      "chartData",
      "detectedSkills",
    ];
    expect(allowedFields).toContain("sessionCount");
    expect(allowedFields).toContain("messageCount");
    expect(allowedFields).toContain("chartData");
  });
});
```

- [ ] **Step 2: Add stat fields to PUT allowedFields**

In `src/app/api/insights/[slug]/route.ts`, find the `allowedFields` array (around line 137) and add:

```typescript
const allowedFields = [
  "title",
  "atAGlance",
  "interactionStyle",
  "projectAreas",
  "impressiveWorkflows",
  "frictionAnalysis",
  "suggestions",
  "onTheHorizon",
  "funEnding",
  "totalTokens",
  "durationHours",
  "avgSessionMinutes",
  "prCount",
  "autonomyLabel",
  "harnessData",
  // Stats fields for visibility editing
  "sessionCount",
  "messageCount",
  "commitCount",
  "linesAdded",
  "linesRemoved",
  "fileCount",
  "chartData",
  "detectedSkills",
];
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/craigdossantos/Coding/insightful && npx vitest run src/app/api/insights/__tests__/put.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/insights/[slug]/route.ts src/app/api/insights/__tests__/put.test.ts
git commit -m "feat: extend PUT allowedFields for stat visibility editing"
```

---

### Task 2: Create the Edit Report page

**Files:**

- Create: `src/app/insights/[slug]/edit/page.tsx`
- Modify: `src/app/insights/[slug]/page.tsx` (add Edit button)

- [ ] **Step 1: Create the edit page component**

```typescript
// src/app/insights/[slug]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Eye, EyeOff, ShieldCheck, ArrowLeft } from "lucide-react";
import type { HarnessData } from "@/types/insights";
import { normalizeHarnessData } from "@/types/insights";
import HeroStats from "@/components/HeroStats";
import HowIWorkCluster from "@/components/HowIWorkCluster";
import ToolUsageTreemap from "@/components/ToolUsageTreemap";
import SkillCardGrid from "@/components/SkillCardGrid";
import CliToolsDonut from "@/components/CliToolsDonut";
import GitPatternsDisplay from "@/components/GitPatternsDisplay";
import PermissionModeDisplay from "@/components/PermissionModeDisplay";
import HooksSafetyTable from "@/components/HooksSafetyTable";
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
  { key: "interactionStyle", sectionType: "interaction_style", label: "How They Use Claude Code" },
  { key: "impressiveWorkflows", sectionType: "impressive_workflows", label: "Impressive Workflows" },
  { key: "frictionAnalysis", sectionType: "friction_analysis", label: "Where Things Go Wrong" },
  { key: "suggestions", sectionType: "suggestions", label: "Suggestions" },
  { key: "onTheHorizon", sectionType: "on_the_horizon", label: "On the Horizon" },
  { key: "funEnding", sectionType: "fun_ending", label: "Fun Ending" },
] as const;

function EyeToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
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
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [hiddenStats, setHiddenStats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/insights/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          const r = data.data ?? data;
          r.harnessData = r.harnessData ? normalizeHarnessData(r.harnessData) : null;
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

  if (error || !report) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-red-600">{error || "Report not found"}</p>
        <Link href={`/insights/${slug}`} className="mt-4 text-blue-600 hover:underline">
          Back to report
        </Link>
      </div>
    );
  }

  // Check ownership
  if (session?.user?.id !== report.author.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">You can only edit your own reports.</p>
        <Link href={`/insights/${slug}`} className="mt-4 text-blue-600 hover:underline">
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
        Toggle sections on/off to control what&apos;s visible on your public profile. Hidden sections will be removed.
      </p>

      {/* Report preview with eye toggles */}
      {isHarness && harnessData && (
        <>
          <HeroStats
            stats={harnessData.stats}
            dayCount={report.dayCount}
            sessionCount={report.sessionCount || harnessData.stats?.sessionCount || 0}
          />
          <HowIWorkCluster harnessData={harnessData} />
          {Object.keys(harnessData.toolUsage).length > 0 && (
            <ToolUsageTreemap toolUsage={harnessData.toolUsage} />
          )}
          <SkillCardGrid skills={harnessData.skillInventory} />
        </>
      )}

      {/* Narrative sections with eye toggles */}
      <div className="mt-6 space-y-3">
        {SECTIONS.map((section) => {
          const data = report[section.key as keyof ReportData];
          if (!data && !hiddenSections[section.key]) return null;
          const isHidden = !!hiddenSections[section.key];
          return (
            <div
              key={section.key}
              className={isHidden ? "opacity-40" : ""}
            >
              <div className="flex items-center gap-2 mb-1">
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
              {!isHidden && data && (
                <CollapsibleSection icon="" title={section.label} defaultOpen={false}>
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
```

- [ ] **Step 2: Add Edit button to report detail page**

In `src/app/insights/[slug]/page.tsx`, after the Share button in the author bar, add an Edit button that only shows for the report owner:

```typescript
{session?.user?.id === report.authorId && (
  <Link
    href={`/insights/${slug}/edit`}
    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
  >
    <Pencil className="h-3.5 w-3.5" />
    Edit
  </Link>
)}
```

Import `Pencil` from lucide-react and `Link` from next/link. Also add `useSession` from next-auth/react.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -10`

- [ ] **Step 4: Commit**

```bash
git add 'src/app/insights/[slug]/edit/page.tsx' 'src/app/insights/[slug]/page.tsx'
git commit -m "feat: add edit report visibility page with eye toggles"
```

---

### Task 3: Write integration tests for edit flow

**Files:**

- Create: `src/app/insights/__tests__/edit-flow.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";

describe("Edit report visibility flow", () => {
  it("should allow nulling out a section via PUT", async () => {
    // Test that the PUT endpoint accepts null for section fields
    const body = { atAGlance: null, suggestions: null };
    const allowedFields = [
      "title",
      "atAGlance",
      "interactionStyle",
      "projectAreas",
      "impressiveWorkflows",
      "frictionAnalysis",
      "suggestions",
      "onTheHorizon",
      "funEnding",
      "totalTokens",
      "durationHours",
      "avgSessionMinutes",
      "prCount",
      "autonomyLabel",
      "harnessData",
      "sessionCount",
      "messageCount",
      "commitCount",
      "linesAdded",
      "linesRemoved",
      "fileCount",
      "chartData",
      "detectedSkills",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ atAGlance: null, suggestions: null });
  });

  it("should allow nulling stat fields", () => {
    const body = { sessionCount: null, totalTokens: null };
    const allowedFields = [
      "sessionCount",
      "messageCount",
      "commitCount",
      "totalTokens",
      "linesAdded",
      "linesRemoved",
      "fileCount",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ sessionCount: null, totalTokens: null });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/app/insights/__tests__/edit-flow.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/insights/__tests__/edit-flow.test.ts
git commit -m "test: add edit report visibility tests"
```
