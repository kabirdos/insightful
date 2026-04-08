import { describe, it, expect } from "vitest";
import {
  buildWhereClause,
  resolveOrderBy,
  SORT_MAP,
} from "@/app/api/top/route";

describe("buildWhereClause", () => {
  it("returns empty where for empty params", () => {
    const where = buildWhereClause(new URLSearchParams());
    expect(where).toEqual({});
  });

  it("filters by reportType", () => {
    const where = buildWhereClause(
      new URLSearchParams({ reportType: "insight-harness" }),
    );
    expect(where.reportType).toBe("insight-harness");
  });

  it("filters by minTokens with gte", () => {
    const where = buildWhereClause(
      new URLSearchParams({ minTokens: "100000" }),
    );
    expect(where.totalTokens).toEqual({ gte: 100000 });
  });

  it("filters by skill using has", () => {
    const where = buildWhereClause(
      new URLSearchParams({ skill: "custom_skills" }),
    );
    expect(where.detectedSkills).toEqual({ has: "custom_skills" });
  });

  it("filters by autonomy with case-insensitive contains", () => {
    const where = buildWhereClause(
      new URLSearchParams({ autonomy: "Fire-and-Forget" }),
    );
    expect(where.autonomyLabel).toEqual({
      contains: "Fire-and-Forget",
      mode: "insensitive",
    });
  });

  it("builds OR clause for text search q", () => {
    const where = buildWhereClause(new URLSearchParams({ q: "elena" }));
    expect(where.OR).toHaveLength(3);
    expect(where.OR).toEqual([
      { title: { contains: "elena", mode: "insensitive" } },
      { author: { username: { contains: "elena", mode: "insensitive" } } },
      { author: { displayName: { contains: "elena", mode: "insensitive" } } },
    ]);
  });

  it("combines multiple filters", () => {
    const where = buildWhereClause(
      new URLSearchParams({
        reportType: "insight-harness",
        skill: "hooks",
        minTokens: "50000",
        q: "test",
      }),
    );
    expect(where.reportType).toBe("insight-harness");
    expect(where.detectedSkills).toEqual({ has: "hooks" });
    expect(where.totalTokens).toEqual({ gte: 50000 });
    expect(where.OR).toHaveLength(3);
  });

  it("ignores unknown params", () => {
    const where = buildWhereClause(
      new URLSearchParams({ bogus: "value", sort: "tokens" }),
    );
    // sort is handled separately, bogus is ignored — where should be empty
    expect(where).toEqual({});
  });
});

describe("resolveOrderBy", () => {
  it("defaults to newest when null", () => {
    expect(resolveOrderBy(null)).toEqual({ publishedAt: "desc" });
  });

  it("defaults to newest for unknown sort key", () => {
    expect(resolveOrderBy("nonexistent")).toEqual({ publishedAt: "desc" });
  });

  it("resolves tokens sort", () => {
    expect(resolveOrderBy("tokens")).toEqual({ totalTokens: "desc" });
  });

  it("resolves sessions sort", () => {
    expect(resolveOrderBy("sessions")).toEqual({ sessionCount: "desc" });
  });

  it("resolves commits sort", () => {
    expect(resolveOrderBy("commits")).toEqual({ commitCount: "desc" });
  });

  it("resolves duration sort", () => {
    expect(resolveOrderBy("duration")).toEqual({ durationHours: "desc" });
  });

  it("resolves prs sort", () => {
    expect(resolveOrderBy("prs")).toEqual({ prCount: "desc" });
  });
});

describe("SORT_MAP", () => {
  it("contains all expected sort keys", () => {
    expect(Object.keys(SORT_MAP).sort()).toEqual(
      ["commits", "duration", "newest", "prs", "sessions", "tokens"].sort(),
    );
  });
});
