/**
 * Tests for GET /api/upload/status — the browser polling endpoint that
 * the upload page hits every 3s while waiting for a tokenized direct
 * POST from the user's harness skill.
 *
 * Scope:
 *   - Auth: session-only (no bearer fallback). Unauthed → 401.
 *   - Param validation: `since` is required and must parse as a Date.
 *   - Query: `findFirst` over the caller's drafts created after `since`,
 *     newest first. Returns `{ editUrl, slug, createdAt }` or
 *     `{ editUrl: null }`.
 *   - Cache: every response carries `Cache-Control: no-store` so an
 *     upstream CDN doesn't memoize a "not ready" response and starve
 *     the polling loop.
 *   - Scoping: a different user's newer draft must not leak across.
 *     The `where: { authorId }` filter enforces this; the test asserts
 *     the Prisma call shape so a future refactor can't drop it.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { GET as statusGET } from "../route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  insightReport: { findFirst: Mock };
};

function mockSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function statusRequest(since: string | null): Request {
  const url = new URL("http://localhost/api/upload/status");
  if (since !== null) {
    url.searchParams.set("since", since);
  }
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/upload/status — auth", () => {
  it("returns 401 when unauthed", async () => {
    mockSession(null);
    const response = await statusGET(statusRequest("2026-04-21T00:00:00.000Z"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockPrisma.insightReport.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/upload/status — param validation", () => {
  it("returns 400 when `since` is missing", async () => {
    mockSession("user-1");
    const response = await statusGET(statusRequest(null));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockPrisma.insightReport.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 when `since` is unparseable", async () => {
    mockSession("user-1");
    const response = await statusGET(statusRequest("not-a-date"));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockPrisma.insightReport.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/upload/status — query", () => {
  it("returns editUrl + slug + createdAt when a fresh draft exists", async () => {
    mockSession("user-1");
    const created = new Date("2026-04-21T01:00:00.000Z");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      slug: "20260421-abc123",
      createdAt: created,
      author: { username: "craig" },
    });

    const response = await statusGET(statusRequest("2026-04-21T00:00:00.000Z"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body).toEqual({
      editUrl: "/insights/craig/20260421-abc123/edit",
      slug: "20260421-abc123",
      createdAt: created.toISOString(),
    });

    // Lock down the Prisma call shape — authorId scope, isDraft filter,
    // and the createdAt > since cutoff. A future refactor that drops
    // any of these would silently leak other users' drafts.
    expect(mockPrisma.insightReport.findFirst).toHaveBeenCalledTimes(1);
    const call = mockPrisma.insightReport.findFirst.mock.calls[0][0];
    expect(call.where.authorId).toBe("user-1");
    expect(call.where.isDraft).toBe(true);
    expect(call.where.createdAt).toEqual({
      gt: new Date("2026-04-21T00:00:00.000Z"),
    });
    expect(call.orderBy).toEqual({ createdAt: "desc" });
  });

  it("returns { editUrl: null } when only older drafts exist", async () => {
    mockSession("user-1");
    // The handler relies on Prisma's `createdAt: { gt: sinceDate }`
    // filter to exclude older drafts. We assert the contract by having
    // the mock return null (mimicking "no rows match the filter").
    mockPrisma.insightReport.findFirst.mockResolvedValue(null);

    const response = await statusGET(statusRequest("2026-04-21T00:00:00.000Z"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ editUrl: null });
  });

  it("returns { editUrl: null } when the user has no drafts at all", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue(null);

    const response = await statusGET(statusRequest("2026-04-21T00:00:00.000Z"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ editUrl: null });
  });

  it("scopes to the caller — a different user's fresh draft does not leak", async () => {
    mockSession("user-1");
    // Simulate Prisma honoring the `authorId: 'user-1'` filter by
    // returning null even though user-2 has a fresh draft.
    mockPrisma.insightReport.findFirst.mockResolvedValue(null);

    const response = await statusGET(statusRequest("2026-04-21T00:00:00.000Z"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ editUrl: null });

    // Belt-and-braces: assert authorId is wired from the session, not
    // pulled from a query param or header.
    const call = mockPrisma.insightReport.findFirst.mock.calls[0][0];
    expect(call.where.authorId).toBe("user-1");
  });
});
