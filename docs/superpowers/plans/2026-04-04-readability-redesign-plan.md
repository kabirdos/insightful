# Insightful v2 — Readability Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Insightful's report display from text-heavy walls into scannable, data-rich pages with contributor-focused homepage, snapshot cards, and collapsible sections.

**Architecture:** Extend upload parser to extract structured chart data and detect skill mentions. Store new JSON fields on `InsightReport`. Rebuild homepage as a contributor list. Redesign detail page with snapshot card + collapsible sections.

**Tech Stack:** Next.js 16 App Router, Prisma + Supabase PostgreSQL, cheerio (HTML parsing), Tailwind CSS, Lucide React icons, Vitest for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-04-04-readability-redesign-design.md`

---

## File Structure

**New files:**

- `src/lib/skill-detector.ts` — skill detection logic
- `src/lib/__tests__/skill-detector.test.ts` — tests for detector
- `src/lib/chart-parser.ts` — chart data extraction from HTML
- `src/lib/__tests__/chart-parser.test.ts` — tests for chart parser
- `src/components/SkillBadges.tsx` — renders skill badge chips
- `src/components/ToolUsageChart.tsx` — horizontal bar chart for tools
- `src/components/SnapshotCard.tsx` — top snapshot card on detail page
- `src/components/CollapsibleSection.tsx` — collapsible section card with summary
- `src/components/ContributorRow.tsx` — homepage list row
- `prisma/migrations/add_chart_data_and_skills.sql` — manual migration SQL

**Modified files:**

- `prisma/schema.prisma` — add `chartData Json?` and `detectedSkills String[]`
- `src/types/insights.ts` — add `ChartData` and `SkillKey` types
- `src/lib/parser.ts` — no changes (chart parser is separate)
- `src/lib/redaction.ts` — strengthen project redaction
- `src/app/api/upload/route.ts` — call chart parser + skill detector
- `src/app/api/insights/route.ts` — return `chartData`, `detectedSkills`
- `src/app/api/insights/[slug]/route.ts` — return new fields + compute per-week stats
- `src/app/page.tsx` — new homepage layout with ContributorRow
- `src/app/insights/[slug]/page.tsx` — use SnapshotCard + CollapsibleSection
- `src/components/SectionRenderer.tsx` — add `readOnly` prop
- `src/app/upload/page.tsx` — show full content in redaction review step

---

## Task 1: Add schema fields and apply migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/add_chart_data_and_skills.sql`

- [ ] **Step 1: Add fields to Prisma schema**

Edit `prisma/schema.prisma`. Find the `InsightReport` model and add these fields in the Stats section (after `msgsPerDay`):

```prisma
  // v2 additions
  chartData       Json?
  detectedSkills  String[]   @default([])
```

- [ ] **Step 2: Create migration SQL file**

Create `prisma/migrations/add_chart_data_and_skills.sql`:

```sql
ALTER TABLE "InsightReport"
  ADD COLUMN IF NOT EXISTS "chartData" JSONB,
  ADD COLUMN IF NOT EXISTS "detectedSkills" TEXT[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 3: Apply migration to Supabase**

Run: `npx supabase@latest db query --linked -f prisma/migrations/add_chart_data_and_skills.sql`

Expected: `{ "rows": [] }` (empty success)

- [ ] **Step 4: Regenerate Prisma client**

Run: `npx prisma generate`

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Verify build still passes**

Run: `npm run build 2>&1 | tail -5`

Expected: Next.js build output with no errors

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/add_chart_data_and_skills.sql
git commit -m "feat(schema): add chartData and detectedSkills fields to InsightReport"
```

---

## Task 2: Add types for ChartData and SkillKey

**Files:**

- Modify: `src/types/insights.ts`

- [ ] **Step 1: Add types at the end of the file**

Open `src/types/insights.ts` and append:

```typescript
// v2: Chart data parsed from HTML report
export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartData {
  toolUsage?: ChartDataPoint[];
  requestTypes?: ChartDataPoint[];
  languages?: ChartDataPoint[];
  sessionTypes?: ChartDataPoint[];
}

// v2: Closed set of detectable Claude Code skills/features
export const SKILL_KEYS = [
  "parallel_agents",
  "worktrees",
  "custom_skills",
  "hooks",
  "mcp_servers",
  "playwright",
  "headless_mode",
  "plan_mode",
  "code_review",
  "subagents",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export interface SkillMetadata {
  key: SkillKey;
  label: string;
  icon: string;
  colorClass: string;
}

export const SKILL_METADATA: Record<SkillKey, SkillMetadata> = {
  parallel_agents: {
    key: "parallel_agents",
    label: "Parallel Agents",
    icon: "🔀",
    colorClass: "bg-violet-100 text-violet-700",
  },
  worktrees: {
    key: "worktrees",
    label: "Worktrees",
    icon: "🌳",
    colorClass: "bg-green-100 text-green-700",
  },
  custom_skills: {
    key: "custom_skills",
    label: "Custom Skills",
    icon: "⚡",
    colorClass: "bg-amber-100 text-amber-700",
  },
  hooks: {
    key: "hooks",
    label: "Hooks",
    icon: "🪝",
    colorClass: "bg-sky-100 text-sky-700",
  },
  mcp_servers: {
    key: "mcp_servers",
    label: "MCP Servers",
    icon: "🔌",
    colorClass: "bg-slate-100 text-slate-700",
  },
  playwright: {
    key: "playwright",
    label: "Playwright",
    icon: "🎭",
    colorClass: "bg-pink-100 text-pink-700",
  },
  headless_mode: {
    key: "headless_mode",
    label: "Headless Mode",
    icon: "🤖",
    colorClass: "bg-indigo-100 text-indigo-700",
  },
  plan_mode: {
    key: "plan_mode",
    label: "Plan Mode",
    icon: "📋",
    colorClass: "bg-emerald-100 text-emerald-700",
  },
  code_review: {
    key: "code_review",
    label: "Code Review",
    icon: "📝",
    colorClass: "bg-red-100 text-red-700",
  },
  subagents: {
    key: "subagents",
    label: "Subagents",
    icon: "🧩",
    colorClass: "bg-teal-100 text-teal-700",
  },
};
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/insights.ts
git commit -m "feat(types): add ChartData and SkillKey types with metadata"
```

