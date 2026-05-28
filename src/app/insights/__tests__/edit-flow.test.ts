import { describe, it, expect } from "vitest";
import { ALLOWED_PUT_FIELDS } from "@/app/api/insights/allowed-fields";
import {
  buildCodexVisibilityKey,
  getEditHarnessPreviewData,
} from "@/app/insights/[username]/[slug]/edit/page";
import type { CodexHarnessData, HarnessData } from "@/types/insights";

function legacyClaude(overrides: Partial<HarnessData> = {}): HarnessData {
  return {
    stats: {
      totalTokens: 1000,
      durationHours: 4,
      avgSessionMinutes: 24,
      skillsUsedCount: 1,
      hooksCount: 0,
      prCount: 1,
      sessionCount: 3,
      commitCount: 2,
    },
    autonomy: {
      label: "Guided",
      description: "Mostly supervised",
      userMessages: 5,
      assistantMessages: 10,
      turnCount: 15,
      errorRate: "0%",
    },
    featurePills: [],
    toolUsage: { Read: 2 },
    skillInventory: [
      { name: "review", calls: 1, source: "custom", description: "Review" },
    ],
    hookDefinitions: [],
    hookFrequency: {},
    plugins: [],
    harnessFiles: [],
    fileOpStyle: {
      readPct: 70,
      editPct: 20,
      writePct: 10,
      grepCount: 1,
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
      prCount: 1,
      commitCount: 2,
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
    stats: { totalTokens: 2000, sessionCount: 7 },
    toolUsage: { exec_command: 5 },
    cliTools: { git: 3 },
    skillInventory: [{ name: "code-review", description: "Review code" }],
    plugins: [{ name: "github", enabled: true }],
    safety: {
      approvalsReviewer: "model",
      approvalModes: ["approve"],
      trustLevels: ["trusted"],
      rulesAllowlist: ["git"],
    },
    workflowData: { phaseTransitions: {} },
    workSurfaces: { desktopPresence: [{ tool: "Codex CLI" }] },
    localOnly: true,
    ...overrides,
  };
}

describe("Edit report visibility flow", () => {
  it("should allow nulling out a section via PUT", () => {
    // Test that the PUT endpoint accepts null for section fields
    const body = { atAGlance: null, suggestions: null };

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_PUT_FIELDS) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ atAGlance: null, suggestions: null });
  });

  it("should reject harnessData in PUT body", () => {
    // harnessData must not be in the allowlist (XSS vector via dangerouslySetInnerHTML)
    expect(ALLOWED_PUT_FIELDS).not.toContain("harnessData");
  });

  it("derives the Claude slice for legacy and envelope edit previews", () => {
    const legacyPreview = getEditHarnessPreviewData(legacyClaude());
    expect(legacyPreview.availableTools).toEqual(["claude-code"]);
    expect(legacyPreview.claudeHarnessData?.stats.totalTokens).toBe(1000);
    expect(legacyPreview.codexHarnessData).toBeNull();

    const envelopePreview = getEditHarnessPreviewData({
      primaryTool: "claude-code",
      tools: {
        "claude-code": legacyClaude(),
        codex: codex(),
      },
    });
    expect(envelopePreview.availableTools).toEqual(["claude-code", "codex"]);
    expect(envelopePreview.claudeHarnessData?.skillInventory[0].name).toBe(
      "review",
    );
    expect(envelopePreview.codexHarnessData?.skillInventory[0].name).toBe(
      "code-review",
    );
  });

  it("derives a Codex-only edit preview without requiring a Claude slice", () => {
    const preview = getEditHarnessPreviewData(codex());

    expect(preview.availableTools).toEqual(["codex"]);
    expect(preview.claudeHarnessData).toBeNull();
    expect(preview.codexHarnessData?.stats.totalTokens).toBe(2000);
  });

  it("builds namespaced Codex visibility keys", () => {
    expect(buildCodexVisibilityKey("skillInventory")).toBe(
      "tools.codex.skillInventory",
    );
    expect(buildCodexVisibilityKey("skillInventory", "code-review")).toBe(
      "tools.codex.skillInventory.code-review",
    );
    expect(buildCodexVisibilityKey("safety")).toBe("tools.codex.safety");
    expect(buildCodexVisibilityKey("workSurfaces")).toBe(
      "tools.codex.workSurfaces",
    );
  });

  it("should allow nulling stat fields", () => {
    const body = { sessionCount: null, totalTokens: null };

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_PUT_FIELDS) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ sessionCount: null, totalTokens: null });
  });
});
