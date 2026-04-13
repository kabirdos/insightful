import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { filterReportForListFeed } from "@/lib/filter-report-response";

export const SORT_MAP: Record<
  string,
  Prisma.InsightReportOrderByWithRelationInput
> = {
  tokens: { totalTokens: "desc" },
  sessions: { sessionCount: "desc" },
  commits: { commitCount: "desc" },
  newest: { publishedAt: "desc" },
  duration: { durationHours: "desc" },
  prs: { prCount: "desc" },
};

/**
 * Build the Prisma `where` clause from URL search params.
 * Extracted as a pure function for testability.
 */
export function buildWhereClause(
  params: URLSearchParams,
): Prisma.InsightReportWhereInput {
  const where: Prisma.InsightReportWhereInput = {};

  const reportType = params.get("reportType");
  if (reportType) where.reportType = reportType;

  const minTokens = params.get("minTokens");
  if (minTokens) where.totalTokens = { gte: parseInt(minTokens, 10) };

  const skill = params.get("skill");
  if (skill) where.detectedSkills = { has: skill };

  const autonomy = params.get("autonomy");
  if (autonomy)
    where.autonomyLabel = { contains: autonomy, mode: "insensitive" };

  const q = params.get("q");
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { author: { username: { contains: q, mode: "insensitive" } } },
      { author: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  return where;
}

/**
 * Resolve the orderBy clause from a sort key string.
 */
export function resolveOrderBy(
  sortKey: string | null,
): Prisma.InsightReportOrderByWithRelationInput {
  return SORT_MAP[sortKey || "newest"] || SORT_MAP.newest;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const where = buildWhereClause(params);

  // Sort
  const sortKey = params.get("sort") || "newest";
  const orderBy = resolveOrderBy(sortKey);

  // Limit
  const limit = Math.min(parseInt(params.get("limit") || "50", 10), 100);

  const reports = await prisma.insightReport.findMany({
    where,
    orderBy,
    take: limit,
    select: {
      slug: true,
      title: true,
      reportType: true,
      publishedAt: true,
      sessionCount: true,
      messageCount: true,
      commitCount: true,
      totalTokens: true,
      durationHours: true,
      prCount: true,
      dayCount: true,
      autonomyLabel: true,
      detectedSkills: true,
      harnessData: true,
      hiddenHarnessSections: true,
      author: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Apply list-feed filter: strips hidden items (privacy) and drops heavy
  // showcase bytes (readme_markdown, hero_base64) even on visible items —
  // cards don't render them and they'd bloat the response post --include-skills.
  const filtered = reports.map((r) => filterReportForListFeed(r));

  return NextResponse.json({ data: filtered });
}
