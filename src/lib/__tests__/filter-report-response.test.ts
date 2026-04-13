import { describe, it, expect } from "vitest";
import {
  filterReportForListFeed,
  filterReportForResponse,
} from "../filter-report-response";

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    authorId: "user-1",
    harnessData: {
      stats: {
        totalTokens: 1000,
        durationHours: 10,
        avgSessionMinutes: 30,
        skillsUsedCount: 5,
        hooksCount: 2,
        prCount: 3,
      },
      autonomy: {
        label: "high",
        description: "desc",
        userMessages: 10,
        assistantMessages: 50,
        turnCount: 60,
        errorRate: "2%",
      },
      featurePills: [],
      toolUsage: { Read: 100, Write: 50, Bash: 30 },
      skillInventory: [
        {
          name: "Superpowers Brainstorming",
          calls: 10,
          source: "plugin",
          description: "brainstorm",
        },
        {
          name: "Code Review",
          calls: 5,
          source: "builtin",
          description: "review",
        },
      ],
      hookDefinitions: [
        { event: "preCommit", matcher: "*.ts", script: "lint" },
      ],
      hookFrequency: {},
      plugins: [
        { name: "my-plugin", version: "1.0", marketplace: "npm", active: true },
      ],
      harnessFiles: ["CLAUDE.md", ".claude/settings.json"],
      fileOpStyle: {
        readPct: 40,
        editPct: 30,
        writePct: 20,
        grepCount: 5,
        globCount: 3,
        style: "read-heavy",
      },
      agentDispatch: {
        totalAgents: 5,
        types: { "general-purpose": 3, "code-review": 2 },
        models: { "opus-4": 4, "sonnet-4": 1 },
        backgroundPct: 20,
        customAgents: [],
      },
      cliTools: { git: 50, npm: 20 },
      languages: { TypeScript: 100, Python: 50 },
      models: { "opus-4": 80, "sonnet-4": 20 },
      permissionModes: { "auto-accept": 90, manual: 10 },
      mcpServers: { filesystem: 30, github: 20 },
      gitPatterns: {
        prCount: 3,
        commitCount: 15,
        linesAdded: "500",
        branchPrefixes: { "feat/": 5, "fix/": 3 },
      },
      versions: ["1.0.0", "1.1.0"],
      writeupSections: [{ title: "Overview", contentHtml: "<p>test</p>" }],
      workflowData: null,
      integrityHash: "abc123",
    },
    hiddenHarnessSections: [] as string[],
    impressiveWorkflows: {
      impressive_workflows: [
        {
          title: "Parallel Refactor",
          description: "Did a big refactor in parallel",
        },
        { title: "Auto Deploy", description: "Set up auto deploy pipeline" },
      ],
    },
    frictionAnalysis: {
      categories: [
        {
          category: "Test Flakiness",
          description: "Tests are flaky",
          examples: ["ex1"],
        },
      ],
    },
    projectAreas: {
      areas: [
        { name: "Frontend", session_count: 10, description: "UI work" },
        { name: "Backend", session_count: 8, description: "API work" },
      ],
    },
    suggestions: {
      claude_md_additions: [
        {
          addition: "Add testing instructions",
          why: "reason",
          prompt_scaffold: "test",
        },
      ],
      features_to_try: [
        {
          feature: "Worktrees",
          one_liner: "try it",
          why_for_you: "speed",
          example_code: "git worktree",
        },
      ],
      usage_patterns: [
        {
          title: "Morning Coding",
          suggestion: "do it",
          detail: "details",
          copyable_prompt: "prompt",
        },
      ],
    },
    onTheHorizon: {
      opportunities: [
        {
          title: "MCP Integration",
          whats_possible: "lots",
          how_to_try: "try",
          copyable_prompt: "prompt",
        },
      ],
    },
    ...overrides,
  };
}

