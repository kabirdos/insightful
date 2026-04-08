import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const SORT_MAP: Record<string, Prisma.InsightReportOrderByWithRelationInput> = {
  tokens: { totalTokens: "desc" },
  sessions: { sessionCount: "desc" },
  commits: { commitCount: "desc" },
  newest: { publishedAt: "desc" },
  duration: { durationHours: "desc" },
  prs: { prCount: "desc" },
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Build where clause
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

  // Sort
  const sortKey = params.get("sort") || "newest";
  const orderBy = SORT_MAP[sortKey] || SORT_MAP.newest;

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
      author: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ data: reports });
}
