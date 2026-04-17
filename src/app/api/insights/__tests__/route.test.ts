/**
 * Tests for POST /api/insights — request-body validation (#112) and
 * save-side integration (#119).
 *
 * Scope:
 *   - Validation (#112): zod schema rejects malformed bodies at 400
 *     before any DB work.
 *   - Save-side (#119): with a valid body, the handler runs the
 *     $transaction, persists via insightReport.create with the
 *     expected field set, and returns 201 with id + slug. Also
 *     locks field-allowlist behavior (ignored) and the current
 *     slug-collision failure mode.
 *
 * Prisma and link-preview are mocked at the module level. The
 * $transaction mock invokes its callback with a tx object wired to
 * the same prisma.* mocks so assertions can read either entry point.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    insightReport: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    reportProject: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/link-preview", () => ({
  fetchLinkPreview: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { POST as insightsPOST } from "../route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  user: { findUnique: Mock };
  insightReport: { create: Mock; findUnique: Mock };
  project: { findMany: Mock; findFirst: Mock; create: Mock };
  reportProject: { createMany: Mock };
  $transaction: Mock;
};

// Wire $transaction to execute its callback with a tx object backed
// by the same prisma.* mocks. The real Prisma client's tx has
// identical method surface, so tests can assert on either entry.
function wireTransaction() {
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
  );
}

function mockSessionAndUser(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
    return;
  }
  mockAuth.mockResolvedValue({ user: { id: userId } });
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId,
    username: "testuser",
  });
}

function postRequest(body: unknown, options: { raw?: string } = {}): Request {
  return new Request("http://localhost/api/insights", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: options.raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/insights — auth", () => {
  it("returns 401 before validation when unauthed", async () => {
    mockSessionAndUser(null);
    const response = await insightsPOST(postRequest({}));
    expect(response.status).toBe(401);
  });
});

describe("POST /api/insights — body-level validation", () => {
  it("returns 400 when the body is not valid JSON", async () => {
    mockSessionAndUser("user-1");
    const response = await insightsPOST(
      postRequest(null, { raw: "not-json-at-all" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/valid JSON/i);
  });

  it("returns 400 when sessionCount has the wrong type", async () => {
    mockSessionAndUser("user-1");
    const response = await insightsPOST(
      postRequest({ sessionCount: "fourty-two" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/sessionCount/);
    expect(Array.isArray(body.issues)).toBe(true);
    expect(
      body.issues.some(
        (i: { path: Array<string | number> }) => i.path[0] === "sessionCount",
      ),
    ).toBe(true);
  });

  it("returns 400 when linesAdded is a negative number", async () => {
    // Pin type-level validation for optional stat fields so a future
    // "I'll just pass -1 for unknown" client regression gets a 400,
    // not a silently persisted negative counter.
    mockSessionAndUser("user-1");
    const response = await insightsPOST(
      postRequest({ sessionCount: 1, linesAdded: -42 }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/linesAdded/);
  });

  it("returns 400 when totalTokens is negative", async () => {
    mockSessionAndUser("user-1");
    const response = await insightsPOST(
      postRequest({ sessionCount: 1, totalTokens: -5 }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/totalTokens/);
  });

  it("returns 400 when totalTokens is a non-integer number", async () => {
    mockSessionAndUser("user-1");
    const response = await insightsPOST(
      postRequest({ sessionCount: 1, totalTokens: 3.14 }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/totalTokens/);
  });

  it("does not call Prisma when validation fails", async () => {
    mockSessionAndUser("user-1");
    // Clear the user-lookup mock afterwards so the assertion below
    // only speaks to the WRITE path, not the initial user read.
    await insightsPOST(postRequest({ sessionCount: "bad" }));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.insightReport.create).not.toHaveBeenCalled();
  });

  it("accepts a body with sessionCount: null (plain /insights upload path)", async () => {
    // Regression lock: the upload UI sends `sessionCount: null` when
    // the parser can't extract a count from plain /insights HTML
    // (src/app/upload/page.tsx:777). The schema must NOT reject
    // those bodies at validation. We don't assert 201 here — full
    // save-path is covered by the #119 block below — only that
    // validation doesn't bounce the request.
    mockSessionAndUser("user-1");
    const response = await insightsPOST(postRequest({ sessionCount: null }));
    expect(response.status).not.toBe(400);
  });
});

// ── #119: save-side integration ─────────────────────────────────────

function seedReportMock(overrides: Partial<Record<string, unknown>> = {}) {
  const id = (overrides.id as string) ?? "rpt_1";
  const slug = (overrides.slug as string) ?? "20260416-abc123";
  mockPrisma.insightReport.create.mockResolvedValue({ id, slug });
  mockPrisma.insightReport.findUnique.mockResolvedValue({
    id,
    slug,
    title: "Test Report",
    authorId: "user-1",
    author: {
      id: "user-1",
      username: "testuser",
      displayName: "Test User",
      avatarUrl: null,
    },
    reportProjects: [],
    ...overrides,
  });
}

describe("POST /api/insights — save-side happy path", () => {
  it("creates the report via $transaction and returns 201 with id + slug", async () => {
    mockSessionAndUser("user-1");
    wireTransaction();
    seedReportMock();

    const response = await insightsPOST(
      postRequest({
        sessionCount: 42,
        messageCount: 512,
        linesAdded: 2048,
        atAGlance: { whats_working: "x" },
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe("rpt_1");
    expect(body.data.slug).toBe("20260416-abc123");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.insightReport.create).toHaveBeenCalledTimes(1);

    // The persisted row is authored by the session user, stamps the
    // stat fields from the body, and generates its own slug + default
    // reportType. Authoritative shape of the first `create` call:
    const createArgs = mockPrisma.insightReport.create.mock.calls[0][0];
    expect(createArgs.data.authorId).toBe("user-1");
    expect(createArgs.data.sessionCount).toBe(42);
    expect(createArgs.data.messageCount).toBe(512);
    expect(createArgs.data.linesAdded).toBe(2048);
    expect(createArgs.data.reportType).toBe("insights");
    expect(typeof createArgs.data.slug).toBe("string");
    expect(createArgs.data.slug.length).toBeGreaterThan(0);
  });

  it("auto-generates a title when the body omits one", async () => {
    mockSessionAndUser("user-1");
    wireTransaction();
    seedReportMock();

    await insightsPOST(postRequest({ sessionCount: 1 }));

    const createArgs = mockPrisma.insightReport.create.mock.calls[0][0];
    // Fallback title references the username, derived server-side.
    expect(createArgs.data.title).toContain("testuser");
  });

  it("converts totalTokens to BigInt and defaults array columns to []", async () => {
    // Regression guard for PR #123 (the BigInt widening fix) and
    // the array-default clauses at route.ts:486 (detectedSkills)
    // and route.ts:498-500 (hiddenHarnessSections). A future
    // refactor that forgets `?? []` would ship null and crash the
    // detail page; the BigInt cast is the fix that unblocked the
    // 500s on publish for users with ~5B+ lifetime tokens.
    mockSessionAndUser("user-1");
    wireTransaction();
    seedReportMock();

    await insightsPOST(
      postRequest({
        sessionCount: 1,
        totalTokens: 5_000_000_000,
      }),
    );

    const createArgs = mockPrisma.insightReport.create.mock.calls[0][0];
    expect(typeof createArgs.data.totalTokens).toBe("bigint");
    expect(createArgs.data.totalTokens).toBe(BigInt(5_000_000_000));
    expect(createArgs.data.detectedSkills).toEqual([]);
    expect(createArgs.data.hiddenHarnessSections).toEqual([]);
  });

  it("passes through harnessData when valid", async () => {
    // harnessData is normalized by normalizeHarnessData before
    // hitting Prisma. A body with the required stats/autonomy/
    // featurePills keys must survive and be persisted.
    mockSessionAndUser("user-1");
    wireTransaction();
    seedReportMock();

    await insightsPOST(
      postRequest({
        sessionCount: 10,
        reportType: "insight-harness",
        harnessData: {
          stats: { sessionCount: 10, lifetimeTokens: 1000 },
          autonomy: { label: "balanced" },
          featurePills: [],
        },
      }),
    );

    const createArgs = mockPrisma.insightReport.create.mock.calls[0][0];
    expect(createArgs.data.reportType).toBe("insight-harness");
    expect(createArgs.data.harnessData).toBeDefined();
  });
});

describe("POST /api/insights — field allowlist enforcement", () => {
  it("ignores server-controlled fields injected via the body", async () => {
    // Pin the current behavior: authorId, createdAt, publishedAt,
    // and slug in the body are silently dropped. The server never
    // trusts these; it derives authorId from the session and
    // auto-generates slug/timestamps. A regression that starts
    // honoring client-supplied authorId would be a spoofing vector.
    mockSessionAndUser("user-1");
    wireTransaction();
    seedReportMock();

    await insightsPOST(
      postRequest({
        sessionCount: 1,
        authorId: "attacker-999",
        createdAt: "2000-01-01T00:00:00Z",
        publishedAt: "2000-01-01T00:00:00Z",
        slug: "attacker-chosen-slug",
      }),
    );

    const createArgs = mockPrisma.insightReport.create.mock.calls[0][0];
    expect(createArgs.data.authorId).toBe("user-1");
    expect(createArgs.data.slug).not.toBe("attacker-chosen-slug");
    // Assert absence of the keys rather than `=== undefined`, so a
    // future zod change that adds `.passthrough()` or the handler
    // switching to `...rest` spread would fail this test instead of
    // silently propagating attacker-controlled values.
    const dataKeys = Object.keys(createArgs.data);
    expect(dataKeys).not.toContain("createdAt");
    expect(dataKeys).not.toContain("publishedAt");
  });
});

describe("POST /api/insights — slug collision", () => {
  it("surfaces a 500 when Prisma's unique constraint rejects the slug", async () => {
    // Current behavior lock: slug is generated via Math.random (6
    // base36 chars per date prefix — collisions are essentially
    // impossible in practice). If one ever occurred, the
    // transaction would reject via Prisma's @@unique([authorId,
    // slug]) and bubble to the outer catch as a 500. No retry
    // logic exists. If generateSlug is ever made
    // collision-resistant, update this assertion.
    mockSessionAndUser("user-1");
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    const uniqueError = Object.assign(
      new Error("Unique constraint failed on fields: (authorId, slug)"),
      { code: "P2002" },
    );
    mockPrisma.insightReport.create.mockRejectedValueOnce(uniqueError);

    const response = await insightsPOST(postRequest({ sessionCount: 1 }));
    expect(response.status).toBe(500);
  });
});
