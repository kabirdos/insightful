import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  reportVisibilityClause,
  resolvePublishVisibilityDefault,
} from "../report-visibility";

describe("reportVisibilityClause", () => {
  it("returns the strictly-public clause for anonymous viewers", () => {
    expect(reportVisibilityClause(null)).toEqual({
      isDraft: false,
      visibility: "public",
    });
  });

  it("never exposes drafts or non-public reports to anonymous viewers", () => {
    const clause = reportVisibilityClause(null);
    expect((clause as Record<string, unknown>).OR).toBeUndefined();
    expect(clause).toEqual({ isDraft: false, visibility: "public" });
  });

  it("treats empty-string viewerId as anonymous (defensive)", () => {
    expect(reportVisibilityClause("")).toEqual({
      isDraft: false,
      visibility: "public",
    });
  });

  it("includes public, own, and group-shared reports for an authenticated viewer", () => {
    expect(reportVisibilityClause("user-1")).toEqual({
      OR: [
        { isDraft: false, visibility: "public" },
        { authorId: "user-1" },
        {
          isDraft: false,
          visibility: "group",
          groupShares: {
            some: { group: { members: { some: { userId: "user-1" } } } },
          },
        },
      ],
    });
  });

  it("scopes the group OR-branch to groups the viewer is a member of", () => {
    const clause = reportVisibilityClause("user-1") as {
      OR: Array<Record<string, unknown>>;
    };
    const groupBranch = clause.OR.find((b) => b.visibility === "group");
    expect(groupBranch).toBeDefined();
    expect(groupBranch).toMatchObject({
      isDraft: false,
      visibility: "group",
      groupShares: {
        some: { group: { members: { some: { userId: "user-1" } } } },
      },
    });
  });

  it("returns a distinct object on each call (no shared mutable state)", () => {
    const a = reportVisibilityClause("user-1");
    const b = reportVisibilityClause("user-1");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("resolvePublishVisibilityDefault", () => {
  let findMany: Mock;
  let db: {
    groupMember: { findMany: Mock };
  };

  beforeEach(() => {
    findMany = vi.fn();
    db = { groupMember: { findMany } };
  });

  it("defaults to public with no group ids when the author has no memberships", async () => {
    findMany.mockResolvedValue([]);
    const result = await resolvePublishVisibilityDefault(db, "user-1");
    expect(result).toEqual({ visibility: "public", groupIds: [] });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { groupId: true },
    });
  });

  it("defaults to group shared to every membership when the author has groups", async () => {
    findMany.mockResolvedValue([{ groupId: "g1" }, { groupId: "g2" }]);
    const result = await resolvePublishVisibilityDefault(db, "user-1");
    expect(result).toEqual({ visibility: "group", groupIds: ["g1", "g2"] });
  });
});
