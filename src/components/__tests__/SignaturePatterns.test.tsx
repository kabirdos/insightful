import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SignaturePatterns from "@/components/SignaturePatterns";
import type { HarnessData } from "@/types/insights";

function makeHarnessData(overrides: Partial<HarnessData> = {}): HarnessData {
  return {
    stats: {
      totalTokens: 0,
      durationHours: 0,
      avgSessionMinutes: 0,
      skillsUsedCount: 0,
      hooksCount: 0,
      prCount: 0,
    },
    autonomy: {
      label: "",
      description: "",
      userMessages: 0,
      assistantMessages: 0,
      turnCount: 0,
      errorRate: "",
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
    skillVersion: null,
    ...overrides,
  };
}

describe("SignaturePatterns", () => {
  it("renders nothing when no pattern qualifies", () => {
    expect(
      renderToStaticMarkup(
        <SignaturePatterns harnessData={makeHarnessData()} />,
      ),
    ).toBe("");
    expect(renderToStaticMarkup(<SignaturePatterns harnessData={null} />)).toBe(
      "",
    );
  });

  it("renders the section header, lead card, and grid cards when patterns exist", () => {
    const html = renderToStaticMarkup(
      <SignaturePatterns
        harnessData={makeHarnessData({
          autonomy: {
            label: "Fire-and-Forget",
            description: "",
            userMessages: 2038,
            assistantMessages: 26832,
            turnCount: 0,
            errorRate: "3.4%",
          },
          permissionModes: { bypassPermissions: 99, default: 1 },
          agentDispatch: {
            totalAgents: 304,
            types: { "general-purpose": 216 },
            models: { "claude-sonnet-4-5": 69, "claude-opus-4-6": 18 },
            backgroundPct: 45,
            customAgents: [],
          },
        })}
      />,
    );
    expect(html).toContain("Signature patterns");
    expect(html).toContain("Fire-and-Forget"); // lead card headline
    expect(html).toContain("Orchestrates 304 sub-agents"); // grid card
    expect(html).toContain("Verified");
    expect(html).toContain("304 agents"); // proof line rendered
  });
});
