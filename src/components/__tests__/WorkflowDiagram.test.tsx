import { describe, it, expect } from "vitest";
import { buildStateDiagram } from "@/components/WorkflowDiagram";
import { buildFlowDiagram } from "@/components/ToolTransitionFlow";
import type { HarnessWorkflowData } from "@/types/insights";

// --- buildStateDiagram ---

describe("buildStateDiagram", () => {
  it("returns empty string for empty input", () => {
    const data: HarnessWorkflowData = {
      toolTransitions: {},
      phaseTransitions: {},
      phaseDistribution: {},
      phaseStats: {
        testBeforeShipPct: 0,
        exploreBeforeImplPct: 0,
        totalSessionsWithPhases: 0,
      },
    };
    expect(buildStateDiagram(data)).toBe("");
  });

  it("produces valid stateDiagram-v2 header for typical input", () => {
    const data: HarnessWorkflowData = {
      toolTransitions: {},
      phaseTransitions: { "exploration->implementation": 10 },
      phaseDistribution: { exploration: 60, implementation: 40 },
      phaseStats: {
        testBeforeShipPct: 0,
        exploreBeforeImplPct: 80,
        totalSessionsWithPhases: 5,
      },
    };
    const result = buildStateDiagram(data);
    expect(result).toContain("stateDiagram-v2");
    expect(result).toContain("exploration");
    expect(result).toContain("implementation");
    expect(result).toContain("-->");
  });

  it("does not mutate phaseDistribution keys order", () => {
    const dist = { exploration: 60, implementation: 40 };
    const keys = Object.keys(dist);
    const data: HarnessWorkflowData = {
      toolTransitions: {},
      phaseTransitions: {},
      phaseDistribution: dist,
      phaseStats: {
        testBeforeShipPct: 0,
        exploreBeforeImplPct: 0,
        totalSessionsWithPhases: 0,
      },
    };
    buildStateDiagram(data);
    // Verify the original object was not mutated
    expect(Object.keys(dist)).toEqual(keys);
  });
});

// --- buildFlowDiagram ---

describe("buildFlowDiagram", () => {
  it("returns empty string for empty input", () => {
    expect(buildFlowDiagram({})).toBe("");
  });

  it("produces valid flowchart header for typical input", () => {
    const result = buildFlowDiagram({
      "Read->Edit": 45,
      "Grep->Read": 30,
    });
    expect(result).toContain("flowchart LR");
    expect(result).toContain("Read");
    expect(result).toContain("Edit");
  });

  it("sanitizes special characters in tool names", () => {
    const result = buildFlowDiagram({
      "mcp.foo->Read": 10,
    });
    // Special chars replaced with underscores in node IDs
    expect(result).toContain("mcp_foo");
    // Display name in parens preserves original
    expect(result).toContain("(mcp.foo)");
  });
});

// --- module exports ---

describe("WorkflowDiagram module", () => {
  it("exports default component", async () => {
    const mod = await import("@/components/WorkflowDiagram");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});

describe("ToolTransitionFlow module", () => {
  it("exports default component", async () => {
    const mod = await import("@/components/ToolTransitionFlow");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
