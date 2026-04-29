/**
 * POST /api/upload — accepts an HTML report and (a) for the existing
 * multipart browser flow, parses it and returns the structured payload
 * the upload-page React state machine consumes, or (b) for the new
 * bearer-auth direct-POST flow (Unit 7 of Wave 3b plan), parses it AND
 * persists a draft InsightReport in one round trip, returning the
 * editUrl/slug for the skill to print.
 *
 * Flow selection is by `Content-Type`:
 *   - `multipart/form-data`        → legacy browser path (parse-only).
 *   - `application/octet-stream`   → bearer-auth direct-POST path.
 *   - `text/html`                  → bearer-auth direct-POST path.
 *
 * The bearer path is sequenced per Decision 11:
 *   1. authenticate → require viaToken, else 401.
 *   2. validate X-Upload-Id is a UUID, else record HarnessUpload
 *      {success: false} and return 400.
 *   3. findIdempotentResult → if a prior success exists, short-circuit
 *      with the original slug. **Idempotency beats rate-limit (R14a).**
 *   4. checkUploadRateLimit → on cap, record failed attempt + return.
 *   5. parse + publishReport via withIdempotency.
 *   6. emit logHarnessRequest on every terminal response.
 */
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseInsightsHtml } from "@/lib/parser";
import { isHarnessReport, parseHarnessHtml } from "@/lib/harness-parser";
import { detectRedactions } from "@/lib/redaction";
import { parseChartData } from "@/lib/chart-parser";
import { detectSkills } from "@/lib/skill-detector";
import { authenticateRequest } from "@/lib/harness-auth";
import { checkUploadRateLimit } from "@/lib/harness-rate-limit";
import {
  findIdempotentResult,
  withIdempotency,
} from "@/lib/harness-idempotency";
import { logHarnessRequest } from "@/lib/harness-logging";
import { publishReport } from "@/lib/publish-report";
import { buildReportEditUrl } from "@/lib/urls";
import type { ParsedInsightsReport } from "@/types/insights";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — matches the multipart cap.

/** Synthetic upload id used when the request lacks a valid X-Upload-Id.
 *  Prefixed so it can never collide with a real client UUID, and we
 *  still record a HarnessUpload row for rate-limit accounting. */