---

## Task 3: Write failing test for chart parser

**Files:**

- Create: `src/lib/__tests__/chart-parser.test.ts`

- [ ] **Step 1: Create test file**

Create `src/lib/__tests__/chart-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseChartData } from "../chart-parser";

const SAMPLE_HTML = `
<html><body>
  <div class="chart-card">
    <div class="chart-title">What You Wanted</div>
    <div class="bar-row">
      <div class="bar-label">Bug Fix</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">27</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">Code Review</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">16</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Top Tools Used</div>
    <div class="bar-row">
      <div class="bar-label">Bash</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">2922</div>
    </div>
    <div class="bar-row">
      <div class="bar-label">Read</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">1318</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Languages</div>
    <div class="bar-row">
      <div class="bar-label">TypeScript</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">1345</div>
    </div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Session Types</div>
    <div class="bar-row">
      <div class="bar-label">Multi Task</div>
      <div class="bar-track"><div class="bar-fill"></div></div>
      <div class="bar-value">40</div>
    </div>
  </div>
</body></html>
`;

describe("parseChartData", () => {
  it("extracts tool usage from 'Top Tools Used' chart", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.toolUsage).toEqual([
      { label: "Bash", value: 2922 },
      { label: "Read", value: 1318 },
    ]);
  });

  it("extracts request types from 'What You Wanted' chart", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.requestTypes).toEqual([
      { label: "Bug Fix", value: 27 },
      { label: "Code Review", value: 16 },
    ]);
  });

  it("extracts languages", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.languages).toEqual([{ label: "TypeScript", value: 1345 }]);
  });

  it("extracts session types", () => {
    const result = parseChartData(SAMPLE_HTML);
    expect(result.sessionTypes).toEqual([{ label: "Multi Task", value: 40 }]);
  });

  it("returns empty object when no charts present", () => {
    const result = parseChartData("<html><body><p>no charts</p></body></html>");
    expect(result).toEqual({});
  });

  it("handles comma-formatted numbers", () => {
    const html = `
      <div class="chart-card">
        <div class="chart-title">Top Tools Used</div>
        <div class="bar-row">
          <div class="bar-label">Bash</div>
          <div class="bar-value">2,922</div>
        </div>
      </div>
    `;
    const result = parseChartData(html);
    expect(result.toolUsage?.[0]).toEqual({ label: "Bash", value: 2922 });
  });

  it("omits keys for charts that aren't in the HTML", () => {
    const html = `
      <div class="chart-card">
        <div class="chart-title">Top Tools Used</div>
        <div class="bar-row">
          <div class="bar-label">Bash</div>
          <div class="bar-value">100</div>
        </div>
      </div>
    `;
    const result = parseChartData(html);
    expect(result.toolUsage).toBeDefined();
    expect(result.requestTypes).toBeUndefined();
    expect(result.languages).toBeUndefined();
    expect(result.sessionTypes).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/chart-parser.test.ts 2>&1 | tail -20`

Expected: FAIL with "Cannot find module '../chart-parser'" or similar

---

## Task 4: Implement chart parser

**Files:**

- Create: `src/lib/chart-parser.ts`

- [ ] **Step 1: Create chart parser implementation**

Create `src/lib/chart-parser.ts`:

```typescript
import * as cheerio from "cheerio";
import type { ChartData, ChartDataPoint } from "@/types/insights";

/**
 * Parse chart data from a Claude Code HTML insights report.
 *
 * The HTML report contains multiple `.chart-card` elements, each with a
 * `.chart-title` and one or more `.bar-row` children. Each bar row has
 * a `.bar-label` and `.bar-value`. We extract the four chart types we
 * know about by matching the chart title.
 */
export function parseChartData(html: string): ChartData {
  const $ = cheerio.load(html);
  const result: ChartData = {};

  $(".chart-card").each((_, card) => {
    const title = $(card).find(".chart-title").first().text().trim();
    const rows: ChartDataPoint[] = [];

    $(card)
      .find(".bar-row")
      .each((_, row) => {
        const label = $(row).find(".bar-label").text().trim();
        const valueText = $(row).find(".bar-value").text().trim();
        const value = parseInt(valueText.replace(/,/g, ""), 10);

        if (label && !isNaN(value)) {
          rows.push({ label, value });
        }
      });

    if (rows.length === 0) return;

    // Map chart title to our structured field
    const titleLower = title.toLowerCase();
    if (titleLower.includes("tools used") || titleLower.includes("top tools")) {
      result.toolUsage = rows;
    } else if (
      titleLower.includes("what you wanted") ||
      titleLower.includes("request")
    ) {
      result.requestTypes = rows;
    } else if (titleLower.includes("language")) {
      result.languages = rows;
    } else if (titleLower.includes("session type")) {
      result.sessionTypes = rows;
    }
  });

  return result;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/chart-parser.test.ts 2>&1 | tail -15`

Expected: All 7 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chart-parser.ts src/lib/__tests__/chart-parser.test.ts
git commit -m "feat(parser): add chart data extraction from HTML reports"
```

---

## Task 5: Write failing tests for skill detector

**Files:**

- Create: `src/lib/__tests__/skill-detector.test.ts`

- [ ] **Step 1: Create test file**

Create `src/lib/__tests__/skill-detector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectSkills } from "../skill-detector";
import type { InsightsData, ChartData } from "@/types/insights";

function makeData(narrativeText: string): InsightsData {
  return {
    at_a_glance: {
      whats_working: "",
      whats_hindering: "",
      quick_wins: "",
      ambitious_workflows: "",
    },
    interaction_style: { narrative: narrativeText, key_pattern: "" },
    project_areas: { areas: [] },
    what_works: { intro: "", impressive_workflows: [] },
    friction_analysis: { intro: "", categories: [] },
    suggestions: {
      claude_md_additions: [],
      features_to_try: [],
      usage_patterns: [],
    },
    on_the_horizon: { intro: "", opportunities: [] },
    fun_ending: { headline: "", detail: "" },
  };
}

