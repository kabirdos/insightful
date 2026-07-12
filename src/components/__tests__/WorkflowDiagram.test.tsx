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

  // Skill keys come from user-controlled harnessData and are rendered inside
  // Mermaid htmlLabels with securityLevel:"loose" (Mermaid's DOMPurify pass is
  // disabled). Any HTML in a label MUST therefore be escaped at build time or
  // it renders as live markup. See useMermaid.ts for the invariant.
  it("HTML-escapes a malicious skill key so it cannot render as live HTML", () => {
    const payload = "<img src=x onerror=alert(1)>";
    const data = makeWorkflowData({
      skillInvocations: { [payload]: 3 },
      workflowPatterns: [{ sequence: [payload, payload], count: 1 }],
    });
    const result = buildWorkflowDiagram(data);
    // The raw tag must never reach the Mermaid definition — under
    // securityLevel:"loose" it would render as a live <img> and fire onerror.
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onerror=alert(1)>");
    // It survives only as inert, escaped text.
    expect(result).toContain("&lt;img");
  });

  it("HTML-escapes markup smuggled into the plugin segment of a skill key", () => {
    const payload = "<script>alert(1)</script>:legit";
    const data = makeWorkflowData({
      skillInvocations: { [payload]: 2 },
      workflowPatterns: [{ sequence: [payload, payload], count: 1 }],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("</script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("coerces harness-derived counts so a non-numeric count cannot inject HTML", () => {
    // Counts are typed `number`, but the value ultimately comes from
    // JSON.parse of user-uploaded HTML — the type is only a compile-time
    // promise. A crafted string count would otherwise interpolate raw into
    // the `${count}× used` label. Cast through unknown to model that reality.
    const data = makeWorkflowData({
      skillInvocations: {
        "ce-work": "<img src=x onerror=alert(1)>" as unknown as number,
      },
      workflowPatterns: [
        {
          sequence: ["ce-work", "ce-work"],
          count: "<b>x</b>" as unknown as number,
        },
      ],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).not.toContain("<img");
    expect(result).not.toContain("<b>");
    // Non-finite counts collapse to 0.
    expect(result).toContain("0× used");
  });

  it("escapes double quotes so a skill key cannot break out of the node text", () => {
    // A bare `"` would otherwise close the Mermaid `id["..."]` node-text
    // delimiter and corrupt the definition.
    const payload = 'evil"] node2["pwned';
    const data = makeWorkflowData({
      skillInvocations: { [payload]: 1 },
      workflowPatterns: [{ sequence: [payload, payload], count: 1 }],
    });
    const result = buildWorkflowDiagram(data);
    expect(result).not.toContain('"] node2["');
    expect(result).toContain("&quot;");
  });
});

describe("WorkflowDiagram module", () => {
  it("exports default component", async () => {
    const mod = await import("@/components/WorkflowDiagram");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
