import { describe, expect, it } from "vitest";
import {
  getClaudeHarnessData,
  getCodexHarnessData,
  listHarnessTools,
  normalizeHarnessData,
  normalizeHarnessEnvelope,
  toStoredHarnessData,
  type CodexHarnessData,
  type HarnessData,
} from "@/types/insights";

function legacyClaude(overrides: Partial<HarnessData> = {}): HarnessData {
  return {
    stats: {
      totalTokens: 1000,
      durationHours: 4,
      avgSessionMinutes: 24,
      skillsUsedCount: 2,
      hooksCount: 1,
      prCount: 3,
      sessionCount: 8,
      commitCount: 5,
    },
    autonomy: {
      label: "Guided",
      description: "Mostly supervised",
      userMessages: 10,
      assistantMessages: 20,
      turnCount: 30,
      errorRate: "1%",
    },
    featurePills: [],
    toolUsage: { Read: 4 },
    skillInventory: [
      { name: "review", calls: 2, source: "custom", description: "Review" },
    ],
    hookDefinitions: [],
    hookFrequency: {},
    plugins: [],
    harnessFiles: [],
    fileOpStyle: {
      readPct: 60,
      editPct: 30,
      writePct: 10,
      grepCount: 1,
      globCount: 1,
      style: "read-heavy",
    },
    agentDispatch: null,
    cliTools: {},
    languages: {},
    models: {},
    permissionModes: {},
    mcpServers: {},
    gitPatterns: {
      prCount: 3,
      commitCount: 5,
      linesAdded: "100",
      branchPrefixes: {},
    },
    versions: [],
    writeupSections: [],
    workflowData: null,
    integrityHash: "hash",
    skillVersion: "2.8.0",
    ...overrides,
  };
}

function codex(overrides: Partial<CodexHarnessData> = {}): CodexHarnessData {
  return {
    tool: "codex",
    stats: {
      totalTokens: 2000,
      sessionCount: 12,
      payloadFormatSessions: 10,
      legacyFormatSessions: 2,
    },
    toolUsage: { exec_command: 8 },
    cliTools: { git: 3 },
    skillInventory: [{ name: "code-review", description: "Review code" }],
    plugins: [{ name: "github", enabled: true }],
    safety: {
      approvalsReviewer: "model",
      approvalModes: ["approve"],
      trustLevels: ["trusted"],
      rulesAllowlist: ["git"],
    },
    workflowData: {
      phaseTransitions: {},
    },
    workSurfaces: {
      desktopPresence: [{ tool: "Codex CLI", present: true }],
    },
    localOnly: true,
    ...overrides,
  };
}

describe("harness tools normalization", () => {
  it("treats legacy top-level HarnessData as the Claude Code tool", () => {
    const raw = legacyClaude();

    expect(listHarnessTools(raw)).toEqual(["claude-code"]);
    expect(normalizeHarnessData(raw)?.stats.totalTokens).toBe(1000);
    expect(getClaudeHarnessData(raw)?.skillInventory[0].name).toBe("review");
    expect(getCodexHarnessData(raw)).toBeNull();
  });

  it("accepts a Codex Phase 1 tool island", () => {
    const raw = codex();

    expect(listHarnessTools(raw)).toEqual(["codex"]);
    expect(getClaudeHarnessData(raw)).toBeNull();
    expect(getCodexHarnessData(raw)?.stats.totalTokens).toBe(2000);
    expect(getCodexHarnessData(raw)?.skillInventory[0].calls).toBeUndefined();
  });

  it("accepts a combined tools envelope", () => {
    const raw = {
      primaryTool: "claude-code",
      tools: {
        "claude-code": legacyClaude(),
        codex: codex(),
      },
    };

    expect(listHarnessTools(raw)).toEqual(["claude-code", "codex"]);
    expect(normalizeHarnessEnvelope(raw)?.primaryTool).toBe("claude-code");
    expect(getClaudeHarnessData(raw)?.stats.totalTokens).toBe(1000);
    expect(getCodexHarnessData(raw)?.stats.totalTokens).toBe(2000);
  });

  it("ignores malformed tool entries without rejecting the valid ones", () => {
    const raw = {
      primaryTool: "codex",
      tools: {
        "claude-code": { stats: {} },
        codex: codex(),
        unknown: { anything: true },
      },
    };

    expect(listHarnessTools(raw)).toEqual(["codex"]);
    expect(normalizeHarnessEnvelope(raw)?.primaryTool).toBe("codex");
  });

  it("returns null for empty or malformed envelopes", () => {
    expect(normalizeHarnessEnvelope(null)).toBeNull();
    expect(normalizeHarnessEnvelope({ tools: {} })).toBeNull();
    expect(normalizeHarnessEnvelope({ tool: "codex", stats: null })).toBeNull();
  });

  it("stores every accepted shape as a tools envelope", () => {
    expect(toStoredHarnessData(legacyClaude())).toMatchObject({
      primaryTool: "claude-code",
      tools: { "claude-code": { stats: { totalTokens: 1000 } } },
    });
    expect(toStoredHarnessData(codex())).toMatchObject({
      primaryTool: "codex",
      tools: { codex: { tool: "codex", stats: { totalTokens: 2000 } } },
    });
  });
});
