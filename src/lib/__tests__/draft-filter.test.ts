import { describe, expect, it } from "vitest";
import { draftVisibilityClause } from "../draft-filter";
import { reportVisibilityClause } from "../report-visibility";

describe("draftVisibilityClause (deprecated alias)", () => {
  it("is the same function as reportVisibilityClause", () => {
    expect(draftVisibilityClause).toBe(reportVisibilityClause);
  });

  it("returns the strictly-public clause for anonymous viewers", () => {
    expect(draftVisibilityClause(null)).toEqual({
      isDraft: false,
      visibility: "public",
    });
  });

  it("never returns an OR branch that could expose drafts to anonymous viewers", () => {
    const clause = draftVisibilityClause(null);
    expect((clause as Record<string, unknown>).OR).toBeUndefined();
  });
});