describe("filterReportForResponse", () => {
  it("returns full payload when no hides", () => {
    const report = makeReport();
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    expect(result.harnessData).toEqual(report.harnessData);
    expect(result.impressiveWorkflows).toEqual(report.impressiveWorkflows);
  });

  it("returns full payload for owner with includeHidden=true", () => {
    const report = makeReport({
      hiddenHarnessSections: [
        "skillInventory",
        "impressiveWorkflows.parallel-refactor",
      ],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: true,
      includeHidden: true,
    });
    // Should be untouched
    expect(
      (result.harnessData as { skillInventory: unknown[] }).skillInventory,
    ).toHaveLength(2);
    expect(
      (result.impressiveWorkflows as { impressive_workflows: unknown[] })
        .impressive_workflows,
    ).toHaveLength(2);
  });

  it("non-owner with includeHidden=true still gets filtered (security)", () => {
    const report = makeReport({ hiddenHarnessSections: ["skillInventory"] });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: true,
    });
    expect(
      (result.harnessData as { skillInventory: unknown[] }).skillInventory,
    ).toHaveLength(0);
  });

  it("strips section from harnessData on top-level hide", () => {
    const report = makeReport({ hiddenHarnessSections: ["skillInventory"] });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    expect(
      (result.harnessData as { skillInventory: unknown[] }).skillInventory,
    ).toHaveLength(0);
  });

  it("strips item from harnessData on item-level hide", () => {
    const report = makeReport({
      hiddenHarnessSections: ["skillInventory.superpowers-brainstorming"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const skills = (
      result.harnessData as { skillInventory: Array<{ name: string }> }
    ).skillInventory;
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Code Review");
  });

  it("strips items from narrative JSON (impressiveWorkflows)", () => {
    const report = makeReport({
      hiddenHarnessSections: ["impressiveWorkflows.parallel-refactor"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const iw = result.impressiveWorkflows as {
      impressive_workflows: Array<{ title: string }>;
    };
    expect(iw.impressive_workflows).toHaveLength(1);
    expect(iw.impressive_workflows[0].title).toBe("Auto Deploy");
  });

  it("strips items from narrative JSON (frictionAnalysis)", () => {
    const report = makeReport({
      hiddenHarnessSections: ["frictionAnalysis.test-flakiness"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const fa = result.frictionAnalysis as { categories: unknown[] };
    expect(fa.categories).toHaveLength(0);
  });

  it("strips items from narrative JSON (projectAreas)", () => {
    const report = makeReport({
      hiddenHarnessSections: ["projectAreas.frontend"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const pa = result.projectAreas as { areas: Array<{ name: string }> };
    expect(pa.areas).toHaveLength(1);
    expect(pa.areas[0].name).toBe("Backend");
  });

  it("strips items from narrative JSON (onTheHorizon)", () => {
    const report = makeReport({
      hiddenHarnessSections: ["onTheHorizon.mcp-integration"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const oh = result.onTheHorizon as { opportunities: unknown[] };
    expect(oh.opportunities).toHaveLength(0);
  });

  it("filters record-based harness sections (languages)", () => {
    const report = makeReport({ hiddenHarnessSections: ["languages.python"] });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const hd = result.harnessData as { languages: Record<string, number> };
    expect(hd.languages).toEqual({ TypeScript: 100 });
  });

  it("privacy regression: hidden item natural key must not appear in JSON response", () => {
    const report = makeReport({
      hiddenHarnessSections: ["skillInventory.superpowers-brainstorming"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("Superpowers Brainstorming");
  });

  it("privacy regression: hidden workflow must not appear in JSON response", () => {
    const report = makeReport({
      hiddenHarnessSections: ["impressiveWorkflows.parallel-refactor"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("Parallel Refactor");
  });

  it("backward compat: existing top-level keys continue to work", () => {
    const report = makeReport({
      hiddenHarnessSections: ["plugins", "languages"],
    });
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const hd = result.harnessData as {
      plugins: unknown[];
      languages: Record<string, number>;
    };
    expect(hd.plugins).toHaveLength(0);
    expect(Object.keys(hd.languages)).toHaveLength(0);
  });
});

// ── Showcase-field regressions (Unit 5 of skill-showcase plan) ────────────
//
// These guard against a regression where item-level keypath stripping would
// remove the visible skill entry but accidentally leave behind the heavy
// showcase fields (readme_markdown, hero_base64) somewhere in the response.
// The fields are populated only when extract was run with --include-skills,
// but the privacy contract applies regardless of how big the payload is.

function makeReportWithShowcase(hiddenHarnessSections: string[] = []) {
  return {
    id: "report-1",
    authorId: "user-1",
    harnessData: {
      stats: {
        totalTokens: 100,
        durationHours: 1,
        avgSessionMinutes: 1,
        skillsUsedCount: 2,
        hooksCount: 0,
        prCount: 0,
      },
      autonomy: {
        label: "high",
        description: "",
        userMessages: 1,
        assistantMessages: 1,
        turnCount: 2,
        errorRate: "0%",
      },
      featurePills: [],
      toolUsage: {},
      skillInventory: [
        {
          name: "Public Skill",
          calls: 10,
          source: "user",
          description: "shareable",
          readme_markdown: "# Public skill\n\nReady for everyone.",
          hero_base64: "PUBLICBASE64DATA",
          hero_mime_type: "image/png",
          category: "Productivity",
        },
        {
          name: "Secret Skill",
          calls: 5,
          source: "user",
          description: "private",
          readme_markdown: "# Secret skill\n\nIncludes private notes XYZQ.",
          hero_base64: "SECRETBASE64BLOB",
          hero_mime_type: "image/jpeg",
          category: "Productivity",
        },
      ],
      hookDefinitions: [],
      hookFrequency: {},
      plugins: [],
      harnessFiles: [],
      fileOpStyle: {
        readPct: 0,
        editPct: 0,
        writePct: 0,
        grepCount: 0,
        globCount: 0,
        style: "",
      },
      agentDispatch: null,
      cliTools: {},
      languages: {},
      models: {},
      permissionModes: {},
      mcpServers: {},
      gitPatterns: {
        prCount: 0,
        commitCount: 0,
        linesAdded: "0",
        branchPrefixes: {},
      },
      versions: [],
      writeupSections: [],
      workflowData: null,
      integrityHash: "",
    },
    hiddenHarnessSections,
  };
}

describe("filterReportForResponse — showcase fields", () => {
  it("hides item AND its showcase bytes when keypath matches", () => {
    const report = makeReportWithShowcase(["skillInventory.secret-skill"]);
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const skills = (
      result.harnessData as { skillInventory: Array<Record<string, unknown>> }
    ).skillInventory;
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Public Skill");

    // Defense in depth: the hidden skill's heavy bytes should not appear
    // anywhere in the serialized response, not just as an array entry.
    const json = JSON.stringify(result);
    expect(json).not.toContain("Secret Skill");
    expect(json).not.toContain("SECRETBASE64BLOB");
    expect(json).not.toContain("private notes XYZQ");
  });

  it("preserves showcase fields on visible skills", () => {
    const report = makeReportWithShowcase(["skillInventory.secret-skill"]);
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const skills = (
      result.harnessData as {
        skillInventory: Array<{
          name: string;
          readme_markdown?: string;
          hero_base64?: string;
          hero_mime_type?: string;
          category?: string;
        }>;
      }
    ).skillInventory;
    const visible = skills[0];
    expect(visible.readme_markdown).toBe(
      "# Public skill\n\nReady for everyone.",
    );
    expect(visible.hero_base64).toBe("PUBLICBASE64DATA");
    expect(visible.hero_mime_type).toBe("image/png");
    expect(visible.category).toBe("Productivity");
  });

  it("drops all showcase fields when section-level skillInventory is hidden", () => {
    const report = makeReportWithShowcase(["skillInventory"]);
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: false,
    });
    const skills = (result.harnessData as { skillInventory: unknown[] })
      .skillInventory;
    expect(skills).toHaveLength(0);
    const json = JSON.stringify(result);
    expect(json).not.toContain("PUBLICBASE64DATA");
    expect(json).not.toContain("SECRETBASE64BLOB");
  });

  it("owner with includeHidden=true gets full showcase data (for re-toggle in edit flow)", () => {
    const report = makeReportWithShowcase(["skillInventory.secret-skill"]);
    const result = filterReportForResponse(report, {
      viewerIsOwner: true,
      includeHidden: true,
    });
    const skills = (
      result.harnessData as {
        skillInventory: Array<{ name: string; hero_base64?: string }>;
      }
    ).skillInventory;
    expect(skills).toHaveLength(2);
    expect(skills[1].name).toBe("Secret Skill");
    expect(skills[1].hero_base64).toBe("SECRETBASE64BLOB");
  });

  it("non-owner with includeHidden=true still gets filtered (security)", () => {
    const report = makeReportWithShowcase(["skillInventory.secret-skill"]);
    const result = filterReportForResponse(report, {
      viewerIsOwner: false,
      includeHidden: true,
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("SECRETBASE64BLOB");
  });
});

// ── List-feed filter (for /api/top, /api/search, /api/insights list) ──────
//
// These test both the privacy property (hidden items stripped) AND the
// response-size property (heavy showcase bytes dropped even on visible
// skills so the homepage fetch doesn't balloon to multi-MB after users
// start uploading with --include-skills).

describe("filterReportForListFeed", () => {
  it("drops readme_markdown + hero_base64 from VISIBLE skills (response size)", () => {
    const report = makeReportWithShowcase([]);
    const result = filterReportForListFeed(report);
    const skills = (
      result.harnessData as {
        skillInventory: Array<Record<string, unknown>>;
      }
    ).skillInventory;
    for (const skill of skills) {
      expect(skill.readme_markdown).toBeNull();
      expect(skill.hero_base64).toBeNull();
      expect(skill.hero_mime_type).toBeNull();
    }
    // Non-showcase fields must be preserved so cards still render
    expect(skills[0].name).toBe("Public Skill");
    expect(skills[0].calls).toBe(10);
    expect(skills[0].source).toBe("user");
    expect(skills[0].description).toBe("shareable");
    expect(skills[0].category).toBe("Productivity");
  });

  it("strips hidden items entirely AND drops showcase bytes from visible skills", () => {
    const report = makeReportWithShowcase(["skillInventory.secret-skill"]);
    const result = filterReportForListFeed(report);
    const skills = (
      result.harnessData as {
        skillInventory: Array<{ name: string }>;
      }
    ).skillInventory;
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("Public Skill");

    // Hidden skill's bytes and visible skill's bytes both absent
    const json = JSON.stringify(result);
    expect(json).not.toContain("SECRETBASE64BLOB");
    expect(json).not.toContain("PUBLICBASE64DATA");
    expect(json).not.toContain("Secret Skill");
  });

  it("handles reports without harnessData without crashing", () => {
    const report = {
      id: "report-1",
      authorId: "user-1",
      hiddenHarnessSections: [] as string[],
    };
    expect(() => filterReportForListFeed(report)).not.toThrow();
    expect(filterReportForListFeed(report)).toEqual(report);
  });

  it("handles reports without showcase fields (back-compat)", () => {
    // Report predates --include-skills: no readme_markdown/hero_base64 on entries
    const report = {
      id: "report-1",
      authorId: "user-1",
      hiddenHarnessSections: [] as string[],
      harnessData: {
        skillInventory: [
          { name: "a", calls: 1, source: "user", description: "" },
        ],
      },
    };
    const result = filterReportForListFeed(report);
    const skills = (result.harnessData as { skillInventory: unknown[] })
      .skillInventory;
    expect(skills).toHaveLength(1);
    // Shape unchanged for old reports — no new null keys injected where
    // the source skill didn't have them
    expect(skills[0]).not.toHaveProperty("readme_markdown");
  });
});
