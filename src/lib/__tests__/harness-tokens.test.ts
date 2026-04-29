import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    harnessToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";
import {
  generateToken,
  hashSecret,
  MINT_CAP_PER_24H,
  MintConflictError,
  MintRateLimitError,
  mintTokenForUser,
  parseToken,
  revokeActiveTokensForUser,
  TOKEN_LENGTH,
  verifyToken,
} from "../harness-tokens";

const mockPrisma = prisma as unknown as {
  harnessToken: {
    findUnique: Mock;
    findFirst: Mock;
    update: Mock;
    updateMany: Mock;
    create: Mock;
    count: Mock;
  };
  $transaction: Mock;
  $executeRaw: Mock;
};

beforeEach(() => {
  vi.clearAllMocks();
  // Wire $transaction to invoke the callback with the same mocked surface.
  mockPrisma.$transaction.mockImplementation(
    async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
  );
  // Default: zero prior mints in the 24h window so the in-tx rate-limit
  // check passes. Tests that exercise the cap override this.
  mockPrisma.harnessToken.count.mockResolvedValue(0);
  // `pg_advisory_xact_lock` is a void SQL call; resolve it as 0 so the
  // helper's await goes through.
  mockPrisma.$executeRaw.mockResolvedValue(0);
});

describe("generateToken", () => {
  it("returns a 79-char string matching /^ih_[0-9a-f]{76}$/", () => {
    for (let i = 0; i < 20; i++) {
      const { raw } = generateToken();
      expect(raw).toMatch(/^ih_[0-9a-f]{76}$/);
      expect(raw.length).toBe(TOKEN_LENGTH);
    }
  });

  it("returns selector and secret components", () => {
    const { raw, selector, secret } = generateToken();
    expect(selector).toMatch(/^[0-9a-f]{12}$/);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(raw).toBe(`ih_${selector}${secret}`);
  });
});

describe("parseToken", () => {
  it("extracts selector and secret from a valid raw token", () => {
    const raw = `ih_${"a".repeat(12)}${"b".repeat(64)}`;
    expect(parseToken(raw)).toEqual({
      selector: "a".repeat(12),
      secret: "b".repeat(64),
    });
  });

  it("returns null for wrong prefix", () => {
    expect(parseToken(`xx_${"a".repeat(76)}`)).toBeNull();
  });

  it("returns null for wrong length", () => {
    expect(parseToken(`ih_${"a".repeat(75)}`)).toBeNull();
    expect(parseToken(`ih_${"a".repeat(77)}`)).toBeNull();
  });

  it("returns null for non-hex characters", () => {
    expect(parseToken(`ih_${"g".repeat(76)}`)).toBeNull();
    expect(parseToken(`ih_${"A".repeat(76)}`)).toBeNull(); // uppercase not allowed
  });
});

describe("hashSecret", () => {
  it("returns a bcrypt hash of the secret", async () => {
    const hash = await hashSecret("secret");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThan(50);
  });
});

