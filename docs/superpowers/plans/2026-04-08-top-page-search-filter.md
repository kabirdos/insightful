# Top Page Search & Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the voting-based /top page with a search/filter interface that lets users discover harness profiles by stats, skills, models, and other filterable attributes.

**Architecture:** Redesign the /top API to accept filter/sort query params and return filtered InsightReport list items (not section votes). The page shows filter chips, sort dropdown, and a grid of profile cards. All filtering happens server-side via Prisma queries for performance.

**Tech Stack:** Next.js App Router, Prisma, React, Tailwind CSS, Vitest

---

### Task 1: Redesign the /top API endpoint

**Files:**

- Modify: `src/app/api/top/route.ts`
- Test: `src/app/api/__tests__/top-filter.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/__tests__/top-filter.test.ts
import { describe, it, expect } from "vitest";

describe("Top page filter logic", () => {
  it("should build Prisma where clause from filter params", () => {
    const params = new URLSearchParams({
      sort: "tokens",
      reportType: "insight-harness",
      minTokens: "100000",
      skill: "custom_skills",
    });

    const where: Record<string, unknown> = {};

    const reportType = params.get("reportType");
    if (reportType) where.reportType = reportType;

    const minTokens = params.get("minTokens");
    if (minTokens) where.totalTokens = { gte: parseInt(minTokens, 10) };

    const skill = params.get("skill");
    if (skill) where.detectedSkills = { has: skill };

    expect(where).toEqual({
      reportType: "insight-harness",
      totalTokens: { gte: 100000 },
      detectedSkills: { has: "custom_skills" },
    });
  });

  it("should map sort param to Prisma orderBy", () => {
    const sortMap: Record<string, Record<string, string>> = {
      tokens: { totalTokens: "desc" },
      sessions: { sessionCount: "desc" },
      commits: { commitCount: "desc" },
      newest: { publishedAt: "desc" },
      duration: { durationHours: "desc" },
    };

    expect(sortMap["tokens"]).toEqual({ totalTokens: "desc" });
    expect(sortMap["sessions"]).toEqual({ sessionCount: "desc" });
    expect(sortMap["newest"]).toEqual({ publishedAt: "desc" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/craigdossantos/Coding/insightful && npx vitest run src/app/api/__tests__/top-filter.test.ts`
Expected: PASS (pure logic tests)

- [ ] **Step 3: Rewrite the /top API**

Replace the contents of `src/app/api/top/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const SORT_MAP: Record<string, Prisma.InsightReportOrderByWithRelationInput> = {
  tokens: { totalTokens: "desc" },
  sessions: { sessionCount: "desc" },
  commits: { commitCount: "desc" },
  newest: { publishedAt: "desc" },
  duration: { durationHours: "desc" },
  prs: { prCount: "desc" },
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Build where clause
  const where: Prisma.InsightReportWhereInput = {};

  const reportType = params.get("reportType");
  if (reportType) where.reportType = reportType;

  const minTokens = params.get("minTokens");
  if (minTokens) where.totalTokens = { gte: parseInt(minTokens, 10) };

  const skill = params.get("skill");
  if (skill) where.detectedSkills = { has: skill };

  const autonomy = params.get("autonomy");
  if (autonomy)
    where.autonomyLabel = { contains: autonomy, mode: "insensitive" };

  const q = params.get("q");
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { author: { username: { contains: q, mode: "insensitive" } } },
      { author: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  // Sort
  const sortKey = params.get("sort") || "newest";
  const orderBy = SORT_MAP[sortKey] || SORT_MAP.newest;

  // Limit
  const limit = Math.min(parseInt(params.get("limit") || "50", 10), 100);

  const reports = await prisma.insightReport.findMany({
    where,
    orderBy,
    take: limit,
    select: {
      slug: true,
      title: true,
      reportType: true,
      publishedAt: true,
      sessionCount: true,
      messageCount: true,
      commitCount: true,
      totalTokens: true,
      durationHours: true,
      prCount: true,
      dayCount: true,
      autonomyLabel: true,
      detectedSkills: true,
      harnessData: true,
      author: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ data: reports });
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/top/route.ts src/app/api/__tests__/top-filter.test.ts
git commit -m "feat: redesign /top API with filter/sort query params"
```

---

### Task 2: Redesign the /top page UI

**Files:**

- Modify: `src/app/top/page.tsx`

- [ ] **Step 1: Rewrite the top page**

Replace `src/app/top/page.tsx` with a new component that has:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { normalizeHarnessData, type HarnessData } from "@/types/insights";

