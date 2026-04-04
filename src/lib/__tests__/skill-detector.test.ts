import { describe, it, expect } from "vitest";
import { detectSkills } from "../skill-detector";
import type { InsightsData, ChartData } from "@/types/insights";

function makeData(narrativeText: string): InsightsData {
  return {
    at_a_glance: {
      whats_working: "",
      whats_hindering: "",
      quick_wins: "",
      ambitious_workflows: "",
    },
    interaction_style: { narrative: narrativeText, key_pattern: "" },
    project_areas: { areas: [] },
    what_works: { intro: "", impressive_workflows: [] },
    friction_analysis: { intro: "", categories: [] },
    suggestions: {
      claude_md_additions: [],
      features_to_try: [],
      usage_patterns: [],
    },
    on_the_horizon: { intro: "", opportunities: [] },
    fun_ending: { headline: "", detail: "" },
  };
}

describe("detectSkills", () => {
  it("detects parallel_agents from narrative text", () => {
    const data = makeData(
      "You used parallel agents to run multiple test suites simultaneously.",
    );
    const result = detectSkills(data, {});
    expect(result).toContain("parallel_agents");
  });

  it("detects parallel_agents from TaskCreate in tool usage", () => {
    const data = makeData("No mentions here.");
    const chartData: ChartData = {
      toolUsage: [
        { label: "Bash", value: 100 },
        { label: "TaskCreate", value: 191 },
      ],
    };
    const result = detectSkills(data, chartData);
    expect(result).toContain("parallel_agents");
  });

  it("detects worktrees", () => {
    const data = makeData("You created git worktrees for isolation.");
    const result = detectSkills(data, {});
    expect(result).toContain("worktrees");
  });

  it("detects custom_skills from SKILL.md mention", () => {
    const data = makeData("You published a SKILL.md file for reuse.");
    const result = detectSkills(data, {});
    expect(result).toContain("custom_skills");
  });

  it("detects hooks", () => {
    const data = makeData("You configured pre-commit hooks.");
    const result = detectSkills(data, {});
    expect(result).toContain("hooks");
  });

  it("detects mcp_servers", () => {
    const data = makeData("Playwright MCP server configuration.");
    const result = detectSkills(data, {});
    expect(result).toContain("mcp_servers");
  });

  it("detects playwright", () => {
    const data = makeData("You ran browser tests with Playwright.");
    const result = detectSkills(data, {});
    expect(result).toContain("playwright");
  });

  it("detects plan_mode", () => {
    const data = makeData("Used plan mode for complex refactors.");
    const result = detectSkills(data, {});
    expect(result).toContain("plan_mode");
  });

  it("detects code_review", () => {
    const data = makeData("Ran code review with a review agent.");
    const result = detectSkills(data, {});
    expect(result).toContain("code_review");
  });

  it("returns empty array when nothing detected", () => {
    const data = makeData("Just a normal session.");
    const result = detectSkills(data, {});
    expect(result).toEqual([]);
  });

  it("deduplicates results", () => {
    const data = makeData(
      "parallel agents, parallel agents, and more parallel agents",
    );
    const result = detectSkills(data, {});
    const count = result.filter((s) => s === "parallel_agents").length;
    expect(count).toBe(1);
  });

  it("detects multiple skills from the same text", () => {
    const data = makeData(
      "You used parallel agents with Playwright MCP and worktrees for isolation.",
    );
    const result = detectSkills(data, {});
    expect(result).toContain("parallel_agents");
    expect(result).toContain("playwright");
    expect(result).toContain("mcp_servers");
    expect(result).toContain("worktrees");
  });
});
