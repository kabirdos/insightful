import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { buildReportEditUrl } from "@/lib/urls";

/**
 * GET /api/upload/status?since=<ISO timestamp>
 *
 * Browser-side polling endpoint for the upload page (R24). Returns the
 * caller's most recent draft created after `since`, or null if none.
 *
 * Auth: session-only. The harness skill posts via bearer auth on
 * `/api/upload/direct`; this endpoint is what the user's browser polls
 * while waiting for that post to land. There is no reason to allow
 * bearer auth here — bearer-auth callers don't have a browser tab open
 * waiting for a redirect.
 *
 * Rate limit: none. The query is a single indexed `findFirst` on
 * `authorId + createdAt` (covered by `User_reports` FK index +
 * row-level filter). Per codex review on the parent plan, an in-memory
 * debounce was rejected because Vercel's serverless instances don't
 * share state — debounce would either no-op (each instance debounces
 * independently) or behave inconsistently (depending on which instance
 * a request lands on). Accept the 3s client cadence as-is. If a
 * durable limiter becomes necessary, back it with Postgres at that
 * point.
 *
 * Cache: `Cache-Control: no-store` so an upstream CDN doesn't memoize
 * a "not ready yet" response and starve the polling loop.
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get("since");
    if (!sinceParam) {
      return NextResponse.json(
        { error: "Missing required query param: since" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const sinceDate = new Date(sinceParam);
    if (Number.isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid `since` timestamp" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const draft = await prisma.insightReport.findFirst({
      where: {
        authorId: session.user.id,
        isDraft: true,
        createdAt: { gt: sinceDate },
      },
      orderBy: { createdAt: "desc" },
      select: {
        slug: true,
        createdAt: true,
        author: { select: { username: true } },
      },
    });

    if (!draft) {
      return NextResponse.json(
        { editUrl: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        editUrl: buildReportEditUrl(draft.author.username, draft.slug),
        slug: draft.slug,
        createdAt: draft.createdAt.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET /api/upload/status failed", error);
    return NextResponse.json(
      { error: "Failed to check upload status" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