describe("mintTokenForUser", () => {
  it("revokes prior active tokens and creates a new one with expiresAt = now + 90d", async () => {
    mockPrisma.harnessToken.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.harnessToken.create.mockResolvedValue({});

    const before = Date.now();
    const { raw, expiresAt } = await mintTokenForUser("user-1");
    const after = Date.now();

    expect(raw).toMatch(/^ih_[0-9a-f]{76}$/);
    // Within 90 days +/- the test wall-clock window.
    const expectedMin = before + 90 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 90 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);

    // Revoke-then-create order matters for R3 invariant.
    expect(mockPrisma.harnessToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(mockPrisma.harnessToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        selector: expect.stringMatching(/^[0-9a-f]{12}$/),
        hashedSecret: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it("throws MintConflictError immediately on P2002 (no retry — would silently revoke the winner)", async () => {
    // Simulate the loser of a concurrent partial-unique race: the
    // winner's row is now visible via the partial unique index, so
    // our `create` trips P2002. We must NOT retry — a retry would
    // re-run `updateMany` against the winner's freshly-created row
    // and silently revoke their token.
    const { Prisma } = await import("@prisma/client");
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`userId`)",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["HarnessToken_userId_active_unique"] },
      },
    );

    mockPrisma.harnessToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.harnessToken.create.mockRejectedValueOnce(p2002);

    await expect(mintTokenForUser("user-1")).rejects.toBeInstanceOf(
      MintConflictError,
    );
    // Single attempt only — no retry.
    expect(mockPrisma.harnessToken.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.harnessToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it("acquires a per-user advisory lock before the in-tx count check", async () => {
    // Without the lock, two concurrent POSTs at count=cap-1 can both
    // read cap-1 under READ COMMITTED and both insert. The lock
    // serializes the critical section by user — verify it's actually
    // requested before the count.
    mockPrisma.harnessToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.harnessToken.create.mockResolvedValue({});

    await mintTokenForUser("user-1");

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    // Vitest's $executeRaw mock receives the tagged-template fragments.
    // Argument 0 is the strings array; argument 1+ are the values. We
    // assert the lock key includes our user-scoped identifier.
    const callArgs = mockPrisma.$executeRaw.mock.calls[0];
    // The first arg is a TemplateStringsArray containing the SQL
    // fragments; the second is the lock-key string.
    expect(String(callArgs[0])).toContain("pg_advisory_xact_lock");
    expect(callArgs[1]).toBe("mint:user-1");
  });

  it("throws MintRateLimitError when the in-transaction count is at cap", async () => {
    // Atomic in-tx check: even if the soft pre-check passed (the route's
    // pre-tx call to checkMintRateLimit), a concurrent burst could have
    // pushed the count to cap by the time this transaction runs. The
    // helper must catch that and surface MintRateLimitError, not silently
    // mint the (cap+1)-th token.
    const oldestRow = {
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
    };
    mockPrisma.harnessToken.count.mockResolvedValue(MINT_CAP_PER_24H);
    mockPrisma.harnessToken.findFirst.mockResolvedValue(oldestRow);

    const thrown = await mintTokenForUser("user-1").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(MintRateLimitError);
    expect((thrown as MintRateLimitError).oldestCreatedAt).toEqual(
      oldestRow.createdAt,
    );
    // Critically: no create call should have been attempted.
    expect(mockPrisma.harnessToken.create).not.toHaveBeenCalled();
    expect(mockPrisma.harnessToken.updateMany).not.toHaveBeenCalled();
  });

  it("rethrows non-active-slot P2002 unchanged (e.g. selector collision)", async () => {
    // A P2002 on the selector key is a separate failure mode (random
    // collision in the selector space). It must NOT be translated to
    // MintConflictError, since the caller's recovery path differs:
    // selector collisions are retryable, active-slot races are not.
    const { Prisma } = await import("@prisma/client");
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`selector`)",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: "HarnessToken_selector_key" },
      },
    );

    mockPrisma.harnessToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.harnessToken.create.mockRejectedValue(p2002);

    const thrown = await mintTokenForUser("user-1").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(thrown).not.toBeInstanceOf(MintConflictError);
    expect((thrown as { code: string }).code).toBe("P2002");
  });
});

