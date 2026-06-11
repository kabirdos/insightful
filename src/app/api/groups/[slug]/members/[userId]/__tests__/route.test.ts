/**
 * Tests for DELETE /api/groups/[slug]/members/[userId] (group sharing,
 * plan D4).
 *
 * group-auth membership mocked for the caller; prisma.groupMember mocked
 * for the target lookup, owner-count, and delete. Covers: self-leave,
 * owner removing a member, non-owner removing another (403), and the
 * sole-owner-leave guard (400).
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    groupMember: {
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    reportGroupShare: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/group-auth", () => ({
  getGroupMembership: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGroupMembership } from "@/lib/group-auth";
import { DELETE as memberDELETE } from "../route";

const mockAuth = auth as unknown as Mock;
const mockMembership = getGroupMembership as unknown as Mock;
const mockPrisma = prisma as unknown as {
  groupMember: { findUnique: Mock; count: Mock; delete: Mock };
  reportGroupShare: { deleteMany: Mock };
  $transaction: Mock;
};

function setSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function callDELETE(targetUserId: string) {
  return memberDELETE(
    new Request(
      `http://localhost/api/groups/hyperzen/members/${targetUserId}`,
      { method: "DELETE" },
    ),
    { params: Promise.resolve({ slug: "hyperzen", userId: targetUserId }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/groups/[slug]/members/[userId]", () => {
  it("returns 401 when unauthenticated", async () => {
    setSession(null);
    const res = await callDELETE("user-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the caller is not a member", async () => {
    setSession("user-9");
    mockMembership.mockResolvedValue(null);
    const res = await callDELETE("user-3");
    expect(res.status).toBe(404);
  });

  it("lets a member leave (self-remove) → ok", async () => {
    setSession("user-2");
    mockMembership.mockResolvedValue({
      id: "m2",
      groupId: "g1",
      userId: "user-2",
      role: "member",
    });
    mockPrisma.groupMember.findUnique.mockResolvedValue({
      id: "m2",
      role: "member",
    });
    mockPrisma.groupMember.delete.mockResolvedValue({});

    const res = await callDELETE("user-2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockPrisma.groupMember.delete).toHaveBeenCalledTimes(1);
    // Leaving also retracts the member's report shares into this group.
    expect(mockPrisma.reportGroupShare.deleteMany).toHaveBeenCalledWith({
      where: { groupId: "g1", report: { authorId: "user-2" } },
    });
  });

  it("lets an owner remove another member → ok", async () => {
    setSession("user-1");
    mockMembership.mockResolvedValue({
      id: "m1",
      groupId: "g1",
      userId: "user-1",
      role: "owner",
    });
    mockPrisma.groupMember.findUnique.mockResolvedValue({
      id: "m3",
      role: "member",
    });
    mockPrisma.groupMember.delete.mockResolvedValue({});

    const res = await callDELETE("user-3");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockPrisma.reportGroupShare.deleteMany).toHaveBeenCalledWith({
      where: { groupId: "g1", report: { authorId: "user-3" } },
    });
  });

  it("returns 403 when a non-owner tries to remove someone else", async () => {
    setSession("user-2");
    mockMembership.mockResolvedValue({
      id: "m2",
      groupId: "g1",
      userId: "user-2",
      role: "member",
    });

    const res = await callDELETE("user-3");
    expect(res.status).toBe(403);
    expect(mockPrisma.groupMember.delete).not.toHaveBeenCalled();
  });

  it("returns 400 when the sole owner tries to leave", async () => {
    setSession("user-1");
    mockMembership.mockResolvedValue({
      id: "m1",
      groupId: "g1",
      userId: "user-1",
      role: "owner",
    });
    mockPrisma.groupMember.findUnique.mockResolvedValue({
      id: "m1",
      role: "owner",
    });
    mockPrisma.groupMember.count.mockResolvedValue(1);

    const res = await callDELETE("user-1");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/transfer ownership/i);
    expect(mockPrisma.groupMember.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the target is not a member of the group", async () => {
    setSession("user-1");
    mockMembership.mockResolvedValue({
      id: "m1",
      groupId: "g1",
      userId: "user-1",
      role: "owner",
    });
    mockPrisma.groupMember.findUnique.mockResolvedValue(null);

    const res = await callDELETE("ghost");
    expect(res.status).toBe(404);
  });
});
