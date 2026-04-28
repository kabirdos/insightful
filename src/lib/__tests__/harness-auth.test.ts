import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    harnessToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/harness-tokens", async () => {
  const actual =
    await vi.importActual<typeof import("../harness-tokens")>(
      "../harness-tokens",
    );
  return {
    ...actual,
    verifyToken: vi.fn(),
  };
});

import { authenticateRequest } from "../harness-auth";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { verifyToken } from "@/lib/harness-tokens";

const mockPrisma = prisma as unknown as {
  user: { findUnique: Mock };
};
const mockAuth = auth as unknown as Mock;
const mockVerifyToken = verifyToken as unknown as Mock;

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authenticateRequest", () => {
  it("returns viaToken: true when a valid bearer token verifies", async () => {
    const selector = "a".repeat(12);
    const raw = `ih_${selector}${"b".repeat(64)}`;
    mockVerifyToken.mockResolvedValue({
      userId: "user-1",
      tokenId: "token-1",
      selector,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "alice",
    });

    const result = await authenticateRequest(
      reqWith({ authorization: `Bearer ${raw}` }),
    );

    expect(result).toEqual({
      userId: "user-1",
      username: "alice",
      viaToken: true,
      tokenSelector: selector,
    });
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("falls through to session when no bearer header is present", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "alice",
    });

    const result = await authenticateRequest(reqWith({}));

    expect(result).toEqual({
      userId: "user-1",
      username: "alice",
      viaToken: false,
    });
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("falls through to session when bearer header is malformed (wrong prefix)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "alice",
    });

    const result = await authenticateRequest(
      reqWith({ authorization: `Bearer xx_${"a".repeat(76)}` }),
    );

    expect(result?.viaToken).toBe(false);
    // Format-validation must reject before any DB call to verifyToken.
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("falls through to session when bearer is wrong length", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "alice",
    });

    const result = await authenticateRequest(
      reqWith({ authorization: `Bearer ih_${"a".repeat(75)}` }),
    );

    expect(result?.viaToken).toBe(false);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("falls through to session when bearer contains non-hex characters", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "alice",
    });

    const result = await authenticateRequest(
      reqWith({ authorization: `Bearer ih_${"g".repeat(76)}` }),
    );

    expect(result?.viaToken).toBe(false);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("returns the session identity when bearer fails verification but session is valid", async () => {
    const raw = `ih_${"a".repeat(76)}`;
    mockVerifyToken.mockResolvedValue(null);
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      username: "alice",
    });

    const result = await authenticateRequest(
      reqWith({ authorization: `Bearer ${raw}` }),
    );

    expect(result).toEqual({
      userId: "user-1",
      username: "alice",
      viaToken: false,
    });
  });

  it("returns null when neither bearer nor session authenticates", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await authenticateRequest(reqWith({}));

    expect(result).toBeNull();
  });
});
