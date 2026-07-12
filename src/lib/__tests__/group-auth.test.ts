/**
 * Unit tests for src/lib/group-auth.ts — the authorization layer that
 * gates every group read/owner check.
 *
 * Two concerns under test:
 *   1. Pure slug helpers (isValidGroupSlug / isReservedGroupSlug /
 *      slugifyGroupName) — shape, reserved collisions, length bounds,
 *      unicode stripping.
 *   2. DB-backed membership resolution (getGroupMembership /
 *      requireGroupOwner) — member vs non-member vs owner vs missing
 *      group, id-vs-slug refs, and the "don't leak existence" contract
 *      where non-membership and non-existence both resolve to null.
 *
 * Prisma is mocked (no test DB); the helpers' branching is driven by
 * controlling group.findUnique (slug→id resolution) and
 * groupMember.findUnique (the membership lookup).
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    groupMember: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  GROUP_RESERVED_SLUGS,
  GROUP_SLUG_MAX_LENGTH,
  GROUP_SLUG_MIN_LENGTH,
  getGroupMembership,
  isReservedGroupSlug,
  isValidGroupSlug,
  requireGroupOwner,
  slugifyGroupName,
} from "../group-auth";

const mockPrisma = prisma as unknown as {
  group: { findUnique: Mock };
  groupMember: { findUnique: Mock };
};

function ownerRow(groupId = "g1", userId = "user-1") {
  return { id: "m1", groupId, userId, role: "owner" };
}

function memberRow(groupId = "g1", userId = "user-1") {
  return { id: "m2", groupId, userId, role: "member" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Pure slug helpers ───────────────────────────────────────────────

describe("isValidGroupSlug", () => {
  it("accepts a lowercase alnum slug with single-dash separators", () => {
    expect(isValidGroupSlug("my-group")).toBe(true);
    expect(isValidGroupSlug("team-42")).toBe(true);
    expect(isValidGroupSlug("abc")).toBe(true);
  });

  it("rejects slugs shorter than the min length", () => {
    expect(isValidGroupSlug("ab")).toBe(false);
    expect(isValidGroupSlug("a".repeat(GROUP_SLUG_MIN_LENGTH - 1))).toBe(false);
    // Exactly the min length is allowed.
    expect(isValidGroupSlug("a".repeat(GROUP_SLUG_MIN_LENGTH))).toBe(true);
  });

  it("rejects slugs longer than the max length", () => {
    expect(isValidGroupSlug("a".repeat(GROUP_SLUG_MAX_LENGTH + 1))).toBe(false);
    // Exactly the max length is allowed.
    expect(isValidGroupSlug("a".repeat(GROUP_SLUG_MAX_LENGTH))).toBe(true);
  });

  it("rejects uppercase, leading/trailing dashes, and double dashes", () => {
    expect(isValidGroupSlug("MyGroup")).toBe(false);
    expect(isValidGroupSlug("-lead")).toBe(false);
    expect(isValidGroupSlug("trail-")).toBe(false);
    expect(isValidGroupSlug("a--b")).toBe(false);
    expect(isValidGroupSlug("has space")).toBe(false);
  });
});

describe("isReservedGroupSlug", () => {
  it("flags reserved slugs case-insensitively", () => {
    expect(isReservedGroupSlug("join")).toBe(true);
    expect(isReservedGroupSlug("JOIN")).toBe(true);
    expect(isReservedGroupSlug("Invite")).toBe(true);
    // Every documented reserved slug is flagged.
    for (const reserved of GROUP_RESERVED_SLUGS) {
      expect(isReservedGroupSlug(reserved)).toBe(true);
    }
  });

  it("does not flag ordinary slugs or the empty string", () => {
    expect(isReservedGroupSlug("myteam")).toBe(false);
    expect(isReservedGroupSlug("")).toBe(false);
  });
});

describe("slugifyGroupName", () => {
  it("lowercases and dashes word boundaries", () => {
    expect(slugifyGroupName("Hello World")).toBe("hello-world");
    expect(slugifyGroupName("HyperZen Elite")).toBe("hyperzen-elite");
  });

  it("collapses runs of separators into a single dash", () => {
    expect(slugifyGroupName("a b  c")).toBe("a-b-c");
    expect(slugifyGroupName("a___b")).toBe("a-b");
  });

  it("trims leading and trailing separators", () => {
    expect(slugifyGroupName("  Trim Me  ")).toBe("trim-me");
    expect(slugifyGroupName("---leading")).toBe("leading");
    expect(slugifyGroupName("trailing---")).toBe("trailing");
  });

  it("strips unicode/accented characters that aren't [a-z0-9]", () => {
    // Accented chars are non-[a-z0-9] and become dash runs, then trim.
    expect(slugifyGroupName("Café")).toBe("caf");
    expect(slugifyGroupName("Café Über")).toBe("caf-ber");
  });

  it("returns an empty string when the name has no alnum characters", () => {
    // Documented failure mode — caller must still run isValidGroupSlug.
    expect(slugifyGroupName("☃☃☃")).toBe("");
    expect(slugifyGroupName("!!!")).toBe("");
    expect(isValidGroupSlug(slugifyGroupName("☃☃☃"))).toBe(false);
  });

  it("does NOT truncate an over-length name (length left to validation)", () => {
    const longName = "x".repeat(GROUP_SLUG_MAX_LENGTH + 10);
    const slug = slugifyGroupName(longName);
    expect(slug.length).toBe(GROUP_SLUG_MAX_LENGTH + 10);
    // The derived slug is returned as-is but fails validation.
    expect(isValidGroupSlug(slug)).toBe(false);
  });
});

// ── getGroupMembership ──────────────────────────────────────────────

describe("getGroupMembership", () => {
  it("resolves a slug ref to a group id, then returns the membership row", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: "g1" });
    mockPrisma.groupMember.findUnique.mockResolvedValue(memberRow());

    const result = await getGroupMembership("hyperzen", "user-1");

    expect(result).toEqual(memberRow());
    // A bare string ref is treated as a slug and resolved via group lookup.
    expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({
      where: { slug: "hyperzen" },
      select: { id: true },
    });
    expect(mockPrisma.groupMember.findUnique).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: "g1", userId: "user-1" } },
      select: { id: true, groupId: true, userId: true, role: true },
    });
  });

  it("returns null and skips the membership lookup when the slug has no group", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const result = await getGroupMembership("ghost", "user-1");

    expect(result).toBeNull();
    // Non-existence must not fall through to a membership query.
    expect(mockPrisma.groupMember.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for a non-member of an existing group (no existence leak)", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: "g1" });
    mockPrisma.groupMember.findUnique.mockResolvedValue(null);

    const result = await getGroupMembership("hyperzen", "user-9");

    // Non-membership and non-existence are deliberately indistinguishable.
    expect(result).toBeNull();
  });

  it("uses the id directly (no slug resolution) for an id ref", async () => {
    mockPrisma.groupMember.findUnique.mockResolvedValue(memberRow("g7"));

    const result = await getGroupMembership(
      { by: "id", value: "g7" },
      "user-1",
    );

    expect(result).toEqual(memberRow("g7"));
    // id refs skip the slug→id lookup entirely.
    expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.groupMember.findUnique).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: "g7", userId: "user-1" } },
      select: { id: true, groupId: true, userId: true, role: true },
    });
  });

  it("defaults an object ref without `by` to slug resolution", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: "g1" });
    mockPrisma.groupMember.findUnique.mockResolvedValue(memberRow());

    await getGroupMembership({ value: "hyperzen" }, "user-1");

    expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({
      where: { slug: "hyperzen" },
      select: { id: true },
    });
  });
});

// ── requireGroupOwner ───────────────────────────────────────────────

describe("requireGroupOwner", () => {
  it("returns the membership row when the caller is the owner", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: "g1" });
    mockPrisma.groupMember.findUnique.mockResolvedValue(ownerRow());

    const result = await requireGroupOwner("hyperzen", "user-1");

    expect(result).toEqual(ownerRow());
  });

  it("returns null when the caller is a member but not the owner", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: "g1" });
    mockPrisma.groupMember.findUnique.mockResolvedValue(memberRow());

    const result = await requireGroupOwner("hyperzen", "user-1");

    // A non-owner member is denied owner-scoped actions.
    expect(result).toBeNull();
  });

  it("returns null when the caller is not a member", async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: "g1" });
    mockPrisma.groupMember.findUnique.mockResolvedValue(null);

    const result = await requireGroupOwner("hyperzen", "user-9");

    expect(result).toBeNull();
  });

  it("returns null when the group does not exist", async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);

    const result = await requireGroupOwner("ghost", "user-1");

    expect(result).toBeNull();
    expect(mockPrisma.groupMember.findUnique).not.toHaveBeenCalled();
  });
});
