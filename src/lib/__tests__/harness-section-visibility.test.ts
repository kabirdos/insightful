import { describe, it, expect } from "vitest";
import { stripHiddenHarnessData } from "../harness-section-visibility";
import type { HarnessData } from "@/types/insights";

function buildFullHarnessData(): HarnessData {
  return {
    stats: {} as HarnessData["stats"],
    autonomy: {} as HarnessData["autonomy"],
    featurePills: [],
    toolUsage: { Read: 10, Edit: 5 },
    skillInventory: [
      { name: "Alpha" } as HarnessData["skillInventory"][number],
    ],
    hookDefinitions: [
      {
        event: "PreToolUse",
        matcher: "Bash",
      } as HarnessData["hookDefinitions"][number],
    ],
    hookFrequency: {},
    plugins: [{ name: "Plug" } as HarnessData["plugins"][number]],
    harnessFiles: ["CLAUDE.md"],
    fileOpStyle: {} as HarnessData["fileOpStyle"],
    agentDispatch: null,
    cliTools: { gh: 1 },
    languages: { ts: 1 },
    models: { opus: 1 },
    permissionModes: { default: 1 },
    mcpServers: { foo: 1 },
    gitPatterns: {
      prCount: 1,
      commitCount: 2,
      linesAdded: "100",
      branchPrefixes: { feat: 1 },
    },
    versions: ["1.0.0"],
    writeupSections: [{ title: "Intro", contentHtml: "<p>x</p>" }],
    workflowData: null,
    integrityHash: "abc",
    skillVersion: null,
  };
}

describe("stripHiddenHarnessData", () => {
  it("does not throw when array/object fields are missing (legacy schema)", () => {
    // Simulate an older-schema row missing several fields entirely.
    const partial = {
      stats: {},
      autonomy: {},
      featurePills: [],
      hookFrequency: {},
      fileOpStyle: {},
      agentDispatch: null,
      workflowData: null,
      integrityHash: "abc",
      skillVersion: null,
      // Intentionally missing: toolUsage, skillInventory, hookDefinitions,
      // plugins, harnessFiles, cliTools, languages, models, permissionModes,
      // mcpServers, gitPatterns, versions, writeupSections.
    } as unknown as HarnessData;

    expect(() =>
      stripHiddenHarnessData(partial, ["skillInventory"]),
    ).not.toThrow();

    const result = stripHiddenHarnessData(partial, ["skillInventory"]);
    expect(result.skillInventory).toEqual([]);
    expect(result.gitPatterns).toEqual({
      prCount: 0,
      commitCount: 0,
      linesAdded: "0",
      branchPrefixes: {},
    });
    // Other missing fields default to empty containers via the nullish-coalesce.
    expect(result.toolUsage).toEqual({});
    expect(result.plugins).toEqual([]);
    expect(result.versions).toEqual([]);
  });

  it("does not throw when gitPatterns is missing and a hidden section is requested", () => {
    const partial = {
      stats: {},
      autonomy: {},
      featurePills: [],
      hookFrequency: {},
      fileOpStyle: {},
      agentDispatch: null,
      workflowData: null,
      integrityHash: "abc",
      skillVersion: null,
      toolUsage: {},
      skillInventory: [],
      hookDefinitions: [],
      plugins: [],
      harnessFiles: [],
      cliTools: {},
      languages: {},
      models: {},
      permissionModes: {},
      mcpServers: {},
      versions: [],
      writeupSections: [],
      // gitPatterns missing
    } as unknown as HarnessData;

    expect(() => stripHiddenHarnessData(partial, ["plugins"])).not.toThrow();
  });

  it("returns data unchanged when there are no hidden sections (early return)", () => {
    const full = buildFullHarnessData();
    const result = stripHiddenHarnessData(full, []);
    expect(result).toBe(full);
  });

  it("round-trips full HarnessData with empty-array fields and a section hidden", () => {
    const full = buildFullHarnessData();
    full.versions = [];
    full.harnessFiles = [];

    const result = stripHiddenHarnessData(full, ["plugins"]);

    // Hidden section is wiped.
    expect(result.plugins).toEqual([]);
    // Empty array fields preserved.
    expect(result.versions).toEqual([]);
    expect(result.harnessFiles).toEqual([]);
    // Untouched fields round-trip.
    expect(result.skillInventory).toHaveLength(1);
    expect(result.cliTools).toEqual({ gh: 1 });
    expect(result.gitPatterns.prCount).toBe(1);
    expect(result.gitPatterns.branchPrefixes).toEqual({ feat: 1 });
  });
});
