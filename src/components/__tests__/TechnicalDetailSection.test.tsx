import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TechnicalDetailSection from "@/components/TechnicalDetailSection";
import { hideSetFromArray } from "@/lib/item-visibility";
import type { HarnessData } from "@/types/insights";

// Minimal HarnessData with all six technical-detail fields empty by default.
// Each test populates only what it needs.
function makeHarness(overrides: Partial<HarnessData> = {}): HarnessData {
  return {
    stats: {
      totalTokens: 0,
      durationHours: 0,
      avgSessionMinutes: 0,
      skillsUsedCount: 0,
      hooksCount: 0,
      prCount: 0,
      sessionCount: 0,
      commitCount: 0,
    },
    autonomy: {
      label: "Guided",
      description: "",
      userMessages: 0,
      assistantMessages: 0,
      turnCount: 0,
      errorRate: "0%",
    },
    featurePills: [],
    toolUsage: {},
    skillInventory: [],
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
      style: "read-heavy",
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
    integrityHash: "hash",
    skillVersion: "2.10.0",
    ...overrides,
  };
}

function render(harnessData: HarnessData, hidden: string[] = []): string {
  return renderToStaticMarkup(
    <TechnicalDetailSection
      harnessData={harnessData}
      hiddenSet={hideSetFromArray(hidden)}
    />,
  );
}

// The disclosure is closed by default, so static markup contains the title but
// not the children. These tests exercise the new logic: the guard that decides
// whether the disclosure appears at all.
describe("TechnicalDetailSection", () => {
  it("renders nothing when every technical section is empty", () => {
    expect(render(makeHarness())).toBe("");
  });

  it("renders the disclosure when at least one section has content", () => {
    const html = render(makeHarness({ toolUsage: { Read: 5 } }));
    expect(html).toContain("Full technical detail");
  });

  it("renders nothing when the only populated sections are all hidden", () => {
    const harness = makeHarness({
      toolUsage: { Read: 5 },
      versions: ["1.2.3"],
    });
    expect(render(harness, ["toolUsage", "versions"])).toBe("");
  });

  it("still renders when a populated section survives a partial hide", () => {
    const harness = makeHarness({
      toolUsage: { Read: 5 },
      versions: ["1.2.3"],
    });
    // Hide toolUsage but versions remains → disclosure still appears.
    expect(render(harness, ["toolUsage"])).toContain("Full technical detail");
  });

  it("renders nothing when the only content is hidden at the item level", () => {
    // versions has one entry, hidden via its item-level keypath (not the
    // section key) — the disclosure must not appear with empty chrome.
    const harness = makeHarness({ versions: ["1.2.3"] });
    expect(render(harness, ["versions.1-2-3"])).toBe("");
  });

  it("treats each of the six fields as a content source", () => {
    const sources: Array<Partial<HarnessData>> = [
      { toolUsage: { Read: 1 } },
      { cliTools: { git: 1 } },
      { languages: { TypeScript: 1 } },
      { mcpServers: { sentry: 1 } },
      { versions: ["1.0.0"] },
      { harnessFiles: ["CLAUDE.md"] },
    ];
    for (const source of sources) {
      expect(render(makeHarness(source))).toContain("Full technical detail");
    }
  });
});
