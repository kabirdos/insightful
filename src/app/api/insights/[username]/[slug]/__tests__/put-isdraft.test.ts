/**
 * Tests for PUT /api/insights/[username]/[slug] — isDraft transitions
 * (Wave 4 Unit 10 / R10 / R11).
 *
 * Contracts under test:
 *   1. Owner PUTs `isDraft: false` on own draft → 200 + flips the row.
 *   2. Owner PUTs `isDraft: true` on a public report → 400 (one-way).
 *   3. Non-owner / unauth PUT → 401 / 404 (already covered by the
 *      visibility filter; this file pins the contract regardless).
 *   4. Non-boolean `isDraft` payload → 400.
 *   5. No-op self-set (`false → false`) does NOT trigger an update —
 *      regression guard against silently bumping `updatedAt`.
 *
 * Follows the mocked-Prisma + mocked-auth pattern established in the
 * sibling route.test.ts.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    reportProject: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PUT as putInsight } from "../route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  insightReport: { findFirst: Mock; update: Mock };
};

function mockSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function paramsPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

function putRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PUT /api/insights/[username]/[slug] — isDraft transitions", () => {
  it("flips a draft to public when the owner sends isDraft: false", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
      isDraft: true,
    });
    mockPrisma.insightReport.update.mockResolvedValue({
      id: "r1",
      slug: "s1",
      isDraft: false,
      author: {
        id: "user-1",
        username: "u1",
        displayName: null,
        avatarUrl: null,
      },
    });

    const response = await putInsight(
      putRequest("http://localhost/api/insights/u1/s1", { isDraft: false }),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(200);

    // Pin the update args — the handler must pass `isDraft: false`
    // through to Prisma. A regression that dropped the field would
    // result in a silent no-op.
    const updateCall = mockPrisma.insightReport.update.mock.calls[0]?.[0];
    expect(updateCall?.where).toEqual({ id: "r1" });
    expect(updateCall?.data?.isDraft).toBe(false);
  });

  it("rejects flipping a public report back to draft (one-way)", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
      isDraft: false,
    });

    const response = await putInsight(
      putRequest("http://localhost/api/insights/u1/s1", { isDraft: true }),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    // Surface the specific message so the UI can react if it ever
    // hits this branch (it shouldn't — the button is hidden when the
    // report is already public).
    expect(body.error).toMatch(/one-way|cannot revert/i);
    expect(mockPrisma.insightReport.update).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean isDraft payload with 400", async () => {
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
      isDraft: true,
    });

    const response = await putInsight(
      putRequest("http://localhost/api/insights/u1/s1", { isDraft: "false" }),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.insightReport.update).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated callers", async () => {
    mockSession(null);
    const response = await putInsight(
      putRequest("http://localhost/api/insights/u1/s1", { isDraft: false }),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 when a non-owner tries to flip someone else's draft", async () => {
    // The visibility filter (draftVisibilityClause) hides the row
    // from non-owners, so the PUT handler's findFirst returns null
    // and we get a 404 — same code path as "report doesn't exist."
    // This is the correct behavior (don't reveal draft existence).
    mockSession("user-2");
    mockPrisma.insightReport.findFirst.mockResolvedValue(null);

    const response = await putInsight(
      putRequest("http://localhost/api/insights/u1/s1", { isDraft: false }),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(404);
    expect(mockPrisma.insightReport.update).not.toHaveBeenCalled();
  });

  it("drops a no-op isDraft self-set so updatedAt is not bumped redundantly", async () => {
    // PUT with `isDraft: true` on a row that's already a draft should
    // succeed (no error) but must NOT pass `isDraft` through to the
    // update payload — otherwise every save bumps updatedAt for a
    // value that didn't change.
    mockSession("user-1");
    mockPrisma.insightReport.findFirst.mockResolvedValue({
      id: "r1",
      authorId: "user-1",
      isDraft: true,
    });
    mockPrisma.insightReport.update.mockResolvedValue({
      id: "r1",
      slug: "s1",
      isDraft: true,
      author: {
        id: "user-1",
        username: "u1",
        displayName: null,
        avatarUrl: null,
      },
    });

    const response = await putInsight(
      putRequest("http://localhost/api/insights/u1/s1", {
        isDraft: true,
        title: "Renamed",
      }),
      { params: paramsPromise({ username: "u1", slug: "s1" }) },
    );
    expect(response.status).toBe(200);

    const updateCall = mockPrisma.insightReport.update.mock.calls[0]?.[0];
    // Other allowed fields still pass through (`title`).
    expect(updateCall?.data?.title).toBe("Renamed");
    // But the no-op `isDraft` is stripped to keep updatedAt clean.
    expect(updateCall?.data).not.toHaveProperty("isDraft");
  });
});
