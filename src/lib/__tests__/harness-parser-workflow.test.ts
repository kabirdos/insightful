import { describe, it, expect } from "vitest";
import { parseHarnessHtml } from "@/lib/harness-parser";

// ---------------------------------------------------------------------------
// Base HarnessData with workflow data embedded as JSON
// ---------------------------------------------------------------------------

const BASE_DATA = {
  stats: {
    totalTokens: 1200000,
    lifetimeTokens: 0,
    durationHours: 24,
    avgSessionMinutes: 45,
    skillsUsedCount: 3,
    hooksCount: 2,
    prCount: 0,
    sessionCount: 10,
    commitCount: 5,
  },
  autonomy: {
    label: "Directive",
    description: "test",
    userMessages: 50,
    assistantMessages: 200,
    turnCount: 100,
    errorRate: "2%",
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
  workflowData: null as null,
  integrityHash: "test123",
  skillVersion: null,
};

const WORKFLOW_DATA = {
  skillInvocations: {
    "ce-brainstorm": 8,
    "ce-work": 12,
    "git-commit-push-pr": 4,
  },
  agentDispatches: {
    "Run tests for auth module": 3,
    "Lint and format changed files": 2,
  },
  workflowPatterns: [
    {
      sequence: ["ce-brainstorm", "ce-work", "git-commit-push-pr"],
      count: 5,
    },
    { sequence: ["ce-work", "git-commit-push-pr"], count: 3 },
  ],
  phaseTransitions: {
    "exploration->implementation": 23,
    "implementation->testing": 15,
    "testing->shipping": 8,
  },
  phaseDistribution: {
    exploration: 40,
    implementation: 35,
    testing: 15,
    shipping: 10,
  },
  phaseStats: {
    testBeforeShipPct: 60,
    exploreBeforeImplPct: 75,
    totalSessionsWithPhases: 8,
  },
};

function buildHtml(data: unknown): string {
  const json = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
  return `
<html><body>
  <script id="harness-data" type="application/json">${json}</script>
  <script type="application/json" id="insight-harness-integrity">{"hash":"test123"}</script>
</body></html>`;
}

describe("harness-parser workflow data", () => {
  it("parses workflow phases from JSON", () => {
    const data = { ...BASE_DATA, workflowData: WORKFLOW_DATA };
    const result = parseHarnessHtml(buildHtml(data));
    expect(result.workflowData).not.toBeNull();
    expect(result.workflowData!.phaseDistribution).toEqual({
      exploration: 40,
      implementation: 35,
      testing: 15,
      shipping: 10,
    });
  });

  it("parses phase transitions", () => {
    const data = { ...BASE_DATA, workflowData: WORKFLOW_DATA };
    const result = parseHarnessHtml(buildHtml(data));
    expect(result.workflowData!.phaseTransitions).toEqual({
      "exploration->implementation": 23,
      "implementation->testing": 15,
      "testing->shipping": 8,
    });
  });

  it("parses skill invocations", () => {
    const data = { ...BASE_DATA, workflowData: WORKFLOW_DATA };
    const result = parseHarnessHtml(buildHtml(data));
    expect(result.workflowData!.skillInvocations).toEqual({
      "ce-brainstorm": 8,
      "ce-work": 12,
      "git-commit-push-pr": 4,
    });
  });

  it("parses agent dispatches", () => {
    const data = { ...BASE_DATA, workflowData: WORKFLOW_DATA };
    const result = parseHarnessHtml(buildHtml(data));
    expect(result.workflowData!.agentDispatches).toEqual({
      "Run tests for auth module": 3,
      "Lint and format changed files": 2,
    });
  });

  it("parses workflow patterns", () => {
    const data = { ...BASE_DATA, workflowData: WORKFLOW_DATA };
    const result = parseHarnessHtml(buildHtml(data));
    expect(result.workflowData!.workflowPatterns).toEqual([
      {
        sequence: ["ce-brainstorm", "ce-work", "git-commit-push-pr"],
        count: 5,
      },
      { sequence: ["ce-work", "git-commit-push-pr"], count: 3 },
    ]);
  });

  it("parses phase stats", () => {
    const data = { ...BASE_DATA, workflowData: WORKFLOW_DATA };
    const result = parseHarnessHtml(buildHtml(data));
    expect(result.workflowData!.phaseStats.exploreBeforeImplPct).toBe(75);
    expect(result.workflowData!.phaseStats.testBeforeShipPct).toBe(60);
    expect(result.workflowData!.phaseStats.totalSessionsWithPhases).toBe(8);
  });

  it("returns null workflowData when not present in JSON", () => {
    const data = { ...BASE_DATA, workflowData: null };
    const result = parseHarnessHtml(buildHtml(data));
    expect(result.workflowData).toBeNull();
  });

  it("returns null workflowData when field is omitted", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { workflowData, ...rest } = BASE_DATA;
    const result = parseHarnessHtml(buildHtml(rest));
    expect(result.workflowData).toBeNull();
  });
});
