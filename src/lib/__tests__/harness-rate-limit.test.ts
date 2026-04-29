import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    harnessUpload: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    harnessToken: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  checkMintRateLimit,
  checkUploadRateLimit,
  MINT_CAP,
  UPLOAD_ATTEMPT_CAP,
  UPLOAD_SUCCESS_CAP,
} from "../harness-rate-limit";

const mockPrisma = prisma as unknown as {
  harnessUpload: { count: Mock; findFirst: Mock };
  harnessToken: { count: Mock; findFirst: Mock };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkUploadRateLimit", () => {
  it("returns ok when the user has 0 uploads in the last 24h", async () => {
    mockPrisma.harnessUpload.count.mockResolvedValue(0);
    const result = await checkUploadRateLimit("user-1");
    expect(result).toEqual({ ok: true });
  });

  it("returns 429 with uploads_24h on the (cap)+1th successful upload", async () => {
    // First call: success count (>= 20). Second call: attempt count.
    mockPrisma.harnessUpload.count
      .mockResolvedValueOnce(UPLOAD_SUCCESS_CAP)
      .mockResolvedValueOnce(UPLOAD_SUCCESS_CAP);
    mockPrisma.harnessUpload.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
    });
    const result = await checkUploadRateLimit("user-1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected blocked");
    expect(result.reason).toBe("uploads_24h");
    expect(result.retryAfter).toBeGreaterThan(0);
    // Oldest row was 1h ago → retry in ~23h.
    expect(result.retryAfter).toBeLessThanOrEqual(24 * 60 * 60);
    expect(result.retryAfter).toBeGreaterThan(22 * 60 * 60);
  });

  it("returns 429 with attempts_24h when only the attempt cap is hit", async () => {
    // 10 successes (under cap) but 60 total attempts (at cap).
    mockPrisma.harnessUpload.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(UPLOAD_ATTEMPT_CAP);
    mockPrisma.harnessUpload.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const result = await checkUploadRateLimit("user-1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected blocked");
    expect(result.reason).toBe("attempts_24h");
  });

  it("does not count an upload that is older than the 24h window", async () => {
    // 0 in window means we never reach the cap branches.
    mockPrisma.harnessUpload.count.mockResolvedValue(0);
    const result = await checkUploadRateLimit("user-1");
    expect(result).toEqual({ ok: true });

    // Verify the queries actually used a 24h cutoff.
    const callArg = mockPrisma.harnessUpload.count.mock.calls[0][0] as {
      where: { createdAt: { gt: Date } };
    };
    const cutoff = callArg.where.createdAt.gt;
    const cutoffAge = Date.now() - cutoff.getTime();
    expect(cutoffAge).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(cutoffAge).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });
});

describe("checkMintRateLimit", () => {
  it("returns ok when the user has 0 mints in the last 24h", async () => {
    mockPrisma.harnessToken.count.mockResolvedValue(0);
    const result = await checkMintRateLimit("user-1");
    expect(result).toEqual({ ok: true });
  });

  it("returns 429 with mints_24h on the (cap)+1th mint", async () => {
    mockPrisma.harnessToken.count.mockResolvedValue(MINT_CAP);
    mockPrisma.harnessToken.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30m ago
    });
    const result = await checkMintRateLimit("user-1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected blocked");
    expect(result.reason).toBe("mints_24h");
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("counts revoked tokens against the mint cap", async () => {
    // The query should NOT filter on revokedAt — verify by inspecting
    // the where clause does not narrow it.
    mockPrisma.harnessToken.count.mockResolvedValue(MINT_CAP);
    mockPrisma.harnessToken.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 1000),
    });
    await checkMintRateLimit("user-1");
    const callArg = mockPrisma.harnessToken.count.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArg.where).not.toHaveProperty("revokedAt");
  });
});
