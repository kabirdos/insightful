import { describe, it, expect } from "vitest";
import { isHarnessReport, parseHarnessHtml } from "../harness-parser";

// ---------------------------------------------------------------------------
// Minimal HarnessData JSON matching the HarnessData interface
// ---------------------------------------------------------------------------

const MINIMAL_HARNESS_DATA = {
  stats: {
    totalTokens: 1200000,
    lifetimeTokens: 9500000,
    durationHours: 18,
    avgSessionMinutes: 25.5,
    skillsUsedCount: 5,
    hooksCount: 3,
    prCount: 7,
    sessionCount: 42,
    commitCount: 23,
  },
  autonomy: {
    label: "Fire-and-Forget",
    description: "You launch tasks and let Claude run",
    userMessages: 150,
    assistantMessages: 800,
    turnCount: 950,
    errorRate: "2%",
  },
  featurePills: [
    { name: "Task Agents", active: true, value: "12%" },
    { name: "MCP Servers", active: false, value: "" },
    { name: "Custom Skills", active: true, value: "45%" },
  ],
  toolUsage: { Read: 1500, Edit: 800, Bash: 2200 },
  skillInventory: [
    {
      name: "commit",
      calls: 12,
      source: "custom",
      description: "Auto-commit helper",
    },
    {
      name: "review-pr",
      calls: 5,
      source: "plugin",
      description: "PR reviewer",
    },
  ],
  hookDefinitions: [
    { event: "PreToolUse", matcher: "Bash", script: "validate-bash.sh" },
    { event: "PostToolUse", matcher: "Edit", script: "format-on-save.sh" },
  ],
  hookFrequency: { PreToolUse: 45, PostToolUse: 12 },
  plugins: [
    {
      name: "superpowers",
      version: "2.1.0",
      marketplace: "compound-engineering",
      active: true,
    },
  ],
  harnessFiles: ["CLAUDE.md", ".claude/settings.json"],
  fileOpStyle: {
    readPct: 45,
    editPct: 40,
    writePct: 15,
    grepCount: 120,
    globCount: 80,
    style: "Surgical Editor",
  },
  agentDispatch: null,
  cliTools: { git: 50, npm: 20 },
  languages: { TypeScript: 80, Python: 20 },
  models: { "claude-sonnet-4-20250514": 90, "claude-haiku-4-20250514": 10 },
  permissionModes: { allowedTools: 5 },
  mcpServers: { filesystem: 30 },
  gitPatterns: {
    prCount: 7,
    commitCount: 23,
    linesAdded: "1200",
    branchPrefixes: { "feat/": 8, "fix/": 12 },
  },
  versions: ["1.0.33", "1.0.34"],
  writeupSections: [
    {
      title: "Workflow Analysis",
      contentHtml: "<p>You use Claude Code heavily for refactoring.</p>",
    },
    {
      title: "Tool Preferences",
      contentHtml: "<p>Strong preference for Edit over Write.</p>",
    },
  ],
  workflowData: null,
  integrityHash: "abc123def456",
  skillVersion: "2.3.0",
  enhancedStats: {
    linesAdded: 1200,
    linesRemoved: 300,
    fileCount: 45,
    dayCount: 28,
    msgsPerDay: 12.5,
  },
};

function buildHarnessHtml(
  data: unknown,
  opts?: { reverseAttrs?: boolean },
): string {
  const json = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
  const attrs = opts?.reverseAttrs
    ? 'type="application/json" id="harness-data"'
    : 'id="harness-data" type="application/json"';
  return `
<html><body>
  <script ${attrs}>${json}</script>
  <script type="application/json" id="insight-harness-integrity">{"hash":"abc123def456"}</script>
</body></html>`;
}

const MINIMAL_HARNESS_HTML = buildHarnessHtml(MINIMAL_HARNESS_DATA);

// ---------------------------------------------------------------------------
// isHarnessReport
// ---------------------------------------------------------------------------