function syntheticUploadId(): string {
  return `bad-upload-id:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/**
 * Extract enhanced stats (linesAdded, linesRemoved, fileCount,
 * dayCount, msgsPerDay) from the .stat row in the HTML report.
 */
function extractEnhancedStats(html: string) {
  const $ = cheerio.load(html);
  const statValues: Record<string, string> = {};
  $(".stat").each((_, el) => {
    const label = $(el).find(".stat-label").text().trim().toLowerCase();
    const value = $(el).find(".stat-value").text().trim();
    statValues[label] = value;
  });

  let linesAdded: number | null = null;
  let linesRemoved: number | null = null;
  const linesValue = statValues["lines"];
  if (linesValue) {
    const linesMatch = linesValue.match(/\+?([\d,]+)\s*\/\s*-?([\d,]+)/);
    if (linesMatch) {
      linesAdded = parseInt(linesMatch[1].replace(/,/g, ""), 10);
      linesRemoved = parseInt(linesMatch[2].replace(/,/g, ""), 10);
    }
  }

  const fileCount = statValues["files"]
    ? parseInt(statValues["files"].replace(/,/g, ""), 10)
    : null;
  const dayCount = statValues["days"]
    ? parseInt(statValues["days"].replace(/,/g, ""), 10)
    : null;
  const msgsPerDay = statValues["msgs/day"]
    ? parseFloat(statValues["msgs/day"].replace(/,/g, ""))
    : null;

  return { linesAdded, linesRemoved, fileCount, dayCount, msgsPerDay };
}

interface ParsedUpload {
  parsed: ParsedInsightsReport;
  responseBody: Record<string, unknown>;
}

/**
 * Shared parse pipeline used by both the multipart and bearer-auth
 * paths. Throws an Error subclass with a `status` field on validation
 * failure so the calling handler can surface a 400 with the right
 * message.
 */
class ParseError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ParseError";
    this.status = status;
  }
}

function parseUploadHtml(html: string): ParsedUpload {
  const isHarness = isHarnessReport(html);

  // For harness reports, parse the embedded /insights tab — the
  // top-level page has harness-specific selectors that would confuse
  // the insights parser.
  let insightsHtml = html;
  if (isHarness) {
    const $doc = cheerio.load(html);
    const insightsTab = $doc("#tab-insights");
    if (insightsTab.length) {
      insightsHtml = `<html><body>${insightsTab.html()}</body></html>`;
    }
  }

  const parsed = parseInsightsHtml(insightsHtml);
  const chartData = parseChartData(insightsHtml);
  const detectedSkills = detectSkills(parsed.data, chartData);
  const detectedRedactions = detectRedactions(parsed.data);

  let harnessData: ReturnType<typeof parseHarnessHtml> | undefined;
  if (isHarness) {
    // parseHarnessHtml throws on schema mismatch; let the caller
    // translate to 400 so the message reaches the user.
    harnessData = parseHarnessHtml(html);
  }

  const enhancedStats = harnessData?.enhancedStats
    ? {
        linesAdded: harnessData.enhancedStats.linesAdded,
        linesRemoved: harnessData.enhancedStats.linesRemoved,
        fileCount: harnessData.enhancedStats.fileCount,
        dayCount: harnessData.enhancedStats.dayCount,
        msgsPerDay: harnessData.enhancedStats.msgsPerDay,
      }
    : extractEnhancedStats(insightsHtml);

  const stats = {
    ...parsed.stats,
    ...enhancedStats,
    ...(harnessData
      ? {
          sessionCount:
            harnessData.stats.sessionCount ?? parsed.stats.sessionCount ?? 0,
          commitCount:
            harnessData.stats.commitCount ?? parsed.stats.commitCount ?? 0,
          dayCount: enhancedStats.dayCount ?? 30,
        }
      : {}),
  };

  // Compose the ParsedInsightsReport that publishReport expects. Layer
  // chartData / detectedSkills / harnessData / reportType onto the
  // shape the parser already returned.
  const composed: ParsedInsightsReport = {
    ...parsed,
    stats: {
      ...parsed.stats,
      ...stats,
    },
    chartData,
    detectedSkills,
    reportType: isHarness ? "insight-harness" : "insights",
    harnessData,
  };

  return {
    parsed: composed,
    responseBody: {
      stats,
      data: parsed.data,
      detectedRedactions,
      chartData,
      detectedSkills,
      reportType: isHarness ? "insight-harness" : "insights",
      harnessData,
    },
  };
}

/**
 * Multipart browser path — unchanged behavior. Parse-only; the client
 * receives the structured payload and POSTs to /api/insights to
 * actually persist (until Unit 9 unifies the flow).
 */
async function handleMultipart(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request body must be multipart/form-data" },
      { status: 400 },
    );
  }
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "HTML file is required" },
      { status: 400 },
    );
  }

  if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
    return NextResponse.json(
      { error: "File must be an HTML file" },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 },
    );
  }

  const html = await file.text();
  try {
    const { responseBody } = parseUploadHtml(html);
    return NextResponse.json(responseBody);
  } catch (e) {
    if (e instanceof ParseError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Failed to parse harness report data",
      },
      { status: 400 },
    );
  }
}

/**
 * Bearer-auth direct-POST path — Unit 7's primary flow. Parses the
 * raw HTML body and persists a draft InsightReport in one round trip,
 * with idempotency, rate-limit, and structured logging.
 */
/**
 * Allowed Content-Types on the bearer-auth path. Anything else (e.g.
 * application/json, text/plain) is rejected with 400 BEFORE we run
 * the parser, so a malformed payload never lands as a "{}-empty"
 * draft in InsightReport.
 */
const ALLOWED_BEARER_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "text/html",
]);

async function handleBearer(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : undefined;
  const contentType = (request.headers.get("content-type") ?? "")
    .toLowerCase()
    .split(";")[0]
    .trim();

  // ── 1. Authenticate ────────────────────────────────────────────────
  const authResult = await authenticateRequest(request);
  if (!authResult || !authResult.viaToken) {
    // No HarnessUpload row written: we don't know which user this came
    // from, so we cannot accurately attribute the attempt for R12.
    logHarnessRequest({
      contentLength,
      statusCode: 401,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId, username, tokenSelector } = authResult;
  const tokenSelectorPrefix = tokenSelector?.slice(0, 8);

  // ── 1b. Validate Content-Type ──────────────────────────────────────
  // Reject unsupported content types BEFORE rate-limit / idempotency
  // so a malformed payload (e.g. application/json with body `{}`) can
  // never land as an all-empty draft. Treat it as a "reached past auth
  // but failed validation" attempt so it counts toward R12's cap, with
  // a synthetic uploadId because we haven't validated the X-Upload-Id
  // yet either.
  if (!ALLOWED_BEARER_CONTENT_TYPES.has(contentType)) {
    await recordFailureWithSyntheticId(userId);
    logHarnessRequest({
      userId,
      tokenSelectorPrefix,
      contentLength,
      statusCode: 415,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "Unsupported Content-Type",
        message: "Send the report as application/octet-stream or text/html.",
      },
      { status: 415 },
    );
  }

  // ── 2. Validate X-Upload-Id ────────────────────────────────────────
  const rawUploadId = request.headers.get("x-upload-id");
  if (!rawUploadId || !UUID_REGEX.test(rawUploadId)) {
    // Synthetic id so the row still records (R12 needs every reach
    // beyond auth to count toward the attempt cap, even when the
    // client never gave us a valid id).
    await recordFailureWithSyntheticId(userId);
    logHarnessRequest({
      userId,
      tokenSelectorPrefix,
      contentLength,
      statusCode: 400,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "X-Upload-Id header is required and must be a UUID" },
      { status: 400 },
    );
  }
  const uploadId = rawUploadId.toLowerCase();

  // ── 3. Idempotency lookup BEFORE rate limit (R14a) ─────────────────
  const replay = await findIdempotentResult(userId, uploadId);
  if (replay) {
    logHarnessRequest({
      uploadId,
      userId,
      tokenSelectorPrefix,
      contentLength,
      replayed: true,
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      editUrl: buildReportEditUrl(username, replay.slug),
      slug: replay.slug,
      uploadId,
      status: "draft",
      replayed: true,
    });
  }

  // ── 4. Rate limit ──────────────────────────────────────────────────
  const limit = await checkUploadRateLimit(userId);
  if (!limit.ok) {
    // recordFailure will fall back to a synthetic id if the (userId,
    // uploadId) row already exists, so a token holder repeatedly
    // retrying with the same uploadId still ticks the attempt cap.
    await recordFailure(userId, uploadId);
    logHarnessRequest({
      uploadId,
      userId,
      tokenSelectorPrefix,
      contentLength,
      rateLimitReason: limit.reason,
      statusCode: 429,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "rate_limited",
        reason: limit.reason,
        retryAfter: limit.retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  // ── 5. Read body, parse, publish (under withIdempotency) ───────────
  // Quick reject on Content-Length BEFORE buffering — clients that
  // send a >10MB body have advertised the size and we don't need to
  // read it to know.
  if (typeof contentLength === "number" && contentLength > MAX_UPLOAD_BYTES) {
    await recordFailure(userId, uploadId);
    logHarnessRequest({
      uploadId,
      userId,
      tokenSelectorPrefix,
      contentLength,
      statusCode: 400,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 },
    );
  }

  let bodyBytes: ArrayBuffer;
  try {
    bodyBytes = await request.arrayBuffer();
  } catch {
    await recordFailure(userId, uploadId);
    logHarnessRequest({
      uploadId,
      userId,
      tokenSelectorPrefix,
      contentLength,
      statusCode: 400,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Failed to read request body" },
      { status: 400 },
    );
  }

  // Hard byte-size cap. arrayBuffer().byteLength counts actual bytes
  // on the wire, so multibyte HTML cannot bypass the limit by virtue
  // of UTF-16 string-length being smaller than the UTF-8 byte length.
  if (bodyBytes.byteLength > MAX_UPLOAD_BYTES) {
    await recordFailure(userId, uploadId);
    logHarnessRequest({
      uploadId,
      userId,
      tokenSelectorPrefix,
      contentLength,
      statusCode: 400,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 },
    );
  }

  const html = new TextDecoder("utf-8").decode(bodyBytes);

  let parsed: ParsedInsightsReport;
  try {
    ({ parsed } = parseUploadHtml(html));
  } catch (e) {
    await recordFailure(userId, uploadId);
    logHarnessRequest({
      uploadId,
      userId,
      tokenSelectorPrefix,
      contentLength,
      statusCode: 400,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Failed to parse harness report data",
      },
      { status: 400 },
    );
  }

  let result: { slug: string; replayed: boolean };
  try {
    result = await withIdempotency(userId, uploadId, async () => {
      const created = await publishReport({
        userId,
        username,
        parsed,
        redactions: [],
        projectIds: [],
        hiddenHarnessSections: [],
        isDraft: true,
      });
      return { slug: created.slug };
    });
  } catch (e) {
    await recordFailure(userId, uploadId);
    logHarnessRequest({
      uploadId,
      userId,
      tokenSelectorPrefix,
      contentLength,
      statusCode: 500,
      durationMs: Date.now() - startedAt,
    });
    console.error("POST /api/upload bearer publish failed:", e);
    return NextResponse.json(
      { error: "Failed to publish draft report" },
      { status: 500 },
    );
  }

  logHarnessRequest({
    uploadId,
    userId,
    tokenSelectorPrefix,
    contentLength,
    replayed: result.replayed,
    statusCode: 200,
    durationMs: Date.now() - startedAt,
  });
  return NextResponse.json({
    editUrl: buildReportEditUrl(username, result.slug),
    slug: result.slug,
    uploadId,
    status: "draft",
    replayed: result.replayed,
  });
}

/**
 * Record a failed bearer-path upload attempt. The unique constraint
 * on (userId, uploadId) means a literal retry of the same uploadId
 * cannot create another row at that key — so on P2002 we fall back to
 * inserting a row with a synthetic id. This preserves R12's
 * "every reach beyond auth counts toward the attempt cap" invariant
 * even when a token holder spams retries with the same uploadId.
 */
async function recordFailure(userId: string, uploadId: string): Promise<void> {
  try {
    await prisma.harnessUpload.create({
      data: { userId, uploadId, slug: null, success: false },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Original (userId, uploadId) row already exists — this is a
      // retry of a previously-failed attempt. Insert under a synthetic
      // id so the attempt-cap counter still increments for this hit.
      await recordFailureWithSyntheticId(userId);
      return;
    }
    console.error("Failed to record HarnessUpload failure row:", e);
  }
}

/**
 * Record a failed attempt under a synthetic uploadId. Used in two
 * cases: (a) the request's X-Upload-Id was missing/malformed so we
 * never had a real id, and (b) a retry of an already-failed (userId,
 * uploadId) tripped the unique constraint above. In both cases the
 * synthetic id is unique-per-row so the attempt counter ticks
 * forward, even when the same client keeps misbehaving.
 */
async function recordFailureWithSyntheticId(userId: string): Promise<void> {
  try {
    await prisma.harnessUpload.create({
      data: {
        userId,
        uploadId: syntheticUploadId(),
        slug: null,
        success: false,
      },
    });
  } catch (e) {
    console.error(
      "Failed to record HarnessUpload synthetic-id failure row:",
      e,
    );
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  return code === "P2002";
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.toLowerCase().startsWith("multipart/");

  try {
    if (isMultipart) {
      return await handleMultipart(request);
    }
    return await handleBearer(request);
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}
