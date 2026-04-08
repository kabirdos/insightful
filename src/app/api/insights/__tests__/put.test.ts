import { describe, it, expect } from "vitest";
import { ALLOWED_PUT_FIELDS } from "@/app/api/insights/allowed-fields";

describe("PUT /api/insights/[slug] allowedFields", () => {
  it("exports ALLOWED_PUT_FIELDS from the route module", () => {
    expect(Array.isArray(ALLOWED_PUT_FIELDS)).toBe(true);
    expect(ALLOWED_PUT_FIELDS.length).toBeGreaterThan(0);
  });

  it("includes section fields", () => {
    const fields = [...ALLOWED_PUT_FIELDS];
    expect(fields).toContain("title");
    expect(fields).toContain("atAGlance");
    expect(fields).toContain("interactionStyle");
    expect(fields).toContain("projectAreas");
    expect(fields).toContain("impressiveWorkflows");
    expect(fields).toContain("frictionAnalysis");
    expect(fields).toContain("suggestions");
    expect(fields).toContain("onTheHorizon");
    expect(fields).toContain("funEnding");
  });

  it("includes stat fields", () => {
    const fields = [...ALLOWED_PUT_FIELDS];
    expect(fields).toContain("sessionCount");
    expect(fields).toContain("messageCount");
    expect(fields).toContain("commitCount");
    expect(fields).toContain("linesAdded");
    expect(fields).toContain("linesRemoved");
    expect(fields).toContain("fileCount");
    expect(fields).toContain("chartData");
    expect(fields).toContain("detectedSkills");
  });

  it("includes harness stat fields", () => {
    const fields = [...ALLOWED_PUT_FIELDS];
    expect(fields).toContain("totalTokens");
    expect(fields).toContain("durationHours");
    expect(fields).toContain("avgSessionMinutes");
    expect(fields).toContain("prCount");
    expect(fields).toContain("autonomyLabel");
  });

  it("does NOT include harnessData (XSS prevention)", () => {
    const fields = [...ALLOWED_PUT_FIELDS];
    expect(fields).not.toContain("harnessData");
  });

  it("does NOT include dangerous fields", () => {
    const fields = [...ALLOWED_PUT_FIELDS];
    expect(fields).not.toContain("id");
    expect(fields).not.toContain("slug");
    expect(fields).not.toContain("authorId");
    expect(fields).not.toContain("publishedAt");
    expect(fields).not.toContain("rawHtml");
  });
});