interface TopReport {
  slug: string;
  title: string;
  reportType: string;
  publishedAt: string;
  sessionCount: number | null;
  messageCount: number | null;
  commitCount: number | null;
  totalTokens: number | null;
  durationHours: number | null;
  prCount: number | null;
  dayCount: number | null;
  autonomyLabel: string | null;
  detectedSkills: string[];
  harnessData: unknown;
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function perWeek(value: number | null, dayCount: number | null): string | null {
  if (!value || !dayCount || dayCount === 0) return null;
  const weeks = dayCount / 7;
  if (weeks === 0) return null;
  const rate = value / weeks;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(1)}K`;
  return rate < 10 ? rate.toFixed(1) : Math.round(rate).toLocaleString();
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "tokens", label: "Most Tokens" },
  { value: "sessions", label: "Most Sessions" },
  { value: "commits", label: "Most Commits" },
  { value: "duration", label: "Most Active" },
  { value: "prs", label: "Most PRs" },
];

const REPORT_TYPE_OPTIONS = [
  { value: "", label: "All Reports" },
  { value: "insight-harness", label: "Harness Only" },
  { value: "insights", label: "Standard Only" },
];

const SKILL_FILTERS = [
  { value: "custom_skills", label: "Custom Skills" },
  { value: "parallel_agents", label: "Parallel Agents" },
  { value: "hooks", label: "Hooks" },
  { value: "mcp_servers", label: "MCP Servers" },
  { value: "worktrees", label: "Worktrees" },
  { value: "plan_mode", label: "Plan Mode" },
  { value: "playwright", label: "Playwright" },
];

function ProfileCard({ report }: { report: TopReport }) {
  const hd = report.harnessData
    ? normalizeHarnessData(report.harnessData as HarnessData)
    : null;
  const sessions = report.sessionCount || hd?.stats?.sessionCount || 0;
  const tokensWk = perWeek(report.totalTokens, report.dayCount);
  const sessionsWk = perWeek(sessions, report.dayCount);
  const commitsWk = perWeek(report.commitCount, report.dayCount);

  return (
    <Link
      href={`/insights/${report.slug}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/50"
    >
      <div className="mb-3 flex items-center gap-3">
        {report.author.avatarUrl ? (
          <Image
            src={report.author.avatarUrl}
            alt={report.author.displayName || report.author.username}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
            {(report.author.displayName || report.author.username)[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
              {report.author.displayName || report.author.username}
            </span>
            {report.reportType === "insight-harness" && (
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            @{report.author.username}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {tokensWk && <span><strong className="text-slate-700 dark:text-slate-200">{tokensWk}</strong> tokens/wk</span>}
        {sessionsWk && <span><strong className="text-slate-700 dark:text-slate-200">{sessionsWk}</strong> sessions/wk</span>}
        {commitsWk && <span><strong className="text-slate-700 dark:text-slate-200">{commitsWk}</strong> commits/wk</span>}
      </div>

      {report.autonomyLabel && (
        <div className="mt-2">
          <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {report.autonomyLabel}
          </span>
        </div>
      )}

      {report.detectedSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {report.detectedSkills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              {skill.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default function TopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<TopReport[]>([]);
  const [loading, setLoading] = useState(true);

  const sort = searchParams.get("sort") || "newest";
  const reportType = searchParams.get("reportType") || "";
  const skill = searchParams.get("skill") || "";
  const q = searchParams.get("q") || "";

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = { sort, reportType, skill, q, ...overrides };
      for (const [k, v] of Object.entries(merged)) {
        if (v) params.set(k, v);
      }
      return `/top?${params.toString()}`;
    },
    [sort, reportType, skill, q],
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (reportType) params.set("reportType", reportType);
    if (skill) params.set("skill", skill);
    if (q) params.set("q", q);

    fetch(`/api/top?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setReports(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sort, reportType, skill, q]);

  const [searchInput, setSearchInput] = useState(q);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        Explore Profiles
      </h1>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Discover how developers use Claude Code — filter by tokens, skills, models, and more.
      </p>

      {/* Search bar */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or username..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") router.push(buildUrl({ q: searchInput }));
            }}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <button
          onClick={() => router.push(buildUrl({ q: searchInput }))}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
      </div>

      {/* Filters row */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SlidersHorizontal className="h-4 w-4 text-slate-400" />

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => router.push(buildUrl({ sort: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Report type */}
        <select
          value={reportType}
          onChange={(e) => router.push(buildUrl({ reportType: e.target.value }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {REPORT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Skill filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {SKILL_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => router.push(buildUrl({ skill: skill === sf.value ? "" : sf.value }))}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                skill === sf.value
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          No profiles match your filters. Try adjusting your search.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <ProfileCard key={report.slug} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add src/app/top/page.tsx
git commit -m "feat: redesign /top page with search, filter, and sort"
```

---

### Task 3: Update navigation label

**Files:**

- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Update nav link**

In `src/components/Header.tsx`, change the "Top" nav link label to "Explore" and keep the href as `/top`:

Find: `Top` (the nav link text for /top)
Replace with: `Explore`

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: rename Top nav to Explore"
```

---

### Task 4: Write tests for filter API

**Files:**

- Modify: `src/app/api/__tests__/top-filter.test.ts`

- [ ] **Step 1: Add edge case tests**

```typescript
// Add to existing test file

it("should handle empty params gracefully", () => {
  const params = new URLSearchParams();
  const where: Record<string, unknown> = {};
  const reportType = params.get("reportType");
  if (reportType) where.reportType = reportType;
  expect(where).toEqual({});
});

it("should handle multiple filters together", () => {
  const params = new URLSearchParams({
    reportType: "insight-harness",
    skill: "hooks",
    sort: "tokens",
    q: "elena",
  });

  const where: Record<string, unknown> = {};
  const reportType = params.get("reportType");
  if (reportType) where.reportType = reportType;
  const skill = params.get("skill");
  if (skill) where.detectedSkills = { has: skill };
  const q = params.get("q");
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { author: { username: { contains: q, mode: "insensitive" } } },
    ];
  }

  expect(where.reportType).toBe("insight-harness");
  expect(where.detectedSkills).toEqual({ has: "hooks" });
  expect(where.OR).toHaveLength(2);
});

it("should default sort to newest", () => {
  const sortMap: Record<string, Record<string, string>> = {
    tokens: { totalTokens: "desc" },
    sessions: { sessionCount: "desc" },
    newest: { publishedAt: "desc" },
  };
  const sortKey = "";
  const orderBy = sortMap[sortKey] || sortMap.newest;
  expect(orderBy).toEqual({ publishedAt: "desc" });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run src/app/api/__tests__/top-filter.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/__tests__/top-filter.test.ts
git commit -m "test: add edge case tests for top page filter API"
```
