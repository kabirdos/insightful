import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseInsightsHtml } from "../parser";
import { detectRedactions, applyRedactions } from "../redaction";
import type { InsightsData, RedactionItem } from "@/types/insights";

// Parse the real report for integration-style tests
const REPORT_PATH = resolve(
  process.env.HOME ?? "~",
  ".claude/usage-data/report.html",
);

let realData: InsightsData;
try {
  const html = readFileSync(REPORT_PATH, "utf-8");
  realData = parseInsightsHtml(html).data;
} catch {
  realData = null as unknown as InsightsData;
}

describe("detectRedactions", () => {
  it("should detect project area names", () => {
    const items = detectRedactions(realData);
    const projectNames = items.filter((i) => i.type === "project_name");

    expect(projectNames.length).toBeGreaterThanOrEqual(5);
    expect(projectNames.map((p) => p.text)).toContain(
      "Appeal Mailer SaaS Application",
    );
    expect(projectNames.map((p) => p.text)).toContain(
      "Whispergram Audio Gift Platform",
    );
  });

  it("should set default action to redact", () => {
    const items = detectRedactions(realData);
    for (const item of items) {
      expect(item.action).toBe("redact");
    }
  });

  it("should generate unique IDs for each item", () => {
    const items = detectRedactions(realData);
    const ids = items.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should provide context for each detection", () => {
    const items = detectRedactions(realData);
    for (const item of items) {
      expect(item.context).toBeTruthy();
      expect(item.context.length).toBeLessThanOrEqual(50);
    }
  });

  it("should detect file paths", () => {
    const data: InsightsData = makeMinimalData({
      interaction_style: {
        narrative: "Check the config at /Users/john/projects/app/config.ts",
        key_pattern: "",
      },
    });
    const items = detectRedactions(data);
    const paths = items.filter((i) => i.type === "file_path");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].text).toContain("/Users/john");
  });

  it("should detect email addresses", () => {
    const data: InsightsData = makeMinimalData({
      interaction_style: {
        narrative: "Contact admin@example.com for help",
        key_pattern: "",
      },
    });
    const items = detectRedactions(data);
    const emails = items.filter((i) => i.type === "email");
    expect(emails.length).toBe(1);
    expect(emails[0].text).toBe("admin@example.com");
  });

  it("should detect GitHub URLs", () => {
    const data: InsightsData = makeMinimalData({
      interaction_style: {
        narrative: "Published at https://github.com/user/repo",
        key_pattern: "",
      },
    });
    const items = detectRedactions(data);
    const urls = items.filter((i) => i.type === "github_url");
    expect(urls.length).toBe(1);
    expect(urls[0].text).toBe("https://github.com/user/repo");
  });

  it("should deduplicate detections", () => {
    const data: InsightsData = makeMinimalData({
      interaction_style: {
        narrative: "admin@test.com and admin@test.com again",
        key_pattern: "also admin@test.com",
      },
    });
    const items = detectRedactions(data);
    const emails = items.filter((i) => i.type === "email");
    expect(emails.length).toBe(1);
  });
});

describe("applyRedactions", () => {
  it("should replace redacted text with [redacted]", () => {
    const data: InsightsData = makeMinimalData({
      project_areas: {
        areas: [
          {
            name: "Secret Project",
            session_count: 5,
            description: "The Secret Project is great",
          },
        ],
      },
    });

    const decisions: RedactionItem[] = [
      {
        id: "1",
        text: "Secret Project",
        type: "project_name",
        context: "Secret Project",
        sectionKey: "project_areas",
        action: "redact",
      },
    ];

    const result = applyRedactions(data, decisions);
    expect(result.project_areas.areas[0].name).toBe("[redacted]");
    // Should also replace in description (consistent replacement)
    expect(result.project_areas.areas[0].description).toBe(
      "The [redacted] is great",
    );
  });

  it("should replace aliased text with alias value", () => {
    const data: InsightsData = makeMinimalData({
      project_areas: {
        areas: [
          {
            name: "My App",
            session_count: 3,
            description: "Working on My App",
          },
        ],
      },
    });

    const decisions: RedactionItem[] = [
      {
        id: "1",
        text: "My App",
        type: "project_name",
        context: "My App",
        sectionKey: "project_areas",
        action: "alias",
        alias: "Project Alpha",
      },
    ];

    const result = applyRedactions(data, decisions);
    expect(result.project_areas.areas[0].name).toBe("Project Alpha");
    expect(result.project_areas.areas[0].description).toBe(
      "Working on Project Alpha",
    );
  });

  it("should leave keep items unchanged", () => {
    const data: InsightsData = makeMinimalData({
      project_areas: {
        areas: [
          { name: "Public Project", session_count: 2, description: "ok" },
        ],
      },
    });

    const decisions: RedactionItem[] = [
      {
        id: "1",
        text: "Public Project",
        type: "project_name",
        context: "Public Project",
        sectionKey: "project_areas",
        action: "keep",
      },
    ];

    const result = applyRedactions(data, decisions);
    expect(result.project_areas.areas[0].name).toBe("Public Project");
  });

  it("should not mutate the original data", () => {
    const data: InsightsData = makeMinimalData({
      project_areas: {
        areas: [{ name: "Secret", session_count: 1, description: "desc" }],
      },
    });

    const decisions: RedactionItem[] = [
      {
        id: "1",
        text: "Secret",
        type: "project_name",
        context: "Secret",
        sectionKey: "project_areas",
        action: "redact",
      },
    ];

    applyRedactions(data, decisions);
    expect(data.project_areas.areas[0].name).toBe("Secret");
  });

  it("should apply replacements across all sections consistently", () => {
    const data: InsightsData = makeMinimalData({
      project_areas: {
        areas: [
          { name: "MyApp", session_count: 1, description: "MyApp details" },
        ],
      },
      what_works: {
        intro: "MyApp was impressive",
        impressive_workflows: [
          { title: "MyApp deployment", description: "Used MyApp pipeline" },
        ],
      },
    });

    const decisions: RedactionItem[] = [
      {
        id: "1",
        text: "MyApp",
        type: "project_name",
        context: "MyApp",
        sectionKey: "project_areas",
        action: "redact",
      },
    ];

    const result = applyRedactions(data, decisions);
    expect(result.project_areas.areas[0].name).toBe("[redacted]");
    expect(result.what_works.intro).toBe("[redacted] was impressive");
    expect(result.what_works.impressive_workflows[0].title).toBe(
      "[redacted] deployment",
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalData(overrides: Partial<InsightsData> = {}): InsightsData {
  return {
    project_areas: { areas: [] },
    interaction_style: { narrative: "", key_pattern: "" },
    what_works: { intro: "", impressive_workflows: [] },
    friction_analysis: { intro: "", categories: [] },
    suggestions: {
      claude_md_additions: [],
      features_to_try: [],
      usage_patterns: [],
    },
    on_the_horizon: { intro: "", opportunities: [] },
    fun_ending: { headline: "", detail: "" },
    at_a_glance: {
      whats_working: "",
      whats_hindering: "",
      quick_wins: "",
      ambitious_workflows: "",
    },
    ...overrides,
  };
}
