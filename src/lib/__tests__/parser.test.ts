import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { parseInsightsHtml } from "../parser";

// Read the real insights HTML file for testing (may not exist in CI)
const REPORT_PATH = resolve(
  process.env.HOME ?? "~",
  ".claude/usage-data/report.html",
);

const reportExists = existsSync(REPORT_PATH);
const html = reportExists ? readFileSync(REPORT_PATH, "utf-8") : "";

describe("parseInsightsHtml", () => {
  it("should handle missing sections gracefully", () => {
    const minimal = "<html><body><div class='container'></div></body></html>";
    const result = parseInsightsHtml(minimal);
    expect(result.stats.messageCount).toBe(0);
    expect(result.data.project_areas.areas).toEqual([]);
    expect(result.data.fun_ending.headline).toBe("");
  });

  it("should initialize detectedRedactions as empty array for minimal input", () => {
    const minimal = "<html><body><div class='container'></div></body></html>";
    const result = parseInsightsHtml(minimal);
    expect(result.detectedRedactions).toEqual([]);
  });
});

describe.skipIf(!reportExists)("parseInsightsHtml — real report", () => {
  it("should parse the real HTML report without throwing", () => {
    expect(() => parseInsightsHtml(html)).not.toThrow();
  });

  it("should extract stats from the subtitle", () => {
    const result = parseInsightsHtml(html);
    expect(result.stats.messageCount).toBeGreaterThan(0);
    expect(result.stats.sessionCount).toBeGreaterThan(0);
    expect(result.stats.analyzedCount).toBeGreaterThan(0);
    expect(result.stats.dateRangeStart).toBeTruthy();
    expect(result.stats.dateRangeEnd).toBeTruthy();
  });

  it("should extract commit count from narrative", () => {
    const result = parseInsightsHtml(html);
    expect(result.stats.commitCount).toBeGreaterThan(0);
  });

  it("should extract project areas", () => {
    const result = parseInsightsHtml(html);
    const areas = result.data.project_areas.areas;
    expect(areas.length).toBeGreaterThan(0);
    expect(areas[0].name).toBeTruthy();
    expect(areas[0].session_count).toBeGreaterThan(0);
    expect(areas[0].description).toBeTruthy();
  });

  it("should extract at-a-glance sections", () => {
    const result = parseInsightsHtml(html);
    const glance = result.data.at_a_glance;
    expect(glance.whats_working).toBeTruthy();
    expect(glance.whats_hindering).toBeTruthy();
    expect(glance.quick_wins).toBeTruthy();
    expect(glance.ambitious_workflows).toBeTruthy();
  });

  it("should extract interaction style narrative", () => {
    const result = parseInsightsHtml(html);
    expect(result.data.interaction_style.narrative).toBeTruthy();
    expect(result.data.interaction_style.key_pattern).toBeTruthy();
  });

  it("should extract impressive workflows (what works)", () => {
    const result = parseInsightsHtml(html);
    expect(result.data.what_works.intro).toBeTruthy();
    expect(result.data.what_works.impressive_workflows.length).toBeGreaterThan(
      0,
    );
    expect(result.data.what_works.impressive_workflows[0].title).toBeTruthy();
    expect(
      result.data.what_works.impressive_workflows[0].description,
    ).toBeTruthy();
  });

  it("should extract friction categories", () => {
    const result = parseInsightsHtml(html);
    expect(result.data.friction_analysis.intro).toBeTruthy();
    expect(result.data.friction_analysis.categories.length).toBeGreaterThan(0);

    const first = result.data.friction_analysis.categories[0];
    expect(first.category).toBeTruthy();
    expect(first.description).toBeTruthy();
    expect(first.examples.length).toBeGreaterThan(0);
  });

  it("should extract suggestions", () => {
    const result = parseInsightsHtml(html);
    const suggestions = result.data.suggestions;
    expect(suggestions.claude_md_additions.length).toBeGreaterThan(0);
    expect(suggestions.features_to_try.length).toBeGreaterThan(0);
    expect(suggestions.usage_patterns.length).toBeGreaterThan(0);
  });

  it("should extract horizon opportunities", () => {
    const result = parseInsightsHtml(html);
    const horizon = result.data.on_the_horizon;
    expect(horizon.intro).toBeTruthy();
    expect(horizon.opportunities.length).toBeGreaterThan(0);
    expect(horizon.opportunities[0].title).toBeTruthy();
    expect(horizon.opportunities[0].copyable_prompt).toBeTruthy();
  });

  it("should extract fun ending", () => {
    const result = parseInsightsHtml(html);
    expect(result.data.fun_ending.headline).toBeTruthy();
    expect(result.data.fun_ending.detail).toBeTruthy();
  });

  it("should initialize detectedRedactions as empty array", () => {
    const result = parseInsightsHtml(html);
    expect(result.detectedRedactions).toEqual([]);
  });
});
