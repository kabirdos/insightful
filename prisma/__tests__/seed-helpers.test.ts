import { describe, expect, it } from "vitest";
import {
  computeDefaultAgentDispatch,
  computeDefaultBranchPrefixes,
  computeDefaultHookFrequency,
} from "../seed-helpers";

describe("computeDefaultAgentDispatch", () => {
  it("returns null for users with no parallel-agent or subagent skills", () => {
    expect(computeDefaultAgentDispatch([], 100)).toBeNull();
    expect(
      computeDefaultAgentDispatch(["plan_mode", "code_review"], 100),
    ).toBeNull();
  });

  it("auto-populates dispatch when detectedSkills includes parallel_agents", () => {
    const result = computeDefaultAgentDispatch(["parallel_agents"], 100);
    expect(result).not.toBeNull();
    expect(result?.totalAgents).toBeGreaterThan(0);
    expect(result?.types).toMatchObject({
      "general-purpose": expect.any(Number),
      "code-reviewer": expect.any(Number),
      explore: expect.any(Number),
    });
  });

  it("auto-populates dispatch when detectedSkills includes subagents", () => {
    const result = computeDefaultAgentDispatch(["subagents"], 80);
    expect(result).not.toBeNull();
    expect(result?.totalAgents).toBeGreaterThan(0);
  });

  it("models field carries DISPATCH counts, not token totals", () => {
    // This is the codex finding from suggested #3: previously the
    // helper was setting models to {sonnet: tokens*0.6, opus: tokens*0.4}
    // which produced nonsense like "sonnet (1,680,000)" in the UI's
    // dispatch count panel. The fix scales by totalAgents instead so
    // the values stay small enough to read as agent counts.
    const result = computeDefaultAgentDispatch(["parallel_agents"], 100);
    expect(result).not.toBeNull();
    const totalModelDispatches = Object.values(result!.models).reduce(
      (a, b) => a + b,
      0,
    );
    // Sum of model dispatches should be roughly equal to totalAgents
    // (not totalTokens), so well under a few hundred.
    expect(totalModelDispatches).toBeLessThanOrEqual(result!.totalAgents);
    expect(totalModelDispatches).toBeGreaterThan(0);
    // Sanity check the sum of types should also be roughly totalAgents
    const totalTypeDispatches = Object.values(result!.types).reduce(
      (a, b) => a + b,
      0,
    );
    // Allow rounding slack but reject token-scale numbers
    expect(totalTypeDispatches).toBeLessThanOrEqual(result!.totalAgents + 2);
  });

  it("respects the floor of 6 agents even for tiny session counts", () => {
    const result = computeDefaultAgentDispatch(["parallel_agents"], 5);
    expect(result?.totalAgents).toBeGreaterThanOrEqual(6);
  });
});

describe("computeDefaultHookFrequency", () => {
  it("returns an empty map when there are no hook definitions", () => {
    expect(computeDefaultHookFrequency([])).toEqual({});
  });

  it("derives a per-event count map keyed by hook event", () => {
    const result = computeDefaultHookFrequency([
      { event: "PostToolUse:Write" },
      { event: "PreCommit" },
    ]);
    expect(Object.keys(result)).toEqual(["PostToolUse:Write", "PreCommit"]);
    expect(result["PostToolUse:Write"]).toBeGreaterThan(0);
    expect(result["PreCommit"]).toBeGreaterThan(0);
  });

  it("produces distinct counts per hook so the UI doesn't render uniform fire rates", () => {
    const result = computeDefaultHookFrequency([
      { event: "Hook A" },
      { event: "Hook B" },
      { event: "Hook C" },
    ]);
    const counts = Object.values(result);
    expect(new Set(counts).size).toBe(counts.length);
  });
});

describe("computeDefaultBranchPrefixes", () => {
  it("derives a feat/fix/chore split from a commit count", () => {
    const result = computeDefaultBranchPrefixes(100);
    expect(result["feat/"]).toBe(40);
    expect(result["fix/"]).toBe(25);
    expect(result["chore/"]).toBe(15);
  });

  it("returns zero counts for zero commits without crashing", () => {
    expect(computeDefaultBranchPrefixes(0)).toEqual({
      "feat/": 0,
      "fix/": 0,
      "chore/": 0,
    });
  });

  it("handles odd commit counts via Math.round", () => {
    const result = computeDefaultBranchPrefixes(7);
    expect(result["feat/"]).toBe(3); // 7 * 0.4 = 2.8 → 3
    expect(result["fix/"]).toBe(2); // 7 * 0.25 = 1.75 → 2
    expect(result["chore/"]).toBe(1); // 7 * 0.15 = 1.05 → 1
  });
});