describe("isHarnessReport", () => {
  it("detects harness report by integrity script tag", () => {
    expect(isHarnessReport(MINIMAL_HARNESS_HTML)).toBe(true);
  });

  it("returns false for plain insights HTML", () => {
    const insightsHtml =
      '<html><body><div class="subtitle">100 messages across 10 sessions</div></body></html>';
    expect(isHarnessReport(insightsHtml)).toBe(false);
  });

  it("returns false for empty/minimal HTML", () => {
    expect(isHarnessReport("")).toBe(false);
    expect(isHarnessReport("<html><body></body></html>")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseHarnessHtml — happy path
// ---------------------------------------------------------------------------

describe("parseHarnessHtml", () => {
  it("parses valid JSON into HarnessData without throwing", () => {
    expect(() => parseHarnessHtml(MINIMAL_HARNESS_HTML)).not.toThrow();
  });

  describe("stats", () => {
    it("extracts all stat fields with correct types", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.stats.totalTokens).toBe(1200000);
      expect(result.stats.lifetimeTokens).toBe(9500000);
      expect(result.stats.durationHours).toBe(18);
      expect(result.stats.avgSessionMinutes).toBe(25.5);
      expect(result.stats.skillsUsedCount).toBe(5);
      expect(result.stats.hooksCount).toBe(3);
      expect(result.stats.prCount).toBe(7);
      expect(result.stats.sessionCount).toBe(42);
      expect(result.stats.commitCount).toBe(23);
    });
  });

  describe("autonomy", () => {
    it("extracts autonomy fields", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.autonomy.label).toBe("Fire-and-Forget");
      expect(result.autonomy.description).toBe(
        "You launch tasks and let Claude run",
      );
      expect(result.autonomy.userMessages).toBe(150);
      expect(result.autonomy.assistantMessages).toBe(800);
      expect(result.autonomy.turnCount).toBe(950);
      expect(result.autonomy.errorRate).toBe("2%");
    });
  });

  describe("feature pills", () => {
    it("extracts pill names, active state, and values", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.featurePills).toHaveLength(3);
      expect(result.featurePills[0]).toEqual({
        name: "Task Agents",
        active: true,
        value: "12%",
      });
      expect(result.featurePills[1]).toEqual({
        name: "MCP Servers",
        active: false,
        value: "",
      });
      expect(result.featurePills[2]).toEqual({
        name: "Custom Skills",
        active: true,
        value: "45%",
      });
    });
  });

  describe("tool usage", () => {
    it("extracts tool usage as record", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.toolUsage).toEqual({ Read: 1500, Edit: 800, Bash: 2200 });
    });
  });

  describe("skill inventory", () => {
    it("extracts skill entries", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.skillInventory).toHaveLength(2);
      expect(result.skillInventory[0]).toEqual({
        name: "commit",
        calls: 12,
        source: "custom",
        description: "Auto-commit helper",
      });
      expect(result.skillInventory[1]).toEqual({
        name: "review-pr",
        calls: 5,
        source: "plugin",
        description: "PR reviewer",
      });
    });
  });

  describe("hook definitions", () => {
    it("extracts hook definitions", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.hookDefinitions).toHaveLength(2);
      expect(result.hookDefinitions[0]).toEqual({
        event: "PreToolUse",
        matcher: "Bash",
        script: "validate-bash.sh",
      });
    });
  });

  describe("plugins", () => {
    it("extracts plugin info", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0]).toEqual({
        name: "superpowers",
        version: "2.1.0",
        marketplace: "compound-engineering",
        active: true,
      });
    });
  });

  describe("file operation style", () => {
    it("extracts file op style", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.fileOpStyle.readPct).toBe(45);
      expect(result.fileOpStyle.editPct).toBe(40);
      expect(result.fileOpStyle.writePct).toBe(15);
      expect(result.fileOpStyle.grepCount).toBe(120);
      expect(result.fileOpStyle.globCount).toBe(80);
      expect(result.fileOpStyle.style).toBe("Surgical Editor");
    });
  });

  describe("git patterns", () => {
    it("extracts git patterns", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.gitPatterns.prCount).toBe(7);
      expect(result.gitPatterns.commitCount).toBe(23);
      expect(result.gitPatterns.branchPrefixes).toEqual({
        "feat/": 8,
        "fix/": 12,
      });
    });
  });

  describe("writeup sections", () => {
    it("extracts writeup sections", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.writeupSections).toHaveLength(2);
      expect(result.writeupSections[0].title).toBe("Workflow Analysis");
      expect(result.writeupSections[0].contentHtml).toContain(
        "use Claude Code heavily",
      );
      expect(result.writeupSections[1].title).toBe("Tool Preferences");
    });
  });

  describe("integrity hash and versions", () => {
    it("extracts integrity hash", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.integrityHash).toBe("abc123def456");
    });

    it("extracts version tags", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.versions).toEqual(["1.0.33", "1.0.34"]);
    });

    it("extracts skill version", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.skillVersion).toBe("2.3.0");
    });
  });

  describe("enhanced stats", () => {
    it("extracts enhancedStats when present", () => {
      const result = parseHarnessHtml(MINIMAL_HARNESS_HTML);
      expect(result.enhancedStats).toEqual({
        linesAdded: 1200,
        linesRemoved: 300,
        fileCount: 45,
        dayCount: 28,
        msgsPerDay: 12.5,
      });
    });

    it("returns null enhancedStats when missing", () => {
      const dataWithout = { ...MINIMAL_HARNESS_DATA };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { enhancedStats, ...rest } = dataWithout;
      const html = buildHarnessHtml(rest);
      const result = parseHarnessHtml(html);
      expect(result.enhancedStats).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------

  describe("error cases", () => {
    it("throws descriptive error when harness-data tag is missing", () => {
      const html =
        '<html><body><script type="application/json" id="insight-harness-integrity">{"hash":"x"}</script></body></html>';
      expect(() => parseHarnessHtml(html)).toThrow(
        /missing the embedded data blob/,
      );
    });

    it("throws descriptive error for malformed JSON", () => {
      const html =
        '<html><body><script id="harness-data" type="application/json">{not valid json}</script></body></html>';
      expect(() => parseHarnessHtml(html)).toThrow(/malformed JSON/);
    });

    it("throws error when JSON is missing required fields", () => {
      const html = buildHarnessHtml({ foo: "bar" });
      expect(() => parseHarnessHtml(html)).toThrow(/missing required fields/);
    });
  });

  // ---------------------------------------------------------------------------
  // Attribute order robustness
  // ---------------------------------------------------------------------------

  describe("attribute order", () => {
    it("works with reversed attribute order (type before id)", () => {
      const html = buildHarnessHtml(MINIMAL_HARNESS_DATA, {
        reverseAttrs: true,
      });
      const result = parseHarnessHtml(html);
      expect(result.stats.totalTokens).toBe(1200000);
      expect(result.stats.sessionCount).toBe(42);
    });
  });

  // ---------------------------------------------------------------------------
  // XSS sanitization
  // ---------------------------------------------------------------------------

  describe("XSS sanitization", () => {
    it("strips script tags from contentHtml", () => {
      const data = {
        ...MINIMAL_HARNESS_DATA,
        writeupSections: [
          {
            title: "Test",
            contentHtml: "<p>Safe</p><script>alert(1)</script><p>Also safe</p>",
          },
        ],
      };
      const html = buildHarnessHtml(data);
      const result = parseHarnessHtml(html);
      expect(result.writeupSections[0].contentHtml).not.toContain("<script>");
      expect(result.writeupSections[0].contentHtml).toContain("<p>Safe</p>");
      expect(result.writeupSections[0].contentHtml).toContain(
        "<p>Also safe</p>",
      );
    });

    it("strips event handler attributes from contentHtml", () => {
      const data = {
        ...MINIMAL_HARNESS_DATA,
        writeupSections: [
          {
            title: "Test",
            contentHtml:
              '<img src="x" onerror="alert(1)"><div onclick="steal()">text</div>',
          },
        ],
      };
      const html = buildHarnessHtml(data);
      const result = parseHarnessHtml(html);
      expect(result.writeupSections[0].contentHtml).not.toContain("onerror");
      expect(result.writeupSections[0].contentHtml).not.toContain("onclick");
      // img is not in the allowlist, so it gets stripped entirely
      expect(result.writeupSections[0].contentHtml).not.toContain("<img");
      expect(result.writeupSections[0].contentHtml).toContain("text");
    });

    it("strips iframe, object, and embed tags", () => {
      const data = {
        ...MINIMAL_HARNESS_DATA,
        writeupSections: [
          {
            title: "Test",
            contentHtml:
              '<p>OK</p><iframe src="evil.com"></iframe><object data="x"></object><embed src="y">',
          },
        ],
      };
      const html = buildHarnessHtml(data);
      const result = parseHarnessHtml(html);
      expect(result.writeupSections[0].contentHtml).not.toContain("<iframe");
      expect(result.writeupSections[0].contentHtml).not.toContain("<object");
      expect(result.writeupSections[0].contentHtml).not.toContain("<embed");
      expect(result.writeupSections[0].contentHtml).toContain("<p>OK</p>");
    });

    it("strips javascript: URLs from href", () => {
      const data = {
        ...MINIMAL_HARNESS_DATA,
        writeupSections: [
          {
            title: "Test",
            contentHtml:
              '<a href="javascript:alert(1)">click</a><a href="https://safe.com">safe</a>',
          },
        ],
      };
      const html = buildHarnessHtml(data);
      const result = parseHarnessHtml(html);
      expect(result.writeupSections[0].contentHtml).not.toContain(
        "javascript:",
      );
      expect(result.writeupSections[0].contentHtml).toContain(
        "https://safe.com",
      );
    });

    it("strips svg and math tags", () => {
      const data = {
        ...MINIMAL_HARNESS_DATA,
        writeupSections: [
          {
            title: "Test",
            contentHtml:
              '<svg onload="alert(1)"><circle r="10"/></svg><math><maction href="javascript:alert(1)">x</maction></math><p>safe</p>',
          },
        ],
      };
      const html = buildHarnessHtml(data);
      const result = parseHarnessHtml(html);
      expect(result.writeupSections[0].contentHtml).not.toContain("<svg");
      expect(result.writeupSections[0].contentHtml).not.toContain("<math");
      expect(result.writeupSections[0].contentHtml).toContain("<p>safe</p>");
    });

    it("strips arbitrary on* event handlers", () => {
      const data = {
        ...MINIMAL_HARNESS_DATA,
        writeupSections: [
          {
            title: "Test",
            contentHtml:
              '<div onfocus="steal()" onanimationstart="xss()" onpointerenter="hack()">text</div>',
          },
        ],
      };
      const html = buildHarnessHtml(data);
      const result = parseHarnessHtml(html);
      expect(result.writeupSections[0].contentHtml).not.toContain("onfocus");
      expect(result.writeupSections[0].contentHtml).not.toContain(
        "onanimationstart",
      );
      expect(result.writeupSections[0].contentHtml).not.toContain(
        "onpointerenter",
      );
      expect(result.writeupSections[0].contentHtml).toContain("text");
    });

    it("strips form and input tags", () => {
      const data = {
        ...MINIMAL_HARNESS_DATA,
        writeupSections: [
          {
            title: "Test",
            contentHtml:
              '<form action="javascript:alert(1)"><input autofocus onfocus="alert(1)"></form><p>safe</p>',
          },
        ],
      };
      const html = buildHarnessHtml(data);
      const result = parseHarnessHtml(html);
      expect(result.writeupSections[0].contentHtml).not.toContain("<form");
      expect(result.writeupSections[0].contentHtml).not.toContain("<input");
      expect(result.writeupSections[0].contentHtml).toContain("<p>safe</p>");
    });
  });

  // ---------------------------------------------------------------------------
  // Optional fields / normalizeHarnessData defaults
  // ---------------------------------------------------------------------------

  describe("optional fields", () => {
    it("fills defaults for missing optional fields", () => {
      const minimal = {
        stats: MINIMAL_HARNESS_DATA.stats,
        autonomy: MINIMAL_HARNESS_DATA.autonomy,
        featurePills: MINIMAL_HARNESS_DATA.featurePills,
      };
      const html = buildHarnessHtml(minimal);
      const result = parseHarnessHtml(html);
      expect(result.toolUsage).toEqual({});
      expect(result.skillInventory).toEqual([]);
      expect(result.hookDefinitions).toEqual([]);
      expect(result.plugins).toEqual([]);
      expect(result.harnessFiles).toEqual([]);
      expect(result.versions).toEqual([]);
      expect(result.writeupSections).toEqual([]);
      expect(result.workflowData).toBeNull();
      expect(result.integrityHash).toBe("");
      expect(result.skillVersion).toBeNull();
      expect(result.enhancedStats).toBeNull();
    });
  });
});
