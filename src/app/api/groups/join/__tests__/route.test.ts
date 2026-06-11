/**
 * Tests for POST/GET /api/groups/join (group sharing, plan D5).
 *
 * prisma + auth mocked. POST: happy join, already-member (no count
 * bump), expired/revoked 410, invalid 404. GET preview: valid/invalid
 * both 200 with a `valid` flag.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    groupInvite: { findUnique: vi.fn(), update: vi.fn() },
    groupMember: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { POST as joinPOST, GET as joinGET } from "../route";

const mockAuth = auth as unknown as Mock;
const mockPrisma = prisma as unknown as {
  groupInvite: { findUnique: Mock; update: Mock };
  groupMember: { findUnique: Mock; create: Mock };
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

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/groups/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const activeInvite = {
  id: "inv1",
  revokedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
  group: { id: "g1", slug: "hyperzen", name: "HyperZen" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/groups/join", () => {
  it("returns 401 when unauthenticated", async () => {
    setSession(null);
    const res = await joinPOST(postRequest({ token: "t" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when token is missing", async () => {
    setSession("user-1");
    const res = await joinPOST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown token", async () => {
    setSession("user-1");
    mockPrisma.groupInvite.findUnique.mockResolvedValue(null);
    const res = await joinPOST(postRequest({ token: "nope" }));
    expect(res.status).toBe(404);
  });

  it("returns 410 for a revoked invite", async () => {
    setSession("user-1");
    mockPrisma.groupInvite.findUnique.mockResolvedValue({
      ...activeInvite,
      revokedAt: new Date(),
    });
    const res = await joinPOST(postRequest({ token: "t" }));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/expired or revoked/i);
  });

  it("returns 410 for an expired invite", async () => {
    setSession("user-1");
    mockPrisma.groupInvite.findUnique.mockResolvedValue({
      ...activeInvite,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await joinPOST(postRequest({ token: "t" }));
    expect(res.status).toBe(410);
  });

  it("joins a new member, increments usedCount, returns alreadyMember:false", async () => {
    setSession("user-1");
    wireTransaction();
    mockPrisma.groupInvite.findUnique.mockResolvedValue(activeInvite);
    mockPrisma.groupMember.findUnique.mockResolvedValue(null);
    mockPrisma.groupMember.create.mockResolvedValue({ id: "m1" });
    mockPrisma.groupInvite.update.mockResolvedValue({});

    const res = await joinPOST(postRequest({ token: "t" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyMember).toBe(false);
    expect(body.group.slug).toBe("hyperzen");
    expect(mockPrisma.groupMember.create).toHaveBeenCalledTimes(1);
    const updateArgs = mockPrisma.groupInvite.update.mock.calls[0][0];
    expect(updateArgs.data.usedCount).toEqual({ increment: 1 });
  });

  it("returns alreadyMember:true without bumping usedCount when already in", async () => {
    setSession("user-1");
    mockPrisma.groupInvite.findUnique.mockResolvedValue(activeInvite);
    mockPrisma.groupMember.findUnique.mockResolvedValue({ id: "m-existing" });

    const res = await joinPOST(postRequest({ token: "t" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyMember).toBe(true);
    expect(mockPrisma.groupMember.create).not.toHaveBeenCalled();
    expect(mockPrisma.groupInvite.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/groups/join?token=", () => {
  it("returns valid:false with no token param", async () => {
    const res = await joinGET(new Request("http://localhost/api/groups/join"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it("returns valid:false for an unknown/expired token (no existence leak)", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue(null);
    const res = await joinGET(
      new Request("http://localhost/api/groups/join?token=nope"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
  });

  it("returns the group name + member count for a valid token", async () => {
    mockPrisma.groupInvite.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      group: { name: "HyperZen", _count: { members: 4 } },
    });
    const res = await joinGET(
      new Request("http://localhost/api/groups/join?token=good"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.group.name).toBe("HyperZen");
    expect(body.group.memberCount).toBe(4);
  });
});
