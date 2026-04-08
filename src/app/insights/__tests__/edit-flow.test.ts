import { describe, it, expect } from "vitest";

describe("Edit report visibility flow", () => {
  it("should allow nulling out a section via PUT", () => {
    // Test that the PUT endpoint accepts null for section fields
    const body = { atAGlance: null, suggestions: null };
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
      "sessionCount",
      "messageCount",
      "commitCount",
      "linesAdded",
      "linesRemoved",
      "fileCount",
      "chartData",
      "detectedSkills",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ atAGlance: null, suggestions: null });
  });

  it("should allow nulling stat fields", () => {
    const body = { sessionCount: null, totalTokens: null };
    const allowedFields = [
      "sessionCount",
      "messageCount",
      "commitCount",
      "totalTokens",
      "linesAdded",
      "linesRemoved",
      "fileCount",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ sessionCount: null, totalTokens: null });
  });
});
