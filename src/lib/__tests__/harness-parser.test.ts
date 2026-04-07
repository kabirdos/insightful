import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { isHarnessReport, parseHarnessHtml } from "../harness-parser";
import { parseInsightsHtml } from "../parser";

// Read the real HTML files for testing — these live on the developer's machine
// and won't exist in CI. Tests that need them use `it.skipIf` to degrade
// gracefully rather than fail.
const HARNESS_REPORT_PATH = resolve(
  process.env.HOME ?? "~",
  ".claude/usage-data/insight-harness.html",
);
const INSIGHTS_REPORT_PATH = resolve(
  process.env.HOME ?? "~",
  ".claude/usage-data/report.html",
);

const hasHarnessFile = existsSync(HARNESS_REPORT_PATH);
const hasInsightsFile = existsSync(INSIGHTS_REPORT_PATH);

let harnessHtml = "";
let insightsHtml = "";
if (hasHarnessFile) harnessHtml = readFileSync(HARNESS_REPORT_PATH, "utf-8");
if (hasInsightsFile) insightsHtml = readFileSync(INSIGHTS_REPORT_PATH, "utf-8");

// Shorthand for tests requiring the real harness file
const ith = it.skipIf(!hasHarnessFile);

describe("isHarnessReport", () => {
  ith("should detect insight-harness HTML as harness report", () => {
    expect(isHarnessReport(harnessHtml)).toBe(true);
  });

  it.skipIf(!hasInsightsFile)(
    "should detect plain insights HTML as NOT harness report",
    () => {
      expect(isHarnessReport(insightsHtml)).toBe(false);
    },
  );

  it("should return false for empty/minimal HTML", () => {
    expect(isHarnessReport("")).toBe(false);
    expect(isHarnessReport("<html><body></body></html>")).toBe(false);
  });
});

describe("parseHarnessHtml", () => {
  ith("should parse the real harness report without throwing", () => {
    expect(() => parseHarnessHtml(harnessHtml)).not.toThrow();
  });

  describe("stats", () => {
    ith("should extract harness stats from the stats grid", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.stats.totalTokens).toBeGreaterThan(0);
      expect(result.stats.durationHours).toBeGreaterThanOrEqual(0);
      expect(result.stats.skillsUsedCount).toBeGreaterThanOrEqual(0);
      expect(result.stats.hooksCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("autonomy", () => {
    ith("should extract autonomy data", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.autonomy.label).toBeTruthy();
      expect(
        ["Fire-and-Forget", "Directive", "Collaborative"].includes(
          result.autonomy.label,
        ),
      ).toBe(true);
      expect(result.autonomy.description).toBeTruthy();
    });

    ith("should extract autonomy message counts", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.autonomy.userMessages).toBeGreaterThanOrEqual(0);
      expect(result.autonomy.assistantMessages).toBeGreaterThanOrEqual(0);
    });
  });

  describe("feature pills", () => {
    ith("should extract feature pills", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.featurePills.length).toBeGreaterThan(0);
      for (const pill of result.featurePills) {
        expect(pill.name).toBeTruthy();
        expect(typeof pill.active).toBe("boolean");
      }
    });
  });

  describe("tool usage", () => {
    ith("should extract tool usage bar chart data", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(Object.keys(result.toolUsage).length).toBeGreaterThan(0);
      const tools = Object.keys(result.toolUsage);
      const hasCommonTool = tools.some((t) =>
        ["Read", "Edit", "Bash", "Grep", "Glob", "Write"].includes(t),
      );
      expect(hasCommonTool).toBe(true);
    });
  });

  describe("skill inventory", () => {
    ith("should extract skill entries", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.skillInventory.length).toBeGreaterThanOrEqual(0);
      if (result.skillInventory.length > 0) {
        const first = result.skillInventory[0];
        expect(first.name).toBeTruthy();
        expect(first.calls).toBeGreaterThanOrEqual(0);
        expect(["custom", "plugin", "unknown"]).toContain(first.source);
      }
    });
  });

  describe("hook definitions", () => {
    ith("should extract hook definitions", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.hookDefinitions.length).toBeGreaterThanOrEqual(0);
      if (result.hookDefinitions.length > 0) {
        const first = result.hookDefinitions[0];
        expect(first.event).toBeTruthy();
        expect(first.script).toBeTruthy();
      }
    });
  });

  describe("plugins", () => {
    ith("should extract plugin data", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.plugins.length).toBeGreaterThanOrEqual(0);
      if (result.plugins.length > 0) {
        expect(result.plugins[0].name).toBeTruthy();
        expect(typeof result.plugins[0].active).toBe("boolean");
      }
    });
  });

  describe("file operation style", () => {
    ith("should extract file operation ratios", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.fileOpStyle).toBeDefined();
      expect(result.fileOpStyle.readPct).toBeGreaterThanOrEqual(0);
      expect(result.fileOpStyle.editPct).toBeGreaterThanOrEqual(0);
      expect(result.fileOpStyle.writePct).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CLI tools", () => {
    ith("should extract CLI tool usage", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(Object.keys(result.cliTools).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("languages and models", () => {
    ith("should extract language data", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(Object.keys(result.languages).length).toBeGreaterThanOrEqual(0);
    });

    ith("should extract model data", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(Object.keys(result.models).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("git patterns", () => {
    ith("should extract git pattern data", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.gitPatterns).toBeDefined();
      expect(result.gitPatterns.prCount).toBeGreaterThanOrEqual(0);
      expect(result.gitPatterns.commitCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("writeup sections", () => {
    ith("should extract writeup sections", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.writeupSections.length).toBeGreaterThan(0);
      const first = result.writeupSections[0];
      expect(first.title).toBeTruthy();
      expect(first.contentHtml).toBeTruthy();
    });
  });

  describe("integrity hash", () => {
    ith("should extract the integrity hash", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.integrityHash).toBeTruthy();
    });
  });

  describe("versions", () => {
    ith("should extract version tags", () => {
      const result = parseHarnessHtml(harnessHtml);
      expect(result.versions.length).toBeGreaterThanOrEqual(0);
    });
  });

  it("should handle minimal HTML gracefully", () => {
    const minimal = "<html><body><div class='container'></div></body></html>";
    const result = parseHarnessHtml(minimal);
    expect(result.stats.totalTokens).toBe(0);
    expect(result.autonomy.label).toBe("");
    expect(result.featurePills).toEqual([]);
    expect(result.skillInventory).toEqual([]);
    expect(result.hookDefinitions).toEqual([]);
    expect(result.plugins).toEqual([]);
    expect(result.writeupSections).toEqual([]);
    expect(result.integrityHash).toBe("");
  });
});

describe("insights parser with harness HTML", () => {
  ith(
    "should still extract /insights data from the embedded insights tab",
    () => {
      const result = parseInsightsHtml(harnessHtml);
      expect(result.stats.sessionCount).toBeGreaterThanOrEqual(0);
    },
  );
});
