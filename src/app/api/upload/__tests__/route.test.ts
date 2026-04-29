/**
 * Integration tests for POST /api/upload.
 *
 * Two paths under test:
 *   1. Multipart browser path — parses HTML and returns a structured
 *      payload to the React upload page (legacy behavior).
 *   2. Bearer-auth direct-POST path — parses HTML AND persists a draft
 *      InsightReport in one round trip (Unit 7 of Wave 3b plan).
 *
 * The bearer path's correctness depends on a strict pipeline order
 * (Decision 11): authenticate → validate X-Upload-Id → idempotency
 * lookup → rate-limit → parse + persist. Tests below assert that
 * order, including the critical "idempotency beats rate limit"
 * scenario (R14a).
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Mocks (declared before the route imports) ───────────────────────

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
    reportProject: {
      createMany: vi.fn(),
    },
    harnessUpload: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/harness-auth", () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("@/lib/harness-rate-limit", () => ({
  checkUploadRateLimit: vi.fn(),
}));

vi.mock("@/lib/harness-idempotency", () => ({
  findIdempotentResult: vi.fn(),
  withIdempotency: vi.fn(),
}));

vi.mock("@/lib/publish-report", () => ({
  publishReport: vi.fn(),
}));

// Spy on the structured logger so tests can assert one log line per
// terminal response without actually emitting JSON to stdout.
vi.mock("@/lib/harness-logging", () => ({
  logHarnessRequest: vi.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/harness-auth";
import { checkUploadRateLimit } from "@/lib/harness-rate-limit";
import {
  findIdempotentResult,
  withIdempotency,
} from "@/lib/harness-idempotency";
import { logHarnessRequest } from "@/lib/harness-logging";
import { publishReport } from "@/lib/publish-report";
import { POST as uploadPOST } from "../route";

const mockAuth = auth as unknown as Mock;
const mockAuthenticate = authenticateRequest as unknown as Mock;
const mockUploadLimit = checkUploadRateLimit as unknown as Mock;
const mockFindIdempotent = findIdempotentResult as unknown as Mock;
const mockWithIdempotency = withIdempotency as unknown as Mock;
const mockPublish = publishReport as unknown as Mock;
const mockLog = logHarnessRequest as unknown as Mock;
const mockPrisma = prisma as unknown as {
  harnessUpload: { create: Mock };
};

// ── Fixture loader ──────────────────────────────────────────────────

const FIXTURE_PATH = resolve(
  __dirname,
  "../../../../lib/__tests__/fixtures/insight-harness-v2.7.0.html",
);
const FIXTURE_HTML = readFileSync(FIXTURE_PATH, "utf-8");
const VALID_UUID = "11111111-2222-3333-4444-555555555555";

// ── Helpers ─────────────────────────────────────────────────────────

function mockSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function multipartRequest(
  html: string,
  filename = "insight-harness.html",
): Request {
  const formData = new FormData();
  formData.append("file", new File([html], filename, { type: "text/html" }));
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

interface BearerOptions {
  uploadId?: string | null;
  authResult?:
    | {
        userId: string;
        username: string;
        viaToken: true;
        tokenSelector: string;
      }
    | { viaToken: false }
    | null;
  body?: string;
  contentType?: string;
}

function bearerRequest(opts: BearerOptions = {}): Request {
  const headers: Record<string, string> = {
    "content-type": opts.contentType ?? "application/octet-stream",
    authorization: `Bearer ih_${"a".repeat(76)}`,
  };
  if (opts.uploadId !== null) {
    headers["x-upload-id"] = opts.uploadId ?? VALID_UUID;
  }
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers,
    body: opts.body ?? FIXTURE_HTML,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults so an authed bearer request flows through the happy path
  // unless a test overrides one of these.
  mockAuthenticate.mockResolvedValue({
    userId: "user-1",
    username: "alice",
    viaToken: true,
    tokenSelector: "abcdef012345",
  });
  mockFindIdempotent.mockResolvedValue(null);
  mockUploadLimit.mockResolvedValue({ ok: true });
  mockWithIdempotency.mockImplementation(
    async (
      _userId: string,
      _uploadId: string,
      work: () => Promise<{ slug: string }>,
    ) => {
      const r = await work();
      return { slug: r.slug, replayed: false };
    },
  );
  mockPublish.mockResolvedValue({
    id: "report-1",
    slug: "20260421-abc123",
    authorId: "user-1",
    isDraft: true,
  });
  mockPrisma.harnessUpload.create.mockResolvedValue({});
});

// ── Multipart path (legacy browser flow — regression guards) ────────

describe("POST /api/upload — multipart auth", () => {
  it("returns 401 when there is no session", async () => {
    mockSession(null);
    const response = await uploadPOST(multipartRequest(FIXTURE_HTML));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/upload — multipart input validation", () => {
  it("returns 400 when no file field is present", async () => {
    mockSession("user-1");
    const formData = new FormData();
    const request = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadPOST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when filename does not end in .html or .htm", async () => {
    mockSession("user-1");
    const response = await uploadPOST(
      multipartRequest(FIXTURE_HTML, "report.pdf"),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when the file exceeds the 10MB cap", async () => {
    mockSession("user-1");
    const OVERSIZED = "x".repeat(10 * 1024 * 1024 + 1);
    const formData = new FormData();
    formData.append(
      "file",
      new File([OVERSIZED], "big.html", { type: "text/html" }),
    );
    const request = new Request("http://localhost/api/upload", {
      method: "POST",
      body: formData,
    });
    const response = await uploadPOST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/too large|10MB/i);
  });
});

describe("POST /api/upload — multipart legacy harness format (pre-2.5.0)", () => {
  const LEGACY_HARNESS_HTML = `<!doctype html>
<html>
  <body>
    <script type="application/json" id="insight-harness-integrity">
      { "hash": "legacy-fixture" }
    </script>
    <script type="application/json" id="harness-data">
      { "skillVersion": "2.4.0" }
    </script>
    <div id="tab-insights"></div>
  </body>
</html>`;

  it("returns 400 (not 500) with a schema-mismatch error message", async () => {
    mockSession("user-1");
    const response = await uploadPOST(multipartRequest(LEGACY_HARNESS_HTML));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/required fields|HarnessData/i);
  });
});

describe("POST /api/upload — multipart v2.7.0 happy path", () => {
  it("parses end-to-end and returns reportType=insight-harness", async () => {
    mockSession("user-1");
    const response = await uploadPOST(multipartRequest(FIXTURE_HTML));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reportType).toBe("insight-harness");
  });

  it("preserves enhanced stats override behavior", async () => {
    mockSession("user-1");
    const response = await uploadPOST(multipartRequest(FIXTURE_HTML));
    const body = await response.json();
    expect(body.stats.sessionCount).toBe(95);
    expect(body.stats.linesAdded).toBe(12500);
  });
});

// ── Bearer-auth direct-POST path ────────────────────────────────────

describe("POST /api/upload — bearer auth", () => {
  it("returns 401 when authenticateRequest returns null", async () => {
    mockAuthenticate.mockResolvedValue(null);
    const response = await uploadPOST(bearerRequest());
    expect(response.status).toBe(401);
    expect(mockPrisma.harnessUpload.create).not.toHaveBeenCalled();
    // Logger fires once; no userId attribution because auth failed.
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("returns 401 when the request was authed by session, not bearer", async () => {
    mockAuthenticate.mockResolvedValue({
      userId: "user-1",
      username: "alice",
      viaToken: false,
    });
    const response = await uploadPOST(bearerRequest());
    expect(response.status).toBe(401);
  });
});

describe("POST /api/upload — bearer X-Upload-Id validation", () => {
  it("returns 400 + records HarnessUpload {success:false} when X-Upload-Id is missing", async () => {
    const response = await uploadPOST(bearerRequest({ uploadId: null }));
    expect(response.status).toBe(400);
    expect(mockPrisma.harnessUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          success: false,
        }),
      }),
    );
    // Synthetic upload id used so the row stores something unique per
    // attempt for rate-limit accounting.
    const arg = mockPrisma.harnessUpload.create.mock.calls[0][0];
    expect(arg.data.uploadId).toMatch(/^bad-upload-id:/);
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", statusCode: 400 }),
    );
  });

  it("returns 400 + records HarnessUpload {success:false} when X-Upload-Id is malformed", async () => {
    const response = await uploadPOST(
      bearerRequest({ uploadId: "not-a-uuid" }),
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.harnessUpload.create).toHaveBeenCalled();
  });
});

describe("POST /api/upload — bearer idempotency", () => {
  it("short-circuits with replayed:true on a prior successful uploadId", async () => {
    mockFindIdempotent.mockResolvedValue({ slug: "20260421-prior" });

    const response = await uploadPOST(bearerRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      replayed: true,
      slug: "20260421-prior",
      uploadId: VALID_UUID,
      status: "draft",
    });
    expect(body.editUrl).toBe("/insights/alice/20260421-prior/edit");
    // CRITICAL: no rate-limit check on replays (R14a).
    expect(mockUploadLimit).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("idempotency beats rate limit — replay returns 200 even when user is at cap", async () => {
    // R14a contract: even if the user is rate-limited, a replay of a
    // prior successful uploadId must return the original slug, not 429.
    // The order of these mocks reflects the route's actual call order:
    // findIdempotentResult is consulted BEFORE checkUploadRateLimit.
    mockFindIdempotent.mockResolvedValue({ slug: "20260421-prior" });
    mockUploadLimit.mockResolvedValue({
      ok: false,
      retryAfter: 3600,
      reason: "uploads_24h",
    });

    const response = await uploadPOST(bearerRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.replayed).toBe(true);
    expect(body.slug).toBe("20260421-prior");
    // Rate-limit check must NOT have been called.
    expect(mockUploadLimit).not.toHaveBeenCalled();
  });
});

describe("POST /api/upload — bearer rate limit", () => {
  it("returns 429 with Retry-After + uploads_24h when at success cap", async () => {
    mockUploadLimit.mockResolvedValue({
      ok: false,
      retryAfter: 7200,
      reason: "uploads_24h",
    });

    const response = await uploadPOST(bearerRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7200");
    const body = await response.json();
    expect(body.reason).toBe("uploads_24h");
    expect(body.retryAfter).toBe(7200);
    // A failed-attempt row is recorded for the attempt cap.
    expect(mockPrisma.harnessUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          uploadId: VALID_UUID,
          success: false,
        }),
      }),
    );
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        rateLimitReason: "uploads_24h",
      }),
    );
    // Publish never called on rate limit.
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("returns 429 with attempts_24h reason when the attempt cap is hit", async () => {
    mockUploadLimit.mockResolvedValue({
      ok: false,
      retryAfter: 60,
      reason: "attempts_24h",
    });

    const response = await uploadPOST(bearerRequest());
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.reason).toBe("attempts_24h");
  });
});

describe("POST /api/upload — bearer happy path", () => {
  it("parses, publishes a draft, and returns editUrl + slug + uploadId + status", async () => {
    const response = await uploadPOST(bearerRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      slug: "20260421-abc123",
      uploadId: VALID_UUID,
      status: "draft",
      replayed: false,
    });
    expect(body.editUrl).toBe("/insights/alice/20260421-abc123/edit");
    // publishReport called with isDraft:true, redactions/projectIds
    // empty (the user redacts on the edit page).
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        username: "alice",
        isDraft: true,
        redactions: [],
        projectIds: [],
      }),
    );
    // Logger emits one structured 200 line for the bearer flow with
    // the full Decision-13 field set (sans full token).
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadId: VALID_UUID,
        userId: "user-1",
        tokenSelectorPrefix: "abcdef01",
        statusCode: 200,
        replayed: false,
      }),
    );
    // Selector is logged in 8-char trimmed form, never the full 12.
    const logArg = mockLog.mock.calls.at(-1)?.[0];
    expect(logArg.tokenSelectorPrefix.length).toBe(8);
  });
});

describe("POST /api/upload — bearer parse failure", () => {
  it("returns 400 + records HarnessUpload {success:false} on malformed harness JSON", async () => {
    const LEGACY = `<!doctype html>
<html>
  <body>
    <script type="application/json" id="insight-harness-integrity">
      { "hash": "x" }
    </script>
    <script type="application/json" id="harness-data">
      { "skillVersion": "2.4.0" }
    </script>
    <div id="tab-insights"></div>
  </body>
</html>`;
    const response = await uploadPOST(bearerRequest({ body: LEGACY }));
    expect(response.status).toBe(400);
    expect(mockPrisma.harnessUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false }),
      }),
    );
    // Publish never reached on parse failure.
    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe("POST /api/upload — bearer selectors never log the full token", () => {
  it("logHarnessRequest receives only the trimmed selector prefix", async () => {
    await uploadPOST(bearerRequest());
    // Find every call to the logger and assert no field contains the
    // raw bearer token from the Authorization header.
    for (const call of mockLog.mock.calls) {
      const fields = call[0];
      const flat = JSON.stringify(fields);
      expect(flat).not.toContain("a".repeat(20));
      expect(flat).not.toMatch(/Bearer/i);
    }
  });
});
