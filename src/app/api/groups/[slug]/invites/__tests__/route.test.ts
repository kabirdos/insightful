/**
 * Tests for POST/GET /api/groups/[slug]/invites and DELETE
 * /api/groups/[slug]/invites/[id] (group sharing, plan D5).
 *
 * group-auth membership is mocked; prisma.groupInvite is mocked for the
 * create/find/update calls. Focus: owner-only gating (non-owner 403,
 * non-member 404), token shape, and revoke semantics.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    groupInvite: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
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
import { POST as invitesPOST, GET as invitesGET } from "../route";
import { DELETE as inviteDELETE } from "../[id]/route";

const mockAuth = auth as unknown as Mock;
const mockMembership = getGroupMembership as unknown as Mock;
const mockPrisma = prisma as unknown as {
  groupInvite: {
    create: Mock;
    findMany: Mock;
    updateMany: Mock;
    findFirst: Mock;
  };
};

function setSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

function asOwner() {
  mockMembership.mockResolvedValue({
    id: "m1",
    groupId: "g1",
    userId: "user-1",
    role: "owner",
  });
}

function asMember() {
  mockMembership.mockResolvedValue({
    id: "m2",
    groupId: "g1",
    userId: "user-2",
    role: "member",
  });
}

function postRequest(body?: unknown): Request {
  return new Request("http://localhost/api/groups/hyperzen/invites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const slugParams = { params: Promise.resolve({ slug: "hyperzen" }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/groups/[slug]/invites", () => {
  it("returns 401 when unauthenticated", async () => {
    setSession(null);
    const res = await invitesPOST(postRequest({}), slugParams);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a non-member", async () => {
    setSession("user-9");
    mockMembership.mockResolvedValue(null);
    const res = await invitesPOST(postRequest({}), slugParams);
    expect(res.status).toBe(404);
  });

  it("returns 403 for a non-owner member", async () => {
    setSession("user-2");
    asMember();
    const res = await invitesPOST(postRequest({}), slugParams);
    expect(res.status).toBe(403);
  });

  it("mints a 32-hex-char invite with a join URL (owner)", async () => {
    setSession("user-1");
    asOwner();
    const expiresAt = new Date("2026-07-10T00:00:00Z");
    mockPrisma.groupInvite.create.mockImplementation(
      async (args: { data: { token: string } }) => ({
        id: "inv1",
        token: args.data.token,
        expiresAt,
      }),
    );

    const res = await invitesPOST(postRequest({}), slugParams);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.invite.token).toMatch(/^[0-9a-f]{32}$/);
    expect(body.invite.url).toContain(`/g/join/${body.invite.token}`);
    expect(body.invite.id).toBe("inv1");
  });

  it("rejects an out-of-range expiresInDays at 400", async () => {
    setSession("user-1");
    asOwner();
    const res = await invitesPOST(
      postRequest({ expiresInDays: 9999 }),
      slugParams,
    );
    expect(res.status).toBe(400);
  });

  it("accepts a bodyless POST (default 30-day expiry)", async () => {
    setSession("user-1");
    asOwner();
    mockPrisma.groupInvite.create.mockResolvedValue({
      id: "inv2",
      token: "a".repeat(32),
      expiresAt: new Date(),
    });
    const res = await invitesPOST(postRequest(), slugParams);
    expect(res.status).toBe(201);
  });
});

describe("GET /api/groups/[slug]/invites", () => {
  it("returns 403 for a non-owner member", async () => {
    setSession("user-2");
    asMember();
    const res = await invitesGET(
      new Request("http://localhost/api/groups/hyperzen/invites"),
      slugParams,
    );
    expect(res.status).toBe(403);
  });

  it("lists active invites for the owner", async () => {
    setSession("user-1");
    asOwner();
    mockPrisma.groupInvite.findMany.mockResolvedValue([
      {
        id: "inv1",
        token: "b".repeat(32),
        expiresAt: new Date("2026-07-10T00:00:00Z"),
        usedCount: 3,
        createdAt: new Date("2026-06-10T00:00:00Z"),
      },
    ]);

    const res = await invitesGET(
      new Request("http://localhost/api/groups/hyperzen/invites"),
      slugParams,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].usedCount).toBe(3);
    expect(body.invites[0].url).toContain("/g/join/");
    // The findMany filters revoked + expired invites.
    const findArgs = mockPrisma.groupInvite.findMany.mock.calls[0][0];
    expect(findArgs.where.revokedAt).toBeNull();
  });
});

describe("DELETE /api/groups/[slug]/invites/[id]", () => {
  const delParams = {
    params: Promise.resolve({ slug: "hyperzen", id: "inv1" }),
  };

  it("returns 403 for a non-owner member", async () => {
    setSession("user-2");
    asMember();
    const res = await inviteDELETE(
      new Request("http://localhost/api/groups/hyperzen/invites/inv1", {
        method: "DELETE",
      }),
      delParams,
    );
    expect(res.status).toBe(403);
  });

  it("revokes the invite (owner) → ok", async () => {
    setSession("user-1");
    asOwner();
    mockPrisma.groupInvite.updateMany.mockResolvedValue({ count: 1 });

    const res = await inviteDELETE(
      new Request("http://localhost/api/groups/hyperzen/invites/inv1", {
        method: "DELETE",
      }),
      delParams,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const updateArgs = mockPrisma.groupInvite.updateMany.mock.calls[0][0];
    expect(updateArgs.where.groupId).toBe("g1");
    expect(updateArgs.data.revokedAt).toBeInstanceOf(Date);
  });

  it("returns 404 when the invite id is not in this group", async () => {
    setSession("user-1");
    asOwner();
    mockPrisma.groupInvite.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.groupInvite.findFirst.mockResolvedValue(null);

    const res = await inviteDELETE(
      new Request("http://localhost/api/groups/hyperzen/invites/inv1", {
        method: "DELETE",
      }),
      delParams,
    );
    expect(res.status).toBe(404);
  });

  it("is idempotent for an already-revoked invite → ok", async () => {
    setSession("user-1");
    asOwner();
    mockPrisma.groupInvite.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.groupInvite.findFirst.mockResolvedValue({ id: "inv1" });

    const res = await inviteDELETE(
      new Request("http://localhost/api/groups/hyperzen/invites/inv1", {
        method: "DELETE",
      }),
      delParams,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
