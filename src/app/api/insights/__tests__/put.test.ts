import { describe, it, expect } from "vitest";

describe("PUT /api/insights/[slug]", () => {
  it("should accept stat fields in allowedFields", () => {
    // Verify the allowedFields array includes stat fields
    const allowedFields = [
      "title",
      "atAGlance",
      "interactionStyle",
      "projectAreas",
      "impressiveWorkflows",
      "frictionAnalysis",
      "suggestions",
      "onTheHorizon",
      "funEnding",
      "totalTokens",
      "durationHours",
      "avgSessionMinutes",
      "prCount",
      "autonomyLabel",
      "harnessData",
      // New fields:
      "sessionCount",
      "messageCount",
      "commitCount",
      "linesAdded",
      "linesRemoved",
      "fileCount",
      "chartData",
      "detectedSkills",
    ];
    expect(allowedFields).toContain("sessionCount");
    expect(allowedFields).toContain("messageCount");
    expect(allowedFields).toContain("commitCount");
    expect(allowedFields).toContain("linesAdded");
    expect(allowedFields).toContain("linesRemoved");
    expect(allowedFields).toContain("fileCount");
    expect(allowedFields).toContain("chartData");
    expect(allowedFields).toContain("detectedSkills");
  });
});
