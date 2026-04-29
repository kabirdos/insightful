import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    harnessUpload: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { findIdempotentResult, withIdempotency } from "../harness-idempotency";

const mockPrisma = prisma as unknown as {
  harnessUpload: {
    findUnique: Mock;
    upsert: Mock;
    update: Mock;
    updateMany: Mock;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findIdempotentResult", () => {
  it("returns null on a fresh (userId, uploadId)", async () => {
    mockPrisma.harnessUpload.findUnique.mockResolvedValue(null);
    const result = await findIdempotentResult("user-1", "upload-1");
    expect(result).toBeNull();
  });

  it("returns null on a row with success=false (prior failure or in-flight)", async () => {
    // A success=false row should NOT short-circuit the upload route —
    // otherwise we'd skip the rate limit AND the actual work, leaving
    // the user permanently stuck on a partial failure (P1.C).
    mockPrisma.harnessUpload.findUnique.mockResolvedValue({
      slug: null,
      success: false,
    });
    const result = await findIdempotentResult("user-1", "upload-1");
    expect(result).toBeNull();
  });

  it("returns { slug } on a prior success", async () => {
    mockPrisma.harnessUpload.findUnique.mockResolvedValue({
      slug: "20260422-abc123",
      success: true,
    });
    const result = await findIdempotentResult("user-1", "upload-1");
    expect(result).toEqual({ slug: "20260422-abc123" });
  });
});

describe("withIdempotency", () => {
  it("first call: claims with success=false, runs work, flips to success=true", async () => {
    // Upsert creates a fresh success=false row. The post-upsert read
    // reflects what we just inserted.
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    mockPrisma.harnessUpload.findUnique.mockResolvedValue({
      slug: null,
      success: false,
    });
    mockPrisma.harnessUpload.updateMany.mockResolvedValue({ count: 1 });

    const work = vi.fn(async () => ({ slug: "new-slug" }));
    const result = await withIdempotency("user-1", "upload-1", work);

    expect(work).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ slug: "new-slug", replayed: false });

    // Claim row inserted with success=false.
    expect(mockPrisma.harnessUpload.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_uploadId: { userId: "user-1", uploadId: "upload-1" } },
        create: expect.objectContaining({
          userId: "user-1",
          uploadId: "upload-1",
          slug: null,
          success: false,
        }),
        update: {},
      }),
    );
    // Then conditionally flipped to success=true with the slug —
    // the WHERE clause guards against clobbering a race winner.
    expect(mockPrisma.harnessUpload.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", uploadId: "upload-1", success: false },
      data: { slug: "new-slug", success: true },
    });
  });

  it("second call after success: skips work, returns replayed: true", async () => {
    // Upsert is a no-op (existing row left as-is). Post-upsert read
    // returns the prior winner's row.
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    mockPrisma.harnessUpload.findUnique.mockResolvedValue({
      slug: "prior-slug",
      success: true,
    });

    const work = vi.fn(async () => ({ slug: "should-not-run" }));
    const result = await withIdempotency("user-1", "upload-1", work);

    expect(work).not.toHaveBeenCalled();
    expect(result).toEqual({ slug: "prior-slug", replayed: true });
    // No UPDATE on a replay — the row already has success=true.
    expect(mockPrisma.harnessUpload.update).not.toHaveBeenCalled();
    expect(mockPrisma.harnessUpload.updateMany).not.toHaveBeenCalled();
  });

  it("retry after prior failure: re-runs work and flips success=false → true (P1.C fix)", async () => {
    // Earlier attempt's work() threw; row stayed at success=false.
    // A new call should re-run work and flip the row, NOT silently
    // leave it stuck at success=false (which was the old upsert
    // `update: {}` bug that broke this case forever).
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    mockPrisma.harnessUpload.findUnique.mockResolvedValue({
      slug: null,
      success: false, // prior failure
    });
    mockPrisma.harnessUpload.updateMany.mockResolvedValue({ count: 1 });

    const work = vi.fn(async () => ({ slug: "retry-slug" }));
    const result = await withIdempotency("user-1", "upload-1", work);

    expect(work).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ slug: "retry-slug", replayed: false });
    expect(mockPrisma.harnessUpload.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", uploadId: "upload-1", success: false },
      data: { slug: "retry-slug", success: true },
    });
  });

  it("work() throws: leaves row at success=false; subsequent retry can recover", async () => {
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    mockPrisma.harnessUpload.findUnique.mockResolvedValue({
      slug: null,
      success: false,
    });
    const work = vi.fn(async () => {
      throw new Error("parse failed");
    });

    await expect(withIdempotency("user-1", "upload-1", work)).rejects.toThrow(
      "parse failed",
    );
    // Crucially, NO update was issued — the row remains success=false
    // so a later retry will see it and run work() again.
    expect(mockPrisma.harnessUpload.update).not.toHaveBeenCalled();
    expect(mockPrisma.harnessUpload.updateMany).not.toHaveBeenCalled();
  });

  it("simulated concurrency: two sequential calls where the second sees a prior success=false row", async () => {
    // Vitest's mocking can't simulate true concurrency, so we model the
    // collapsed-case path: caller B arrives after caller A's claim row
    // exists but before A flipped success=true. B's logic re-runs
    // work() and writes its own slug. (In production this can produce
    // two drafts; the README and the helper docstring document the
    // tradeoff. The common retry-after-network-blip case is caught by
    // findIdempotentResult before this wrapper is invoked.)
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    mockPrisma.harnessUpload.findUnique.mockResolvedValue({
      slug: null,
      success: false, // A's claim row, not yet flipped
    });
    mockPrisma.harnessUpload.updateMany.mockResolvedValue({ count: 1 });

    const work = vi.fn(async () => ({ slug: "B-slug" }));
    const result = await withIdempotency("user-1", "upload-1", work);

    expect(work).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ slug: "B-slug", replayed: false });
  });

  it("concurrent race: B's update returns count 0; B's response carries A's slug, not B's", async () => {
    // Caller B's work() ran but A finished first and already flipped
    // the row to success=true with A's slug. B's conditional
    // updateMany matches zero rows (success is no longer false).
    // B must discard its slug and surface A's slug to the user so
    // both callers resolve to the same idempotent result.
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    mockPrisma.harnessUpload.findUnique
      .mockResolvedValueOnce({ slug: null, success: false }) // post-claim read (B sees A's claim row)
      .mockResolvedValueOnce({ slug: "A-slug", success: true }); // post-update re-read after race
    mockPrisma.harnessUpload.updateMany.mockResolvedValueOnce({ count: 0 });

    const work = vi.fn(async () => ({ slug: "B-slug" }));
    const result = await withIdempotency("user-1", "upload-1", work);

    expect(work).toHaveBeenCalledTimes(1);
    // Critical: B returns A's slug, with replayed: true.
    expect(result).toEqual({ slug: "A-slug", replayed: true });
  });
});
