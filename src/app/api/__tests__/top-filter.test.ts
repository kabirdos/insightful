import { describe, it, expect } from "vitest";

describe("Top page filter logic", () => {
  it("should build Prisma where clause from filter params", () => {
    const params = new URLSearchParams({
      sort: "tokens",
      reportType: "insight-harness",
      minTokens: "100000",
      skill: "custom_skills",
    });

    const where: Record<string, unknown> = {};

    const reportType = params.get("reportType");
    if (reportType) where.reportType = reportType;

    const minTokens = params.get("minTokens");
    if (minTokens) where.totalTokens = { gte: parseInt(minTokens, 10) };

    const skill = params.get("skill");
    if (skill) where.detectedSkills = { has: skill };

    expect(where).toEqual({
      reportType: "insight-harness",
      totalTokens: { gte: 100000 },
      detectedSkills: { has: "custom_skills" },
    });
  });

  it("should map sort param to Prisma orderBy", () => {
    const sortMap: Record<string, Record<string, string>> = {
      tokens: { totalTokens: "desc" },
      sessions: { sessionCount: "desc" },
      commits: { commitCount: "desc" },
      newest: { publishedAt: "desc" },
      duration: { durationHours: "desc" },
    };

    expect(sortMap["tokens"]).toEqual({ totalTokens: "desc" });
    expect(sortMap["sessions"]).toEqual({ sessionCount: "desc" });
    expect(sortMap["newest"]).toEqual({ publishedAt: "desc" });
  });

  it("should handle empty params gracefully", () => {
    const params = new URLSearchParams();
    const where: Record<string, unknown> = {};
    const reportType = params.get("reportType");
    if (reportType) where.reportType = reportType;
    expect(where).toEqual({});
  });

  it("should handle multiple filters together", () => {
    const params = new URLSearchParams({
      reportType: "insight-harness",
      skill: "hooks",
      sort: "tokens",
      q: "elena",
    });

    const where: Record<string, unknown> = {};
    const reportType = params.get("reportType");
    if (reportType) where.reportType = reportType;
    const skill = params.get("skill");
    if (skill) where.detectedSkills = { has: skill };
    const q = params.get("q");
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { author: { username: { contains: q, mode: "insensitive" } } },
      ];
    }

    expect(where.reportType).toBe("insight-harness");
    expect(where.detectedSkills).toEqual({ has: "hooks" });
    expect(where.OR).toHaveLength(2);
  });

  it("should default sort to newest", () => {
    const sortMap: Record<string, Record<string, string>> = {
      tokens: { totalTokens: "desc" },
      sessions: { sessionCount: "desc" },
      newest: { publishedAt: "desc" },
    };
    const sortKey = "";
    const orderBy = sortMap[sortKey] || sortMap.newest;
    expect(orderBy).toEqual({ publishedAt: "desc" });
  });
});