describe("detectSkills", () => {
  it("detects parallel_agents from narrative text", () => {
    const data = makeData(
      "You used parallel agents to run multiple test suites simultaneously.",
    );
    const result = detectSkills(data, {});
    expect(result).toContain("parallel_agents");
  });

  it("detects parallel_agents from TaskCreate in tool usage", () => {
    const data = makeData("No mentions here.");
    const chartData: ChartData = {
      toolUsage: [
        { label: "Bash", value: 100 },
        { label: "TaskCreate", value: 191 },
      ],
    };
    const result = detectSkills(data, chartData);
    expect(result).toContain("parallel_agents");
  });

  it("detects worktrees", () => {
    const data = makeData("You created git worktrees for isolation.");
    const result = detectSkills(data, {});
    expect(result).toContain("worktrees");
  });

  it("detects custom_skills from SKILL.md mention", () => {
    const data = makeData("You published a SKILL.md file for reuse.");
    const result = detectSkills(data, {});
    expect(result).toContain("custom_skills");
  });

  it("detects hooks", () => {
    const data = makeData("You configured pre-commit hooks.");
    const result = detectSkills(data, {});
    expect(result).toContain("hooks");
  });

  it("detects mcp_servers", () => {
    const data = makeData("Playwright MCP server configuration.");
    const result = detectSkills(data, {});
    expect(result).toContain("mcp_servers");
  });

  it("detects playwright", () => {
    const data = makeData("You ran browser tests with Playwright.");
    const result = detectSkills(data, {});
    expect(result).toContain("playwright");
  });

  it("detects plan_mode", () => {
    const data = makeData("Used plan mode for complex refactors.");
    const result = detectSkills(data, {});
    expect(result).toContain("plan_mode");
  });

  it("detects code_review", () => {
    const data = makeData("Ran code review with a review agent.");
    const result = detectSkills(data, {});
    expect(result).toContain("code_review");
  });

  it("returns empty array when nothing detected", () => {
    const data = makeData("Just a normal session.");
    const result = detectSkills(data, {});
    expect(result).toEqual([]);
  });

  it("deduplicates results", () => {
    const data = makeData(
      "parallel agents, parallel agents, and more parallel agents",
    );
    const result = detectSkills(data, {});
    const count = result.filter((s) => s === "parallel_agents").length;
    expect(count).toBe(1);
  });

  it("detects multiple skills from the same text", () => {
    const data = makeData(
      "You used parallel agents with Playwright MCP and worktrees for isolation.",
    );
    const result = detectSkills(data, {});
    expect(result).toContain("parallel_agents");
    expect(result).toContain("playwright");
    expect(result).toContain("mcp_servers");
    expect(result).toContain("worktrees");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/skill-detector.test.ts 2>&1 | tail -10`

Expected: FAIL with "Cannot find module '../skill-detector'"

---

## Task 6: Implement skill detector

**Files:**

- Create: `src/lib/skill-detector.ts`

- [ ] **Step 1: Create skill detector implementation**

Create `src/lib/skill-detector.ts`:

```typescript
import type { InsightsData, ChartData, SkillKey } from "@/types/insights";

/**
 * Collect all text content from parsed insights data into a single searchable string.
 */
function collectText(data: InsightsData): string {
  const parts: string[] = [];

  const walk = (obj: unknown): void => {
    if (typeof obj === "string") {
      parts.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (obj !== null && typeof obj === "object") {
      Object.values(obj).forEach(walk);
    }
  };

  walk(data);
  return parts.join(" ").toLowerCase();
}

interface SkillRule {
  key: SkillKey;
  textPatterns?: string[];
  toolPatterns?: string[];
}

const RULES: SkillRule[] = [
  {
    key: "parallel_agents",
    textPatterns: ["parallel agent", "parallel sub-agent", "agent workflow"],
    toolPatterns: ["TaskCreate"],
  },
  {
    key: "worktrees",
    textPatterns: ["worktree", "git worktree"],
  },
  {
    key: "custom_skills",
    textPatterns: ["skill.md", "custom skill", "slash command"],
  },
  {
    key: "hooks",
    textPatterns: [
      "pre-commit hook",
      "post-tool hook",
      "pre-tool hook",
      "hooks configured",
      "hook configured",
      "configured hooks",
    ],
  },
  {
    key: "mcp_servers",
    textPatterns: ["mcp server", "mcp "],
  },
  {
    key: "playwright",
    textPatterns: ["playwright", "browser test"],
  },
  {
    key: "headless_mode",
    textPatterns: [
      "headless mode",
      "headless claude",
      "non-interactive claude",
    ],
  },
  {
    key: "plan_mode",
    textPatterns: ["plan mode", "implementation plan"],
  },
  {
    key: "code_review",
    textPatterns: ["code review", "review agent", "codex cli review"],
  },
  {
    key: "subagents",
    textPatterns: ["subagent", "sub-agent"],
    toolPatterns: ["Agent"],
  },
];

/**
 * Scan parsed insights data and chart data for mentions of Claude Code features.
 * Returns an array of detected skill keys (deduplicated).
 */
export function detectSkills(
  data: InsightsData,
  chartData: ChartData,
): SkillKey[] {
  const text = collectText(data);
  const toolNames = new Set((chartData.toolUsage ?? []).map((t) => t.label));

  const detected = new Set<SkillKey>();

  for (const rule of RULES) {
    // Check text patterns
    if (rule.textPatterns) {
      for (const pattern of rule.textPatterns) {
        if (text.includes(pattern.toLowerCase())) {
          detected.add(rule.key);
          break;
        }
      }
    }

    // Check tool patterns (exact match on tool names)
    if (!detected.has(rule.key) && rule.toolPatterns) {
      for (const pattern of rule.toolPatterns) {
        if (toolNames.has(pattern)) {
          detected.add(rule.key);
          break;
        }
      }
    }
  }

  return Array.from(detected);
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/skill-detector.test.ts 2>&1 | tail -20`

Expected: All 12 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/skill-detector.ts src/lib/__tests__/skill-detector.test.ts
git commit -m "feat(parser): add skill detection from insights text and tool usage"
```

---

## Task 7: Wire chart parser and skill detector into upload API

**Files:**

- Modify: `src/app/api/upload/route.ts`

- [ ] **Step 1: Read the current upload route to understand its structure**

Run: `head -60 src/app/api/upload/route.ts`

Look for where `parseInsightsHtml` is called and where `detectRedactions` runs.

- [ ] **Step 2: Add imports at the top of the file**

Edit `src/app/api/upload/route.ts`. Find the import section and add:

```typescript
import { parseChartData } from "@/lib/chart-parser";
import { detectSkills } from "@/lib/skill-detector";
```

- [ ] **Step 3: Call the new parsers after parseInsightsHtml**

Find the line that calls `parseInsightsHtml(html)` (stores result in `parsed`). Immediately after it, add:

```typescript
const chartData = parseChartData(html);
const detectedSkills = detectSkills(parsed.data, chartData);
```

- [ ] **Step 4: Include new fields in the response**

Find the `NextResponse.json(...)` return statement. Add `chartData` and `detectedSkills` to the response body. The response should look like:

```typescript
return NextResponse.json({
  stats: parsed.stats,
  data: parsed.data,
  detectedRedactions: parsed.detectedRedactions,
  chartData,
  detectedSkills,
});
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat(api): include chartData and detectedSkills in upload response"
```

---

## Task 8: Accept chartData and detectedSkills in POST /api/insights

**Files:**

- Modify: `src/app/api/insights/route.ts`

- [ ] **Step 1: Read current POST handler**

Run: `grep -n "chartData\|detectedSkills\|prisma.insightReport.create" src/app/api/insights/route.ts`

- [ ] **Step 2: Add fields to request body destructuring**

Edit `src/app/api/insights/route.ts`. Find the `const { title, ... } = body;` destructuring inside the POST handler. Add `chartData` and `detectedSkills`:

```typescript
const {
  title: providedTitle,
  sessionCount,
  messageCount,
  commitCount,
  dateRangeStart,
  dateRangeEnd,
  linesAdded,
  linesRemoved,
  fileCount,
  dayCount,
  msgsPerDay,
  chartData,
  detectedSkills,
  atAGlance,
  interactionStyle,
  projectAreas,
  impressiveWorkflows,
  frictionAnalysis,
  suggestions,
  onTheHorizon,
  funEnding,
  projectLinks,
} = body;
```

- [ ] **Step 3: Pass the fields to Prisma create**

Find the `prisma.insightReport.create({ data: { ... } })` call. Add these fields alongside the other stats:

```typescript
        chartData: chartData ?? undefined,
        detectedSkills: detectedSkills ?? [],
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/insights/route.ts
git commit -m "feat(api): persist chartData and detectedSkills on insight create"
```

---

## Task 9: Send chartData and detectedSkills from upload client

**Files:**

- Modify: `src/app/upload/page.tsx`

- [ ] **Step 1: Update ParsedInsightsReport type usage**

The upload page stores the parsed response in `parsed` state. Find the interface/type for the parsed data and ensure it includes `chartData` and `detectedSkills`. Check `src/types/insights.ts` for `ParsedInsightsReport`:

Run: `grep -n "ParsedInsightsReport" src/types/insights.ts`

If `ParsedInsightsReport` doesn't include the new fields, extend it:

Find the `ParsedInsightsReport` interface and add:

```typescript
  chartData?: ChartData;
  detectedSkills?: SkillKey[];
```

- [ ] **Step 2: Pass fields to publish API**

In `src/app/upload/page.tsx`, find the `handlePublish` function and the fetch POST body to `/api/insights`. Add `chartData` and `detectedSkills`:

```typescript
          chartData: parsed.chartData,
          detectedSkills: parsed.detectedSkills,
```

Place these alongside the other stats in the JSON body.

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/types/insights.ts src/app/upload/page.tsx
git commit -m "feat(upload): forward chartData and detectedSkills to publish API"
```

---

## Task 10: Strengthen project redaction

**Files:**

- Modify: `src/lib/redaction.ts`
- Modify: `src/lib/__tests__/redaction.test.ts`

- [ ] **Step 1: Read current redaction.ts**

Run: `cat src/lib/redaction.ts`

Find the `applyRedactions` function.

- [ ] **Step 2: Write a failing test**

Edit `src/lib/__tests__/redaction.test.ts`. Add a new test:

```typescript
it("also redacts project description when project name is redacted", () => {
  const data: InsightsData = {
    at_a_glance: {
      whats_working: "",
      whats_hindering: "",
      quick_wins: "",
      ambitious_workflows: "",
    },
    interaction_style: { narrative: "", key_pattern: "" },
    project_areas: {
      areas: [
        {
          name: "SecretProject",
          session_count: 10,
          description: "A secret health insurance app with Stripe payments",
        },
      ],
    },
    what_works: { intro: "", impressive_workflows: [] },
    friction_analysis: { intro: "", categories: [] },
    suggestions: {
      claude_md_additions: [],
      features_to_try: [],
      usage_patterns: [],
    },
    on_the_horizon: { intro: "", opportunities: [] },
    fun_ending: { headline: "", detail: "" },
  };

  const decisions: RedactionItem[] = [
    {
      id: "1",
      text: "SecretProject",
      type: "project_name",
      context: "",
      sectionKey: "project_areas",
      action: "redact",
    },
  ];

  const result = applyRedactions(data, decisions);
  const area = result.project_areas.areas[0];
  expect(area.name).toBe("[redacted]");
  expect(area.description).toBe("[redacted]");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/redaction.test.ts 2>&1 | tail -10`

Expected: FAIL — current logic only redacts the name string, not the description.

- [ ] **Step 4: Update applyRedactions**

Edit `src/lib/redaction.ts`. In the `applyRedactions` function, after the existing string replacement logic, add a block that walks `clone.project_areas.areas` and replaces descriptions of redacted projects:

```typescript
// v2: If a project name is marked for full redaction, also clear its description
const redactedProjectNames = new Set(
  decisions
    .filter(
      (d) =>
        d.type === "project_name" &&
        d.sectionKey === "project_areas" &&
        d.action === "redact",
    )
    .map((d) => d.text),
);

if (redactedProjectNames.size > 0 && clone.project_areas?.areas) {
  for (const area of clone.project_areas.areas) {
    // area.name has already been replaced with [redacted] by string replacement
    // We need to detect which areas had redacted names. Check if the original
    // name was in the redacted set by comparing the description's original position.
    // Simpler: match by session_count and replace description if name is now [redacted]
    if (area.name === "[redacted]") {
      area.description = "[redacted]";
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/redaction.test.ts 2>&1 | tail -10`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/redaction.ts src/lib/__tests__/redaction.test.ts
git commit -m "feat(redaction): also redact project descriptions when name is redacted"
```

---

## Task 11: Add readOnly prop to SectionRenderer

**Files:**

- Modify: `src/components/SectionRenderer.tsx`

- [ ] **Step 1: Read SectionRenderer props interface**

Run: `grep -n "interface\|VoteButton\|readOnly" src/components/SectionRenderer.tsx | head -20`

Find the component's prop interface.

- [ ] **Step 2: Add readOnly prop to interface**

Edit `src/components/SectionRenderer.tsx`. In the props interface (likely `SectionRendererProps`), add:

```typescript
  readOnly?: boolean;
```

- [ ] **Step 3: Pass readOnly to the component signature**

Find the function signature and add the prop:

```typescript
export default function SectionRenderer({
  // ... existing props
  readOnly = false,
}: SectionRendererProps) {
```

- [ ] **Step 4: Conditionally render vote/highlight buttons**

Find where `<VoteButton />` is rendered (likely in a footer section of the component). Wrap it in a conditional:

```typescript
{!readOnly && (
  <VoteButton
    // existing props
  />
)}
```

Do the same for any highlight buttons or other interactive controls.

- [ ] **Step 5: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
git add src/components/SectionRenderer.tsx
git commit -m "feat(components): add readOnly prop to SectionRenderer"
```

---

## Task 12: Show full section content in upload review step

**Files:**

- Modify: `src/app/upload/page.tsx`

- [ ] **Step 1: Find the redact step JSX**

Run: `grep -n "step === .redact.\|step === \"redact\"" src/app/upload/page.tsx`

- [ ] **Step 2: Add a full-content preview below the section toggles**

In the redact step JSX, after the existing section toggles UI, add a new block that renders each section's full content:

```typescript
{/* Full content preview */}
<div className="mt-8 space-y-6">
  <h3 className="text-sm font-semibold text-slate-700">
    Preview: Full Content
  </h3>
  <p className="text-xs text-slate-500">
    This is what others will see. Review carefully before publishing.
  </p>
  {SECTION_OPTIONS.map(({ dataKey, sectionType }) => {
    if (disabledSections[dataKey]) return null;
    const sectionData = parsed.data[dataKey];
    if (!sectionData) return null;
    return (
      <div key={dataKey} className="rounded-lg border border-slate-200 bg-white p-4">
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
      </div>
    );
  })}
</div>
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/app/upload/page.tsx
git commit -m "feat(upload): show full section content in redaction review step"
```

---

## Task 13: Create SkillBadges component

**Files:**

- Create: `src/components/SkillBadges.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SkillBadges.tsx`:

```typescript
import type { SkillKey } from "@/types/insights";
import { SKILL_METADATA } from "@/types/insights";
import clsx from "clsx";

interface SkillBadgesProps {
  skills: SkillKey[];
  size?: "sm" | "md";
}

export default function SkillBadges({ skills, size = "md" }: SkillBadgesProps) {
  if (!skills || skills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((key) => {
        const meta = SKILL_METADATA[key];
        if (!meta) return null;
        return (
          <span
            key={key}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide",
              meta.colorClass,
              size === "sm"
                ? "px-2 py-0.5 text-[10px]"
                : "px-2.5 py-1 text-xs",
            )}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillBadges.tsx
git commit -m "feat(components): add SkillBadges component"
```

---

## Task 14: Create ToolUsageChart component

**Files:**

- Create: `src/components/ToolUsageChart.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ToolUsageChart.tsx`:

```typescript
import type { ChartDataPoint } from "@/types/insights";

interface ToolUsageChartProps {
  data: ChartDataPoint[];
  max?: number;
}

export default function ToolUsageChart({
  data,
  max = 6,
}: ToolUsageChartProps) {
  if (!data || data.length === 0) return null;

  const topItems = data.slice(0, max);
  const maxValue = Math.max(...topItems.map((d) => d.value));

  return (
    <div className="space-y-1.5">
      {topItems.map((item) => {
        const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-20 shrink-0 text-xs text-slate-600 dark:text-slate-400">
              {item.label}
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-14 shrink-0 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
              {item.value.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/ToolUsageChart.tsx
git commit -m "feat(components): add ToolUsageChart bar chart component"
```

---

## Task 15: Create SnapshotCard component

**Files:**

- Create: `src/components/SnapshotCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/SnapshotCard.tsx`:

```typescript
import type { ChartData, SkillKey } from "@/types/insights";
import SkillBadges from "./SkillBadges";
import ToolUsageChart from "./ToolUsageChart";

interface SnapshotCardProps {
  sessionCount: number | null;
  messageCount: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
  dayCount: number | null;
  commitCount: number | null;
  chartData: ChartData | null;
  detectedSkills: SkillKey[];
  keyPattern: string | null;
}

function StatCell({
  value,
  label,
  className = "",
}: {
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${className}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </div>
    </div>
  );
}

export default function SnapshotCard({
  sessionCount,
  messageCount,
  linesAdded,
  linesRemoved,
  fileCount,
  dayCount,
  commitCount,
  chartData,
  detectedSkills,
  keyPattern,
}: SnapshotCardProps) {
  const msgsPerWeek =
    messageCount && dayCount ? Math.round(messageCount / (dayCount / 7)) : null;

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/50">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-6 pb-5">
        {sessionCount != null && (
          <StatCell value={sessionCount} label="Sessions" />
        )}
        {messageCount != null && (
          <StatCell value={messageCount.toLocaleString()} label="Messages" />
        )}
        {msgsPerWeek != null && (
          <StatCell value={msgsPerWeek.toLocaleString()} label="Msgs/Week" />
        )}
        {linesAdded != null && (
          <StatCell
            value={`+${linesAdded.toLocaleString()}`}
            label="Lines Added"
            className="text-green-600 dark:text-green-400"
          />
        )}
        {linesRemoved != null && (
          <StatCell
            value={`-${linesRemoved.toLocaleString()}`}
            label="Removed"
            className="text-red-600 dark:text-red-400"
          />
        )}
        {fileCount != null && <StatCell value={fileCount} label="Files" />}
        {commitCount != null && (
          <StatCell value={commitCount} label="Commits" />
        )}
      </div>

      {/* Skills badges */}
      {detectedSkills.length > 0 && (
        <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Skills & Features Used
          </h3>
          <SkillBadges skills={detectedSkills} />
        </div>
      )}

      {/* Key pattern */}
      {keyPattern && (
        <div className="mt-5 rounded-lg border-l-4 border-blue-500 bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
          <p className="text-sm italic leading-relaxed text-slate-700 dark:text-slate-300">
            &ldquo;{keyPattern}&rdquo;
          </p>
        </div>
      )}

      {/* Tool usage chart — collapsed by default */}
      {chartData?.toolUsage && chartData.toolUsage.length > 0 && (
        <details className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600">
            Top Tools Used ▸
          </summary>
          <div className="mt-3">
            <ToolUsageChart data={chartData.toolUsage} />
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/SnapshotCard.tsx
git commit -m "feat(components): add SnapshotCard for report detail page"
```

---

## Task 16: Create CollapsibleSection component

**Files:**

- Create: `src/components/CollapsibleSection.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/CollapsibleSection.tsx`:

```typescript
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";

interface CollapsibleSectionProps {
  icon: string;
  iconBgClass?: string;
  title: string;
  summary?: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({
  icon,
  iconBgClass = "bg-slate-100 dark:bg-slate-800",
  title,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
        type="button"
      >
        <div
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl",
            iconBgClass,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {summary && (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {summary}
            </p>
          )}
        </div>
        <ChevronDown
          className={clsx(
            "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 pb-6 pt-4 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/CollapsibleSection.tsx
git commit -m "feat(components): add CollapsibleSection component"
```

---

## Task 17: Create ContributorRow component

**Files:**

- Create: `src/components/ContributorRow.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ContributorRow.tsx`:

```typescript
import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import type { SkillKey } from "@/types/insights";
import SkillBadges from "./SkillBadges";

interface ContributorRowProps {
  slug: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  publishedAt: string;
  dayCount: number | null;
  messageCount: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
  commitCount: number | null;
  detectedSkills: SkillKey[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ContributorRow({
  slug,
  username,
  displayName,
  avatarUrl,
  publishedAt,
  dayCount,
  messageCount,
  linesAdded,
  linesRemoved,
  fileCount,
  commitCount,
  detectedSkills,
}: ContributorRowProps) {
  // Per-week normalization for comparability
  const msgsPerWeek =
    messageCount && dayCount && dayCount > 0
      ? Math.round(messageCount / (dayCount / 7))
      : null;

  const totalLines = (linesAdded ?? 0) + (linesRemoved ?? 0);
  const linesPerWeek =
    totalLines && dayCount && dayCount > 0
      ? Math.round(totalLines / (dayCount / 7))
      : null;

  return (
    <Link
      href={`/insights/${slug}`}
      className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-blue-700"
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
          <User className="h-6 w-6" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
          {displayName || username}
        </div>
        <div className="text-xs text-slate-400">
          @{username} · {formatDate(publishedAt)}
          {dayCount != null && ` · ${dayCount} days tracked`}
        </div>

        {/* Stats row */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {msgsPerWeek != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {msgsPerWeek.toLocaleString()}
              </strong>{" "}
              msgs/wk
            </span>
          )}
          {linesPerWeek != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {linesPerWeek.toLocaleString()}
              </strong>{" "}
              lines/wk
            </span>
          )}
          {linesAdded != null && (
            <span className="text-green-600 dark:text-green-400">
              +{linesAdded.toLocaleString()} added
            </span>
          )}
          {linesRemoved != null && (
            <span className="text-red-600 dark:text-red-400">
              -{linesRemoved.toLocaleString()} removed
            </span>
          )}
          {fileCount != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {fileCount}
              </strong>{" "}
              files
            </span>
          )}
          {commitCount != null && (
            <span>
              <strong className="text-slate-800 dark:text-slate-200">
                {commitCount}
              </strong>{" "}
              commits
            </span>
          )}
        </div>

        {/* Skills badges */}
        {detectedSkills.length > 0 && (
          <div className="mt-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Skills Used
            </div>
            <SkillBadges skills={detectedSkills} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/components/ContributorRow.tsx
git commit -m "feat(components): add ContributorRow for homepage list"
```

---

## Task 18: Rebuild homepage with ContributorRow list

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read the current page.tsx structure**

Run: `head -100 src/app/page.tsx`

- [ ] **Step 2: Replace the InsightSummary interface and mapping**

Edit `src/app/page.tsx`. Update the `InsightSummary` interface to include `detectedSkills`:

```typescript
interface InsightSummary {
  slug: string;
  title: string;
  publishedAt: string;
  dayCount?: number | null;
  messageCount?: number | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
  fileCount?: number | null;
  commitCount?: number | null;
  detectedSkills: SkillKey[];
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}
```

Add the import at the top: `import type { SkillKey } from "@/types/insights";` and `import ContributorRow from "@/components/ContributorRow";`

- [ ] **Step 3: Update the fetch mapper to include detectedSkills**

Find the `.then((json) => { ... })` block inside the fetch. Update the mapper to include:

```typescript
return {
  slug: r.slug,
  title: r.title,
  publishedAt: r.publishedAt,
  dayCount: r.dayCount,
  messageCount: r.messageCount,
  linesAdded: r.linesAdded,
  linesRemoved: r.linesRemoved,
  fileCount: r.fileCount,
  commitCount: r.commitCount,
  detectedSkills: (r.detectedSkills as SkillKey[]) ?? [],
  author: r.author,
};
```

Remove fields no longer used (atAGlance preview, voteCount, commentCount, sessionCount).

- [ ] **Step 4: Replace the rendered grid with ContributorRow list**

Find the `insights.length > 0 ?` block. Replace the `<div className="grid ...">` with:

```typescript
        <div className="space-y-3">
          {insights.map((insight) => (
            <ContributorRow
              key={insight.slug}
              slug={insight.slug}
              username={insight.author.username}
              displayName={insight.author.displayName ?? null}
              avatarUrl={insight.author.avatarUrl ?? null}
              publishedAt={insight.publishedAt}
              dayCount={insight.dayCount ?? null}
              messageCount={insight.messageCount ?? null}
              linesAdded={insight.linesAdded ?? null}
              linesRemoved={insight.linesRemoved ?? null}
              fileCount={insight.fileCount ?? null}
              commitCount={insight.commitCount ?? null}
              detectedSkills={insight.detectedSkills}
            />
          ))}
        </div>
```

Remove the `InsightCard` import if no longer used.

- [ ] **Step 5: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(homepage): replace card grid with ContributorRow list"
```

---

## Task 19: Update GET /api/insights/[slug] to return new fields

**Files:**

- Modify: `src/app/api/insights/[slug]/route.ts`

- [ ] **Step 1: Read current select clause**

Run: `grep -n "chartData\|detectedSkills\|select:" src/app/api/insights/\[slug\]/route.ts`

- [ ] **Step 2: Add chartData and detectedSkills to the Prisma select**

Edit the route file. Find the `select: { ... }` inside `prisma.insightReport.findUnique`. Add:

```typescript
        chartData: true,
        detectedSkills: true,
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/insights/\[slug\]/route.ts
git commit -m "feat(api): return chartData and detectedSkills on report detail"
```

---

## Task 20: Redesign report detail page with SnapshotCard and CollapsibleSection

**Files:**

- Modify: `src/app/insights/[slug]/page.tsx`

- [ ] **Step 1: Read current detail page structure**

Run: `head -120 src/app/insights/\[slug\]/page.tsx`

Find the SECTIONS array and the JSX that renders sections.

- [ ] **Step 2: Add imports**

Add to the imports at top of file:

```typescript
import SnapshotCard from "@/components/SnapshotCard";
import CollapsibleSection from "@/components/CollapsibleSection";
import type { ChartData, SkillKey } from "@/types/insights";
```

- [ ] **Step 3: Extend ReportData interface**

Add to the `ReportData` interface (if any of these fields are missing):

```typescript
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
  dayCount: number | null;
  msgsPerDay: number | null;
  chartData: ChartData | null;
  detectedSkills: SkillKey[];
```

- [ ] **Step 4: Extract summary helper function**

Add this helper above the component (before `export default function`):

```typescript
function getSectionSummary(
  sectionKey: string,
  report: ReportData,
): string | null {
  const atAGlance = report.atAGlance;
  const interactionStyle = report.interactionStyle;
  const projectAreas = report.projectAreas;
  const funEnding = report.funEnding;

  switch (sectionKey) {
    case "interaction_style":
      if (!interactionStyle?.narrative) return null;
      // First 2-3 sentences
      const sentences = interactionStyle.narrative.match(/[^.!?]+[.!?]+/g);
      return sentences?.slice(0, 2).join(" ").trim() || null;
    case "project_areas":
      const areas = projectAreas?.areas ?? [];
      if (areas.length === 0) return null;
      const total = areas.reduce((sum, a) => sum + (a.session_count ?? 0), 0);
      const topNames = areas
        .slice(0, 2)
        .map((a) => a.name)
        .join(", ");
      return `${areas.length} project areas across ~${total} sessions. Major projects include ${topNames}.`;
    case "impressive_workflows":
      return atAGlance?.whats_working ?? null;
    case "friction_analysis":
      return atAGlance?.whats_hindering ?? null;
    case "suggestions":
      return atAGlance?.quick_wins ?? null;
    case "on_the_horizon":
      return atAGlance?.ambitious_workflows ?? null;
    case "fun_ending":
      if (!funEnding?.headline) return null;
      return funEnding.detail
        ? `${funEnding.headline}. ${funEnding.detail.split(".")[0]}.`
        : funEnding.headline;
    default:
      return null;
  }
}
```

- [ ] **Step 5: Replace the stats bar + sections JSX with SnapshotCard + CollapsibleSections**

Find the JSX that renders the stats bar and the SECTIONS.map. Replace with:

```typescript
      {/* Snapshot card */}
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
      />

      {/* Collapsible sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const data = (report as any)[section.dataKey];
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
                slug={report.slug}
                sectionKey={section.key}
                sectionType={section.sectionType}
                data={data}
                reportId={report.id}
                voteCount={report.voteCounts[section.key] ?? 0}
                voted={report.userVotes[section.key] ?? false}
              />
            </CollapsibleSection>
          );
        })}
      </div>
```

You'll need to update the SECTIONS constant to include `icon` (emoji string) and `iconBgClass`. Replace the SECTIONS array with:

```typescript
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
    key: "project_areas",
    label: "Project Areas",
    dataKey: "projectAreas",
    sectionType: "project_areas",
    icon: "📁",
    iconBgClass: "bg-slate-100 dark:bg-slate-800",
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
  {
    key: "fun_ending",
    label: "Fun Ending",
    dataKey: "funEnding",
    sectionType: "fun_ending",
    icon: "🎉",
    iconBgClass: "bg-pink-100 dark:bg-pink-900/30",
  },
];
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 7: Commit**

```bash
git add src/app/insights/\[slug\]/page.tsx
git commit -m "feat(detail): redesign report page with SnapshotCard and CollapsibleSection"
```

---

## Task 21: Update list API to return detectedSkills

**Files:**

- Modify: `src/app/api/insights/route.ts`

- [ ] **Step 1: Find the GET handler's select clause**

Run: `grep -n "detectedSkills\|select:" src/app/api/insights/route.ts | head -20`

- [ ] **Step 2: Add detectedSkills to the select**

Edit the file. Find the `select: { ... }` inside `prisma.insightReport.findMany` (inside the GET handler). Add:

```typescript
        detectedSkills: true,
        dayCount: true,
        linesAdded: true,
        linesRemoved: true,
        fileCount: true,
```

(Verify `linesAdded`, `linesRemoved`, `fileCount`, `dayCount` are not already included — if they are, skip duplicates.)

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/insights/route.ts
git commit -m "feat(api): include detectedSkills and enhanced stats in list response"
```

---

## Task 22: Manual end-to-end test

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

Run: `npm run dev &` (background)

Wait: 5 seconds for ready

- [ ] **Step 2: Verify home page loads with new layout**

Run: `curl -s "http://localhost:3000/api/insights?sort=newest" | python3 -m json.tool | head -40`

Expected: Response includes `detectedSkills` field (may be empty `[]` for existing records)

- [ ] **Step 3: Screenshot the homepage**

Run:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless=new \
  --screenshot=/tmp/v2-home.png --window-size=1440,900 --disable-gpu \
  --virtual-time-budget=5000 "http://localhost:3000" 2>/dev/null
```

Read the screenshot and verify:

- Hero section with "Insightful" title
- Sort tabs (Newest, Most Voted, Trending)
- Contributor rows (may just show existing data with empty skills arrays)

- [ ] **Step 4: Re-upload the sample report to get new data**

The existing reports in the DB don't have `chartData` or `detectedSkills` because they were uploaded before these fields existed. To test the new pipeline end-to-end, a fresh upload is needed.

Prompt the user: "The existing report in the DB doesn't have chartData or detectedSkills populated (it was uploaded before the new fields existed). To verify the new pipeline end-to-end, you'll need to upload a fresh report via the UI. Go to http://localhost:3000/upload and upload `~/.claude/usage-data/report.html` again."

- [ ] **Step 5: After user confirms upload, verify new fields are populated**

Run: `curl -s "http://localhost:3000/api/insights?sort=newest" | python3 -c "import json,sys;d=json.load(sys.stdin)['data'][0];print('Skills:',d.get('detectedSkills'));print('Chart:',list((d.get('chartData') or {}).keys()))"`

Expected: Non-empty `detectedSkills` array and `chartData` with keys like `toolUsage`, `requestTypes`, `languages`, `sessionTypes`

- [ ] **Step 6: Screenshot the detail page**

Run:

```bash
SLUG=$(curl -s "http://localhost:3000/api/insights?sort=newest" | python3 -c "import json,sys;print(json.load(sys.stdin)['data'][0]['slug'])")
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless=new \
  --screenshot=/tmp/v2-detail.png --window-size=1440,2400 --disable-gpu \
  --virtual-time-budget=5000 "http://localhost:3000/insights/$SLUG" 2>/dev/null
```

Read the screenshot and verify:

- SnapshotCard at top with stats, skills badges, key pattern
- Collapsible sections below with 2-3 line summaries
- At a Glance section expanded by default

- [ ] **Step 7: Stop dev server**

Run: `pkill -f "next dev"`

- [ ] **Step 8: Commit screenshots for documentation**

Create `docs/screenshots/v2/` and save the screenshots there for reference:

```bash
mkdir -p docs/screenshots/v2
cp /tmp/v2-home.png docs/screenshots/v2/home.png
cp /tmp/v2-detail.png docs/screenshots/v2/detail.png
git add docs/screenshots/v2/
git commit -m "docs: add v2 redesign screenshots"
```

---

## Task 23: Deploy to production

**Files:** None (deployment only)

- [ ] **Step 1: Verify all tests pass locally**

Run: `npx vitest run 2>&1 | tail -10`

Expected: All tests passing.

- [ ] **Step 2: Final production build check**

Run: `npm run build 2>&1 | tail -15`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Deploy to Vercel**

Run: `vercel deploy --prod 2>&1`

Expected: Deployment success with Production URL.

- [ ] **Step 4: Smoke test on production**

Wait 20 seconds after deploy, then:

```bash
curl -s "https://insightharness.com/api/health"
curl -s "https://insightharness.com/api/insights?sort=newest" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'Reports: {d[\"pagination\"][\"total\"]}')"
```

Expected: Health `{ "status": "ok" }` and at least 1 report.

- [ ] **Step 5: Screenshot production**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless=new \
  --screenshot=/tmp/prod-home.png --window-size=1440,900 --disable-gpu \
  --virtual-time-budget=5000 "https://insightharness.com" 2>/dev/null
```

Read the screenshot to verify production renders correctly.

---

## Summary

**Total tasks:** 23
**Total commits:** ~20 focused commits

**What this delivers:**

1. Schema + types for chart data and skills
2. Chart parser extracting tool usage, request types, languages, session types
3. Skill detector identifying 10 Claude Code features
4. Strengthened project redaction
5. Upload review step shows full content
6. SkillBadges, ToolUsageChart, SnapshotCard, CollapsibleSection, ContributorRow components
7. Homepage rebuilt as contributor list
8. Detail page rebuilt with snapshot + collapsible sections
9. E2E tested locally and deployed to production
