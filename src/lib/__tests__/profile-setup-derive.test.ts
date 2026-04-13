import { describe, expect, it } from "vitest";
import { deriveSetupFromHarness } from "../profile-setup-derive";
import { stripHiddenHarnessData } from "../harness-section-visibility";
import type { HarnessData } from "@/types/insights";

function harness(partial: Partial<HarnessData>): HarnessData {
  // Minimal-but-realistic HarnessData stub. Every field the derive helper
  // reads is supplied through `partial`; unused fields get safe defaults.
  return {
    stats: {
      totalTokens: 0,
      sessionCount: 0,
      messageCount: 0,
      durationHours: 0,
      avgSessionMinutes: 0,
      commitCount: 0,
      prCount: 0,
    } as unknown as HarnessData["stats"],
    autonomy: { label: "balanced" } as unknown as HarnessData["autonomy"],
    featurePills: [],
    toolUsage: {},
    skillInventory: [],
    hookDefinitions: [],
    hookFrequency: {},
    plugins: [],
    harnessFiles: [],
    fileOpStyle: {
      dominant: "write",
    } as unknown as HarnessData["fileOpStyle"],
    agentDispatch: null,
    cliTools: {},
    languages: {},
    models: {},
    permissionModes: {},
    mcpServers: {},
    gitPatterns: {
      branchPrefixes: {},
      totalBranches: 0,
    } as unknown as HarnessData["gitPatterns"],
    versions: [],
    writeupSections: [],
    workflowData: null,
    integrityHash: "",
    skillVersion: null,
    ...partial,
  };
}

describe("deriveSetupFromHarness", () => {
  it("returns only primaryAgent for an empty harness", () => {
    const out = deriveSetupFromHarness(harness({}));
    expect(out).toEqual({ primaryAgent: "Claude Code" });
  });

  it("falls back to models (message count) when perModelTokens is absent", () => {
    const out = deriveSetupFromHarness(
      harness({ models: { "claude-sonnet-4": 100, "claude-opus-4": 30 } }),
    );
    expect(out.primaryModel).toBe("claude-sonnet-4");
  });

  it("prefers perModelTokens active tokens (input+output) over message count", () => {
    // Opus wins by message count, but Sonnet does vastly more active work.
    const out = deriveSetupFromHarness(
      harness({
        models: { "claude-opus-4": 100, "claude-sonnet-4": 50 },
        perModelTokens: {
          "claude-opus-4": {
            input: 1_000,
            output: 1_000,
            cache_read: 0,
            cache_create: 0,
          },
          "claude-sonnet-4": {
            input: 10_000,
            output: 10_000,
            cache_read: 9_000_000, // a lot of cache — must be ignored
            cache_create: 0,
          },
        },
      }),
    );
    expect(out.primaryModel).toBe("claude-sonnet-4");
  });

  it("emits top-N mcpServers sorted by count desc", () => {
    const mcpServers: Record<string, number> = {};
    for (let i = 0; i < 12; i++) mcpServers[`server-${i}`] = 100 - i;
    const out = deriveSetupFromHarness(harness({ mcpServers }));
    expect(out.mcpServers?.length).toBe(8);
    expect(out.mcpServers?.[0]).toBe("server-0");
    expect(out.mcpServers?.[7]).toBe("server-7");
  });

  it("picks highest-count package manager from cliTools", () => {
    const out = deriveSetupFromHarness(
      harness({ cliTools: { pnpm: 200, npm: 50, git: 5_000, ls: 1_000 } }),
    );
    expect(out.packageManager).toBe("pnpm");
  });

  it("returns no packageManager when cliTools has none matching", () => {
    const out = deriveSetupFromHarness(
      harness({ cliTools: { git: 5_000, curl: 100, rg: 800 } }),
    );
    expect(out.packageManager).toBeUndefined();
  });

  it("detects Windows from harnessFiles paths WITHOUT returning the path", () => {
    const winPath = "C:\\Users\\alice\\AppData\\Roaming\\something";
    const out = deriveSetupFromHarness(harness({ harnessFiles: [winPath] }));
    expect(out.os).toBe("Windows");
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("C:");
    expect(serialized).not.toContain("alice");
    expect(serialized).not.toContain("AppData");
  });

  it("detects Linux from versions strings", () => {
    const out = deriveSetupFromHarness(
      harness({ versions: ["node-22.1.0-linux-x64"] }),
    );
    expect(out.os).toBe("Linux");
  });

  it("detects macOS from harnessFiles user path", () => {
    const out = deriveSetupFromHarness(
      harness({ harnessFiles: ["/Users/craig/.claude/skills/foo"] }),
    );
    expect(out.os).toBe("macOS");
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("/Users");
    expect(serialized).not.toContain("craig");
  });

  it("returns no os when no path-like evidence is present", () => {
    const out = deriveSetupFromHarness(
      harness({ harnessFiles: ["relative/path/without/marker.md"] }),
    );
    expect(out.os).toBeUndefined();
  });

  it("respects stripHiddenHarnessData: hidden mcpServers yields no suggestion", () => {
    const full = harness({
      mcpServers: { serena: 5, playwright: 2 },
      cliTools: { pnpm: 10 },
    });
    const filtered = stripHiddenHarnessData(full, ["mcpServers"]);
    const out = deriveSetupFromHarness(filtered);
    expect(out.mcpServers).toBeUndefined();
    // packageManager still derives (cliTools not hidden)
    expect(out.packageManager).toBe("pnpm");
  });

  it("respects stripHiddenHarnessData: hidden cliTools yields no packageManager", () => {
    const full = harness({
      cliTools: { pnpm: 10 },
      mcpServers: { serena: 5 },
    });
    const filtered = stripHiddenHarnessData(full, ["cliTools"]);
    const out = deriveSetupFromHarness(filtered);
    expect(out.packageManager).toBeUndefined();
    expect(out.mcpServers).toEqual(["serena"]);
  });
});
