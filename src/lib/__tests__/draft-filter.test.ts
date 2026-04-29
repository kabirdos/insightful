import { describe, expect, it } from "vitest";
import { draftVisibilityClause } from "../draft-filter";

describe("draftVisibilityClause", () => {
  it("returns isDraft: false when the viewer is anonymous", () => {
    expect(draftVisibilityClause(null)).toEqual({ isDraft: false });
  });

  it("includes the viewer's own drafts when viewerId is non-null", () => {
    expect(draftVisibilityClause("user-1")).toEqual({
      OR: [{ isDraft: false }, { authorId: "user-1" }],
    });
  });

  it("returns a distinct object on each call (no shared mutable state)", () => {
    const a = draftVisibilityClause("user-1");
    const b = draftVisibilityClause("user-1");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("never returns a clause that would expose drafts to anonymous viewers", () => {
    const clause = draftVisibilityClause(null);
    // The shape must be exactly { isDraft: false } — no OR branch
    // could let a draft through when viewer is unknown.
    expect(clause).toEqual({ isDraft: false });
    expect((clause as Record<string, unknown>).OR).toBeUndefined();
  });

  it("treats empty string viewerId as anonymous (defensive)", () => {
    // Defensive: an empty string passed by mistake (e.g. `?? ""`) must
    // not enable any user to see all drafts via authorId === "".
    expect(draftVisibilityClause("")).toEqual({ isDraft: false });
  });
});
