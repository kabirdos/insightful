import { describe, it, expect } from "vitest";
import { buildWorkflowDiagram } from "@/components/WorkflowDiagram";
import type { HarnessWorkflowData } from "@/types/insights";

function makeWorkflowData(
  overrides: Partial<HarnessWorkflowData> = {},
): HarnessWorkflowData {
  return {
    skillInvocations: {},
    agentDispatches: {},
    workflowPatterns: [],
    phaseTransitions: {},
    phaseDistribution: {},
    phaseStats: {
      testBeforeShipPct: 0,
      exploreBeforeImplPct: 0,
      totalSessionsWithPhases: 0,
    },
    ...overrides,
  };
}

describe("buildWorkflowDiagram", () => {
  it("returns empty string for empty input", () => {
    expect(buildWorkflowDiagram(makeWorkflowData())).toBe("");
  });

  it("produces valid flowchart header for typical input", () => {
    const data = makeWorkflowData({
      skillInvocations: { "ce-brainstorm": 8, "ce-work": 12 },
      workflowPatterns: [{ sequence: ["ce-brainstorm", "ce-work"], count: 5 }],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).toContain("flowchart TD");
    expect(result).toContain("ce_brainstorm");
    expect(result).toContain("ce_work");
    expect(result).toContain("-->");
  });

  it("includes invocation counts in node labels", () => {
    const data = makeWorkflowData({
      skillInvocations: { "git-commit-push-pr": 4 },
    });
    const result = buildWorkflowDiagram(data);
    // Labels now use HTML with plugin source and count on separate lines
    expect(result).toContain("git-commit-push-pr");
    expect(result).toContain("4\u00d7");
  });

  it("includes plugin source in node labels", () => {
    const data = makeWorkflowData({
      skillInvocations: { "superpowers:writing-plans": 5, "ux-mockup": 3 },
    });
    const result = buildWorkflowDiagram(data);
    // Plugin skills show the plugin name
    expect(result).toContain("superpowers");
    expect(result).toContain("writing-plans");
    // Custom skills (no colon) show as "custom"
    expect(result).toContain("ux-mockup");
    expect(result).toContain("custom");
  });

  it("shows edge counts when pattern count > 1", () => {
    const data = makeWorkflowData({
      skillInvocations: { "ce-brainstorm": 8, "ce-work": 12 },
      workflowPatterns: [{ sequence: ["ce-brainstorm", "ce-work"], count: 3 }],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).toContain("|3x|");
  });

  it("does not show edge count label when count is 1", () => {
    const data = makeWorkflowData({
      skillInvocations: { "ce-brainstorm": 1, "ce-work": 1 },
      workflowPatterns: [{ sequence: ["ce-brainstorm", "ce-work"], count: 1 }],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).not.toContain("|1x|");
    expect(result).toContain("ce_brainstorm --> ce_work");
  });
});

describe("WorkflowDiagram module", () => {
  it("exports default component", async () => {
    const mod = await import("@/components/WorkflowDiagram");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
