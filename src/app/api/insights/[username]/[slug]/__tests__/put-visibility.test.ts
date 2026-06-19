/**
 * Tests for the group-sharing extension to PUT /api/insights/[username]/[slug].
 *
 * Scope is limited to the new `visibility` + `groupIds` handling:
 *   - valid visibility change persists,
 *   - groupIds for a group the author isn't in → 400,
 *   - invalid visibility value → 400,
 *   - groupIds replace the report's ReportGroupShare rows in a tx.
 *
 * prisma + auth mocked like src/app/api/insights/__tests__/route.test.ts.
 * The $transaction mock runs its callback against the prisma.* mocks.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    insightReport: { findFirst: vi.fn(), update: vi.fn() },
    groupMember: { findMany: vi.fn() },
    reportGroupShare: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PUT as insightPUT } from "../route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  insightReport: { findFirst: Mock; update: Mock };
  groupMember: { findMany: Mock };
  reportGroupShare: { deleteMany: Mock; createMany: Mock };
  $transaction: Mock;
};

function setSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function wireTransaction() {
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
  );
}

function putRequest(body: unknown): Request {
  return new Request("http://localhost/api/insights/craig/rpt-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = {
  params: Promise.resolve({ username: "craig", slug: "rpt-1" }),
};

/** Seed an owned, public, non-draft report for the author user-1. */
function seedOwnedReport(visibility = "public") {
  mockPrisma.insightReport.findFirst.mockResolvedValue({
    id: "rpt-1",
    authorId: "user-1",
    isDraft: false,
    visibility,
  });
  mockPrisma.insightReport.update.mockResolvedValue({
    id: "rpt-1",
    slug: "rpt-1",
    author: { id: "user-1", username: "craig" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PUT /api/insights/[username]/[slug] — visibility", () => {
  it("persists a valid visibility change to private", async () => {
    setSession("user-1");
    wireTransaction();
    seedOwnedReport("public");

    const res = await insightPUT(putRequest({ visibility: "private" }), params);
    expect(res.status).toBe(200);
    const updateArgs = mockPrisma.insightReport.update.mock.calls[0][0];
    expect(updateArgs.data.visibility).toBe("private");
    // No groupIds → shares untouched.
    expect(mockPrisma.reportGroupShare.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid visibility value", async () => {
    setSession("user-1");
    wireTransaction();
    seedOwnedReport("public");

    const res = await insightPUT(putRequest({ visibility: "secret" }), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/visibility/i);
    expect(mockPrisma.insightReport.update).not.toHaveBeenCalled();
  });

  it("returns 400 when groupIds include a group the author isn't in", async () => {
    setSession("user-1");
    wireTransaction();
    seedOwnedReport("public");
    // Author belongs only to g1; g2 is foreign.
    mockPrisma.groupMember.findMany.mockResolvedValue([{ groupId: "g1" }]);

    const res = await insightPUT(
      putRequest({ visibility: "group", groupIds: ["g1", "g2"] }),
      params,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not a member/i);
    expect(mockPrisma.insightReport.update).not.toHaveBeenCalled();
  });

  it("replaces shares when visibility:group + valid groupIds", async () => {
    setSession("user-1");
    wireTransaction();
    seedOwnedReport("public");
    mockPrisma.groupMember.findMany.mockResolvedValue([
      { groupId: "g1" },
      { groupId: "g2" },
    ]);
    mockPrisma.reportGroupShare.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.reportGroupShare.createMany.mockResolvedValue({ count: 2 });

    const res = await insightPUT(
      putRequest({ visibility: "group", groupIds: ["g1", "g2"] }),
      params,
    );
    expect(res.status).toBe(200);

    expect(mockPrisma.reportGroupShare.deleteMany).toHaveBeenCalledWith({
      where: { reportId: "rpt-1" },
    });
    expect(mockPrisma.reportGroupShare.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          { reportId: "rpt-1", groupId: "g1" },
          { reportId: "rpt-1", groupId: "g2" },
        ],
      }),
    );
  });

  it("returns 400 when groupIds is given but effective visibility isn't group", async () => {
    setSession("user-1");
    wireTransaction();
    seedOwnedReport("public");

    const res = await insightPUT(putRequest({ groupIds: ["g1"] }), params);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/visibility is "group"/i);
  });

  it("allows groupIds without visibility when the report is already group", async () => {
    setSession("user-1");
    wireTransaction();
    seedOwnedReport("group");
    mockPrisma.groupMember.findMany.mockResolvedValue([{ groupId: "g1" }]);
    mockPrisma.reportGroupShare.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.reportGroupShare.createMany.mockResolvedValue({ count: 1 });

    const res = await insightPUT(putRequest({ groupIds: ["g1"] }), params);
    expect(res.status).toBe(200);
    expect(mockPrisma.reportGroupShare.createMany).toHaveBeenCalled();
  });
});
