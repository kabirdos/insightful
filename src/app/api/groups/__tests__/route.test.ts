/**
 * Tests for POST/GET /api/groups (group sharing).
 *
 * Prisma + auth are mocked at the module level, matching the pattern in
 * src/app/api/insights/__tests__/route.test.ts. The $transaction mock
 * runs its callback against the same prisma.* mocks so create + member
 * assertions read off either entry point.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    group: {
      create: vi.fn(),
    },
    groupMember: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { POST as groupsPOST, GET as groupsGET } from "../route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  group: { create: Mock };
  groupMember: { create: Mock; findMany: Mock };
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

function postRequest(body: unknown, options: { raw?: string } = {}): Request {
  return new Request("http://localhost/api/groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: options.raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/groups", () => {
  it("returns 401 when unauthenticated", async () => {
    setSession(null);
    const res = await groupsPOST(postRequest({ name: "HyperZen" }));
    expect(res.status).toBe(401);
  });

  it("creates the group and an owner member, returns 201", async () => {
    setSession("user-1");
    wireTransaction();
    mockPrisma.group.create.mockResolvedValue({
      id: "g1",
      slug: "hyperzen",
      name: "HyperZen",
    });
    mockPrisma.groupMember.create.mockResolvedValue({ id: "m1" });

    const res = await groupsPOST(postRequest({ name: "HyperZen" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.group.slug).toBe("hyperzen");

    // Slug derived from the name; creator inserted as owner.
    const createArgs = mockPrisma.group.create.mock.calls[0][0];
    expect(createArgs.data.slug).toBe("hyperzen");
    expect(createArgs.data.createdById).toBe("user-1");
    const memberArgs = mockPrisma.groupMember.create.mock.calls[0][0];
    expect(memberArgs.data.userId).toBe("user-1");
    expect(memberArgs.data.role).toBe("owner");
  });

  it("honors an explicit slug, lowercased", async () => {
    setSession("user-1");
    wireTransaction();
    mockPrisma.group.create.mockResolvedValue({ id: "g1", slug: "team-zen" });
    mockPrisma.groupMember.create.mockResolvedValue({ id: "m1" });

    await groupsPOST(postRequest({ name: "Whatever", slug: "Team-Zen" }));
    const createArgs = mockPrisma.group.create.mock.calls[0][0];
    expect(createArgs.data.slug).toBe("team-zen");
  });

  it("returns 400 for a reserved slug", async () => {
    setSession("user-1");
    const res = await groupsPOST(postRequest({ name: "Join", slug: "join" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/reserved/i);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid slug (too short)", async () => {
    setSession("user-1");
    const res = await groupsPOST(postRequest({ name: "X", slug: "ab" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid slug/i);
  });

  it("returns 400 for a blank name", async () => {
    setSession("user-1");
    const res = await groupsPOST(postRequest({ name: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a missing name", async () => {
    setSession("user-1");
    const res = await groupsPOST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a name over 60 chars", async () => {
    setSession("user-1");
    const res = await groupsPOST(postRequest({ name: "a".repeat(61) }));
    expect(res.status).toBe(400);
  });

  it("returns 409 on slug collision (P2002)", async () => {
    setSession("user-1");
    wireTransaction();
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "6.0.0" },
    );
    mockPrisma.group.create.mockRejectedValueOnce(p2002);

    const res = await groupsPOST(postRequest({ name: "HyperZen" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already taken/i);
  });
});

describe("GET /api/groups", () => {
  it("returns 401 when unauthenticated", async () => {
    setSession(null);
    const res = await groupsGET();
    expect(res.status).toBe(401);
  });

  it("lists the caller's groups with member count and role", async () => {
    setSession("user-1");
    mockPrisma.groupMember.findMany.mockResolvedValue([
      {
        role: "owner",
        group: {
          id: "g1",
          slug: "hyperzen",
          name: "HyperZen",
          description: null,
          createdAt: new Date("2026-06-10T00:00:00Z"),
          _count: { members: 4 },
        },
      },
    ]);

    const res = await groupsGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0]).toMatchObject({
      slug: "hyperzen",
      memberCount: 4,
      role: "owner",
    });
  });
});
