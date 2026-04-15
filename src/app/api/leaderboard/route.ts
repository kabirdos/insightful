import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveLinesAdded, resolveLinesRemoved } from "@/lib/lines-of-code";

export interface LeaderboardRow {
  rank: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  lifetimeTokens: number;
  totalTokens: number;
  sessionCount: number;
  durationHours: number;
  linesAdded: number | null;
  linesRemoved: number | null;
  dayCount: number | null;
  publishedAt: string;
  weeklyRate: number;
}

/**
 * Leaderboard endpoint — one row per user, ranked by lifetime or weekly
 * token usage. Reads off each user's most recent published report
 * (matching the "vanity metrics" on their public profile). Cache tokens
 * are excluded because the upstream `lifetimeTokens` field and
 * `primaryModel` convention sum input+output only.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rank = searchParams.get("rank") === "weekly" ? "weekly" : "lifetime";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit") ?? "10")),
    );

    // Pull every published report ordered newest-first, then dedupe by
    // author keeping the latest. With hundreds of users this fits easily
    // in memory; when the population grows past a few thousand we'll
    // push this into a materialized view or window function.
    const reports = await prisma.insightReport.findMany({
      orderBy: { publishedAt: "desc" },
      select: {
        publishedAt: true,
        totalTokens: true,
        durationHours: true,
        sessionCount: true,
        linesAdded: true,
        linesRemoved: true,
        dayCount: true,
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

    const latestByUser = new Map<string, (typeof reports)[number]>();
    for (const r of reports) {
      if (!latestByUser.has(r.author.username)) {
        latestByUser.set(r.author.username, r);
      }
    }

    const rows = [...latestByUser.values()].map((r) => {
      const hd = r.harnessData as {
        stats?: { lifetimeTokens?: number };
      } | null;
      const total = r.totalTokens ?? 0;
      const lifetime = hd?.stats?.lifetimeTokens ?? total;
      const days = r.dayCount ?? 0;
      const weeks = days > 0 ? days / 7 : 0;
      const weeklyRate = weeks > 0 ? total / weeks : 0;
      return {
        username: r.author.username,
        displayName: r.author.displayName,
        avatarUrl: r.author.avatarUrl,
        lifetimeTokens: lifetime,
        totalTokens: total,
        sessionCount: r.sessionCount ?? 0,
        durationHours: r.durationHours ?? 0,
        linesAdded: resolveLinesAdded({
          linesAdded: r.linesAdded,
          harnessData: r.harnessData as never,
        }),
        linesRemoved: resolveLinesRemoved({
          linesRemoved: r.linesRemoved,
          harnessData: r.harnessData as never,
        }),
        dayCount: r.dayCount,
        publishedAt: r.publishedAt.toISOString(),
        weeklyRate,
      };
    });

    rows.sort((a, b) => {
      const av = rank === "weekly" ? a.weeklyRate : a.lifetimeTokens;
      const bv = rank === "weekly" ? b.weeklyRate : b.lifetimeTokens;
      if (bv !== av) return bv - av;
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    });

    const skip = (page - 1) * limit;
    const paged: LeaderboardRow[] = rows
      .slice(skip, skip + limit)
      .map((row, i) => ({ rank: skip + i + 1, ...row }));

    return NextResponse.json({
      data: paged,
      pagination: {
        page,
        limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}