describe("revokeActiveTokensForUser", () => {
  it("calls updateMany to set revokedAt on all active tokens", async () => {
    mockPrisma.harnessToken.updateMany.mockResolvedValue({ count: 1 });
    await revokeActiveTokensForUser("user-1");
    expect(mockPrisma.harnessToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
  });
});

describe("verifyToken", () => {
  /**
   * Mint via the real path so the test exercises bcrypt round-trip.
   * Returns the raw token plus the row mockPrisma.findUnique should
   * return.
   */
  async function mintAndCaptureRow(): Promise<{
    raw: string;
    row: {
      id: string;
      userId: string;
      selector: string;
      hashedSecret: string;
      expiresAt: Date;
      lastUsedAt: Date | null;
      revokedAt: Date | null;
    };
  }> {
    let captured: {
      selector: string;
      hashedSecret: string;
      expiresAt: Date;
    } | null = null;
    mockPrisma.harnessToken.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.harnessToken.create.mockImplementation(
      async ({
        data,
      }: {
        data: { selector: string; hashedSecret: string; expiresAt: Date };
      }) => {
        captured = {
          selector: data.selector,
          hashedSecret: data.hashedSecret,
          expiresAt: data.expiresAt,
        };
        return {};
      },
    );
    const { raw } = await mintTokenForUser("user-1");
    if (!captured) throw new Error("mint did not capture row");
    const captured2 = captured as {
      selector: string;
      hashedSecret: string;
      expiresAt: Date;
    };
    return {
      raw,
      row: {
        id: "token-1",
        userId: "user-1",
        selector: captured2.selector,
        hashedSecret: captured2.hashedSecret,
        expiresAt: captured2.expiresAt,
        lastUsedAt: null,
        revokedAt: null,
      },
    };
  }

  it("returns userId and rolls expiresAt + lastUsedAt forward on success", async () => {
    const { raw, row } = await mintAndCaptureRow();
    mockPrisma.harnessToken.findUnique.mockResolvedValue(row);
    mockPrisma.harnessToken.update.mockResolvedValue({});

    const before = Date.now();
    const result = await verifyToken(raw);
    const after = Date.now();

    expect(result).toEqual({
      userId: "user-1",
      tokenId: "token-1",
      selector: row.selector,
    });

    // The update call should set both lastUsedAt and expiresAt to NOW()+90d.
    const updateCall = mockPrisma.harnessToken.update.mock.calls[0][0] as {
      where: { id: string };
      data: { lastUsedAt: Date; expiresAt: Date };
    };
    expect(updateCall.where.id).toBe("token-1");
    expect(updateCall.data.lastUsedAt).toBeInstanceOf(Date);
    expect(updateCall.data.expiresAt).toBeInstanceOf(Date);
    const expectedMin = before + 90 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 90 * 24 * 60 * 60 * 1000;
    expect(updateCall.data.expiresAt.getTime()).toBeGreaterThanOrEqual(
      expectedMin,
    );
    expect(updateCall.data.expiresAt.getTime()).toBeLessThanOrEqual(
      expectedMax,
    );
  });

  it("rolls expiresAt to NOW()+90d regardless of prior value", async () => {
    const { raw, row } = await mintAndCaptureRow();
    // Simulate a token that was about to expire in 2 days.
    row.expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    mockPrisma.harnessToken.findUnique.mockResolvedValue(row);
    mockPrisma.harnessToken.update.mockResolvedValue({});

    await verifyToken(raw);

    const updateCall = mockPrisma.harnessToken.update.mock.calls[0][0] as {
      data: { expiresAt: Date };
    };
    // Should jump back to ~90d, not stay at 2d.
    const minutesUntilExpiry =
      (updateCall.data.expiresAt.getTime() - Date.now()) / (60 * 1000);
    expect(minutesUntilExpiry).toBeGreaterThan(89 * 24 * 60); // > 89d
  });

  it("returns null for a revoked token without updating lastUsedAt", async () => {
    const { raw, row } = await mintAndCaptureRow();
    row.revokedAt = new Date();
    mockPrisma.harnessToken.findUnique.mockResolvedValue(row);

    const result = await verifyToken(raw);
    expect(result).toBeNull();
    expect(mockPrisma.harnessToken.update).not.toHaveBeenCalled();
  });

  it("returns null for an expired token", async () => {
    const { raw, row } = await mintAndCaptureRow();
    row.expiresAt = new Date(Date.now() - 1000);
    mockPrisma.harnessToken.findUnique.mockResolvedValue(row);

    const result = await verifyToken(raw);
    expect(result).toBeNull();
    expect(mockPrisma.harnessToken.update).not.toHaveBeenCalled();
  });

  it("returns null for a malformed token without DB lookup", async () => {
    expect(await verifyToken("nope")).toBeNull();
    expect(await verifyToken(`ih_${"g".repeat(76)}`)).toBeNull();
    expect(await verifyToken(`ih_${"a".repeat(75)}`)).toBeNull();
    expect(mockPrisma.harnessToken.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when selector is unknown", async () => {
    mockPrisma.harnessToken.findUnique.mockResolvedValue(null);
    const result = await verifyToken(`ih_${"a".repeat(76)}`);
    expect(result).toBeNull();
    expect(mockPrisma.harnessToken.update).not.toHaveBeenCalled();
  });

  it("returns null when secret does not match the stored hash", async () => {
    const { row } = await mintAndCaptureRow();
    mockPrisma.harnessToken.findUnique.mockResolvedValue(row);

    // Build a token with the right selector but wrong secret.
    const wrongRaw = `ih_${row.selector}${"f".repeat(64)}`;
    const result = await verifyToken(wrongRaw);
    expect(result).toBeNull();
    expect(mockPrisma.harnessToken.update).not.toHaveBeenCalled();
  });
});
