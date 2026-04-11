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

  it("defaults to flowchart LR (desktop layout)", () => {
    const data = makeWorkflowData({
      skillInvocations: { "ce-brainstorm": 8, "ce-work": 12 },
      workflowPatterns: [{ sequence: ["ce-brainstorm", "ce-work"], count: 5 }],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).toContain("flowchart LR");
    expect(result).toContain("ce_brainstorm");
    expect(result).toContain("ce_work");
    expect(result).toContain("-->");
  });

  it("supports TD direction for narrow viewports", () => {
    const data = makeWorkflowData({
      skillInvocations: { "ce-brainstorm": 8, "ce-work": 12 },
      workflowPatterns: [{ sequence: ["ce-brainstorm", "ce-work"], count: 5 }],
    });
    const result = buildWorkflowDiagram(data, { direction: "TD" });
    expect(result).toContain("flowchart TD");
    expect(result).not.toContain("flowchart LR");
  });

  it("includes invocation counts in node labels", () => {
    const data = makeWorkflowData({
      skillInvocations: { "git-commit-push-pr": 4 },
      workflowPatterns: [
        {
          sequence: ["git-commit-push-pr", "git-commit-push-pr"],
          count: 1,
        },
      ],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).toContain("git-commit-push-pr");
    expect(result).toContain("4\u00d7 used");
  });

  it("includes plugin source in node labels", () => {
    const data = makeWorkflowData({
      skillInvocations: { "superpowers:writing-plans": 5, "ux-mockup": 3 },
      workflowPatterns: [
        { sequence: ["superpowers:writing-plans", "ux-mockup"], count: 2 },
      ],
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

  it("filters out skills that do not participate in any pattern", () => {
    const data = makeWorkflowData({
      skillInvocations: {
        "ce-brainstorm": 8,
        "ce-work": 12,
        "isolated-skill": 99,
      },
      workflowPatterns: [{ sequence: ["ce-brainstorm", "ce-work"], count: 3 }],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).toContain("ce_brainstorm");
    expect(result).toContain("ce_work");
    // isolated-skill has a huge count but never appears in a pattern — it
    // should be excluded from the graph so it doesn't clutter the layout.
    expect(result).not.toContain("isolated_skill");
    expect(result).not.toContain("isolated-skill");
  });

  it("falls back to all skills when no patterns exist at all", () => {
    const data = makeWorkflowData({
      skillInvocations: { "solo-skill": 5, "other-solo": 3 },
      workflowPatterns: [],
    });
    const result = buildWorkflowDiagram(data);
    // Without any patterns to filter against, both skills should still
    // render — otherwise sparse reports show an empty diagram.
    expect(result).toContain("solo_skill");
    expect(result).toContain("other_solo");
  });

  it("applies explicit inline font sizes to label spans (desktop defaults)", () => {
    const data = makeWorkflowData({
      skillInvocations: { "ce-work": 7 },
      workflowPatterns: [{ sequence: ["ce-work", "ce-work"], count: 1 }],
    });
    const result = buildWorkflowDiagram(data);
    // Default desktop sizes: nameSize=24, metaSize=18.
    expect(result).toContain("font-size:24px");
    expect(result).toContain("font-size:18px");
    // "N× used" line is metaSize + 1.
    expect(result).toContain("font-size:19px");
  });

  it("applies smaller inline font sizes when mobile sizes are passed", () => {
    const data = makeWorkflowData({
      skillInvocations: { "ce-work": 7 },
      workflowPatterns: [{ sequence: ["ce-work", "ce-work"], count: 1 }],
    });
    const result = buildWorkflowDiagram(data, {
      direction: "TD",
      nameSize: 20,
      metaSize: 15,
    });
    expect(result).toContain("font-size:20px");
    expect(result).toContain("font-size:15px");
    expect(result).toContain("font-size:16px");
    expect(result).not.toContain("font-size:24px");
  });
});

describe("WorkflowDiagram module", () => {
  it("exports default component", async () => {
    const mod = await import("@/components/WorkflowDiagram");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
