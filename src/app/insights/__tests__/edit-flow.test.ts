import { describe, it, expect } from "vitest";
import { ALLOWED_PUT_FIELDS } from "@/app/api/insights/allowed-fields";

describe("Edit report visibility flow", () => {
  it("should allow nulling out a section via PUT", () => {
    // Test that the PUT endpoint accepts null for section fields
    const body = { atAGlance: null, suggestions: null };

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_PUT_FIELDS) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ atAGlance: null, suggestions: null });
  });

  it("should reject harnessData in PUT body", () => {
    // harnessData must not be in the allowlist (XSS vector via dangerouslySetInnerHTML)
    expect(ALLOWED_PUT_FIELDS).not.toContain("harnessData");
  });

  it("should allow nulling stat fields", () => {
    const body = { sessionCount: null, totalTokens: null };

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_PUT_FIELDS) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (body as Record<string, unknown>)[field];
      }
    }

    expect(updateData).toEqual({ sessionCount: null, totalTokens: null });
  });
});
