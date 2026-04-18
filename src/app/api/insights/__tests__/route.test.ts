/**
 * Tests for POST /api/insights request-body validation (#112).
 *
 * Scope: the zod schema at the top of route.ts. Confirms that the
 * handler rejects malformed/typed-wrong bodies at 400 before doing
 * any DB work. Full happy-path save-side integration lives in #119.
 *
 * Prisma and link-preview are mocked defensively so a validation
 * regression that leaks past the guard (and tries to call Prisma)
 * will blow up with a clear mock-usage error rather than silently
 * returning 201.
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
  $transaction: Mock;
};

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
    // save-path is covered in #119 — only that validation doesn't
    // bounce the request.
    mockSessionAndUser("user-1");
    const response = await insightsPOST(postRequest({ sessionCount: null }));
    expect(response.status).not.toBe(400);
  });
});
