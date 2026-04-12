import { describe, it, expect } from "vitest";
import { filterReportForResponse } from "../filter-report-response";

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    authorId: "user-1",
    harnessData: {
      stats: { totalTokens: 1000, durationHours: 10, avgSessionMinutes: 30, skillsUsedCount: 5, hooksCount: 2, prCount: 3 },
      autonomy: { label: "high", description: "desc", userMessages: 10, assistantMessages: 50, turnCount: 60, errorRate: "2%" },
      featurePills: [],
      toolUsage: { Read: 100, Write: 50, Bash: 30 },
      skillInventory: [
        { name: "Superpowers Brainstorming", calls: 10, source: "plugin", description: "brainstorm" },
        { name: "Code Review", calls: 5, source: "builtin", description: "review" },
      ],
      hookDefinitions: [{ event: "preCommit", matcher: "*.ts", script: "lint" }],
      hookFrequency: {},
      plugins: [{ name: "my-plugin", version: "1.0", marketplace: "npm", active: true }],
      harnessFiles: ["CLAUDE.md", ".claude/settings.json"],
      fileOpStyle: { readPct: 40, editPct: 30, writePct: 20, grepCount: 5, globCount: 3, style: "read-heavy" },
      agentDispatch: { totalAgents: 5, types: { "general-purpose": 3, "code-review": 2 }, models: { "opus-4": 4, "sonnet-4": 1 }, backgroundPct: 20, customAgents: [] },
      cliTools: { git: 50, npm: 20 },
      languages: { TypeScript: 100, Python: 50 },
      models: { "opus-4": 80, "sonnet-4": 20 },
      permissionModes: { "auto-accept": 90, "manual": 10 },
      mcpServers: { filesystem: 30, github: 20 },
      gitPatterns: { prCount: 3, commitCount: 15, linesAdded: "500", branchPrefixes: { "feat/": 5, "fix/": 3 } },
      versions: ["1.0.0", "1.1.0"],
      writeupSections: [{ title: "Overview", contentHtml: "<p>test</p>" }],
      workflowData: null,
      integrityHash: "abc123",
    },
    hiddenHarnessSections: [] as string[],
    impressiveWorkflows: {
      impressive_workflows: [
        { title: "Parallel Refactor", description: "Did a big refactor in parallel" },
        { title: "Auto Deploy", description: "Set up auto deploy pipeline" },
      ],
    },
    frictionAnalysis: {
      categories: [
        { category: "Test Flakiness", description: "Tests are flaky", examples: ["ex1"] },
      ],
    },
    projectAreas: {
      areas: [
        { name: "Frontend", session_count: 10, description: "UI work" },
        { name: "Backend", session_count: 8, description: "API work" },
      ],
    },
    suggestions: {
      claude_md_additions: [{ addition: "Add testing instructions", why: "reason", prompt_scaffold: "test" }],
      features_to_try: [{ feature: "Worktrees", one_liner: "try it", why_for_you: "speed", example_code: "git worktree" }],
      usage_patterns: [{ title: "Morning Coding", suggestion: "do it", detail: "details", copyable_prompt: "prompt" }],
    },
    onTheHorizon: {
      opportunities: [
        { title: "MCP Integration", whats_possible: "lots", how_to_try: "try", copyable_prompt: "prompt" },
      ],
    },
    ...overrides,
  };
}

describe("filterReportForResponse", () => {
  it("returns full payload when no hides", () => {
    const report = makeReport();
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    expect(result.harnessData).toEqual(report.harnessData);
    expect(result.impressiveWorkflows).toEqual(report.impressiveWorkflows);
  });

  it("returns full payload for owner with includeHidden=true", () => {
    const report = makeReport({ hiddenHarnessSections: ["skillInventory", "impressiveWorkflows.parallel-refactor"] });
    const result = filterReportForResponse(report, { viewerIsOwner: true, includeHidden: true });
    // Should be untouched
    expect((result.harnessData as { skillInventory: unknown[] }).skillInventory).toHaveLength(2);
    expect((result.impressiveWorkflows as { impressive_workflows: unknown[] }).impressive_workflows).toHaveLength(2);
  });

  it("non-owner with includeHidden=true still gets filtered (security)", () => {
    const report = makeReport({ hiddenHarnessSections: ["skillInventory"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: true });
    expect((result.harnessData as { skillInventory: unknown[] }).skillInventory).toHaveLength(0);
  });

  it("strips section from harnessData on top-level hide", () => {
    const report = makeReport({ hiddenHarnessSections: ["skillInventory"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    expect((result.harnessData as { skillInventory: unknown[] }).skillInventory).toHaveLength(0);
  });

  it("strips item from harnessData on item-level hide", () => {
    const report = makeReport({ hiddenHarnessSections: ["skillInventory.superpowers-brainstorming"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const skills = (result.harnessData as { skillInventory: Array<{ name: string }> }).skillInventory;
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Code Review");
  });

  it("strips items from narrative JSON (impressiveWorkflows)", () => {
    const report = makeReport({ hiddenHarnessSections: ["impressiveWorkflows.parallel-refactor"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const iw = result.impressiveWorkflows as { impressive_workflows: Array<{ title: string }> };
    expect(iw.impressive_workflows).toHaveLength(1);
    expect(iw.impressive_workflows[0].title).toBe("Auto Deploy");
  });

  it("strips items from narrative JSON (frictionAnalysis)", () => {
    const report = makeReport({ hiddenHarnessSections: ["frictionAnalysis.test-flakiness"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const fa = result.frictionAnalysis as { categories: unknown[] };
    expect(fa.categories).toHaveLength(0);
  });

  it("strips items from narrative JSON (projectAreas)", () => {
    const report = makeReport({ hiddenHarnessSections: ["projectAreas.frontend"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const pa = result.projectAreas as { areas: Array<{ name: string }> };
    expect(pa.areas).toHaveLength(1);
    expect(pa.areas[0].name).toBe("Backend");
  });

  it("strips items from narrative JSON (onTheHorizon)", () => {
    const report = makeReport({ hiddenHarnessSections: ["onTheHorizon.mcp-integration"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const oh = result.onTheHorizon as { opportunities: unknown[] };
    expect(oh.opportunities).toHaveLength(0);
  });

  it("filters record-based harness sections (languages)", () => {
    const report = makeReport({ hiddenHarnessSections: ["languages.python"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const hd = result.harnessData as { languages: Record<string, number> };
    expect(hd.languages).toEqual({ TypeScript: 100 });
  });

  it("privacy regression: hidden item natural key must not appear in JSON response", () => {
    const report = makeReport({ hiddenHarnessSections: ["skillInventory.superpowers-brainstorming"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const json = JSON.stringify(result);
    expect(json).not.toContain("Superpowers Brainstorming");
  });

  it("privacy regression: hidden workflow must not appear in JSON response", () => {
    const report = makeReport({ hiddenHarnessSections: ["impressiveWorkflows.parallel-refactor"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const json = JSON.stringify(result);
    expect(json).not.toContain("Parallel Refactor");
  });

  it("backward compat: existing top-level keys continue to work", () => {
    const report = makeReport({ hiddenHarnessSections: ["plugins", "languages"] });
    const result = filterReportForResponse(report, { viewerIsOwner: false, includeHidden: false });
    const hd = result.harnessData as { plugins: unknown[]; languages: Record<string, number> };
    expect(hd.plugins).toHaveLength(0);
    expect(Object.keys(hd.languages)).toHaveLength(0);
  });
});
