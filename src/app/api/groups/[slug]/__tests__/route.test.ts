/**
 * Tests for GET /api/groups/[slug] (group detail, plan D6).
 *
 * group-auth is mocked so membership is controlled directly; prisma is
 * mocked for the group + per-member latest-report reads. The
 * reportVisibilityClause is exercised in its own unit suite — here we
 * assert the route wires it into the per-member findFirst.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    insightReport: { findFirst: vi.fn() },
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
import { GET as groupGET } from "../route";

const mockAuth = auth as unknown as Mock;
const mockMembership = getGroupMembership as unknown as Mock;
const mockPrisma = prisma as unknown as {
  group: { findUnique: Mock };
  insightReport: { findFirst: Mock };
};

function setSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function getRequest(): Request {
  return new Request("http://localhost/api/groups/hyperzen");
}

function callGET() {
  return groupGET(getRequest(), {
    params: Promise.resolve({ slug: "hyperzen" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/groups/[slug]", () => {
  it("returns 404 for anonymous callers (no existence leak)", async () => {
    setSession(null);
    const res = await callGET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Group not found");
    // Never reached the membership/db layer.
    expect(mockMembership).not.toHaveBeenCalled();
  });

  it("returns 404 for a non-member (no existence leak)", async () => {
    setSession("user-2");
    mockMembership.mockResolvedValue(null);
    const res = await callGET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Group not found");
  });

  it("returns members with their viewer-visible latest report", async () => {
    setSession("user-1");
    mockMembership.mockResolvedValue({
      id: "m1",
      groupId: "g1",
      userId: "user-1",
      role: "owner",
    });
    mockPrisma.group.findUnique.mockResolvedValue({
      slug: "hyperzen",
      name: "HyperZen",
      description: "elite",
      createdAt: new Date("2026-06-10T00:00:00Z"),
      _count: { members: 2 },
      members: [
        {
          userId: "user-1",
          role: "owner",
          joinedAt: new Date("2026-06-10T00:00:00Z"),
          user: { username: "craig", displayName: "Craig", avatarUrl: null },
        },
        {
          userId: "user-3",
          role: "member",
          joinedAt: new Date("2026-06-11T00:00:00Z"),
          user: { username: "dana", displayName: "Dana", avatarUrl: null },
        },
      ],
    });
    mockPrisma.insightReport.findFirst
      .mockResolvedValueOnce({ slug: "rpt-craig", title: "Craig's report" })
      .mockResolvedValueOnce(null);

    const res = await callGET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.group.slug).toBe("hyperzen");
    expect(body.group.memberCount).toBe(2);
    expect(body.viewerRole).toBe("owner");
    expect(body.members).toHaveLength(2);
    expect(body.members[0].username).toBe("craig");
    expect(body.members[0].latestReport.slug).toBe("rpt-craig");
    // Member with no visible report → null, not omitted.
    expect(body.members[1].username).toBe("dana");
    expect(body.members[1].latestReport).toBeNull();

    // Each per-member query AND-composes the visibility clause with the
    // member's authorId.
    const firstArgs = mockPrisma.insightReport.findFirst.mock.calls[0][0];
    expect(firstArgs.where.AND[0]).toEqual({ authorId: "user-1" });
    expect(firstArgs.orderBy).toEqual({ publishedAt: "desc" });
  });
});
