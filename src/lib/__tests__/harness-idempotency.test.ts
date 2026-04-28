import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    harnessUpload: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { findIdempotentResult, withIdempotency } from "../harness-idempotency";

const mockPrisma = prisma as unknown as {
  harnessUpload: { findUnique: Mock; upsert: Mock };
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

  it("returns null on a row with success=false (failed attempt only)", async () => {
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
  it("first call runs work, stores slug, returns { replayed: false }", async () => {
    // No prior row.
    mockPrisma.harnessUpload.findUnique
      .mockResolvedValueOnce(null) // pre-flight check
      .mockResolvedValueOnce({ slug: "new-slug" }); // post-upsert re-read
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    const work = vi.fn(async () => ({ slug: "new-slug" }));

    const result = await withIdempotency("user-1", "upload-1", work);

    expect(work).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ slug: "new-slug", replayed: false });
    expect(mockPrisma.harnessUpload.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_uploadId: { userId: "user-1", uploadId: "upload-1" } },
        create: expect.objectContaining({
          userId: "user-1",
          uploadId: "upload-1",
          slug: "new-slug",
          success: true,
        }),
      }),
    );
  });

  it("second call with same (userId, uploadId) skips work and reports replayed: true", async () => {
    // Pre-flight returns the prior success; work should NOT run.
    mockPrisma.harnessUpload.findUnique.mockResolvedValueOnce({
      slug: "prior-slug",
      success: true,
    });
    const work = vi.fn(async () => ({ slug: "should-not-run" }));

    const result = await withIdempotency("user-1", "upload-1", work);

    expect(work).not.toHaveBeenCalled();
    expect(result).toEqual({ slug: "prior-slug", replayed: true });
    expect(mockPrisma.harnessUpload.upsert).not.toHaveBeenCalled();
  });

  it("concurrent race: loser reads winner's slug and reports replayed: true", async () => {
    // Pre-flight passes (no row yet), work runs and produces a slug,
    // upsert hits the unique constraint via the no-op update branch,
    // and the post-upsert re-read returns a DIFFERENT slug — the
    // winner's. The loser must surface that and mark replayed: true.
    mockPrisma.harnessUpload.findUnique
      .mockResolvedValueOnce(null) // pre-flight
      .mockResolvedValueOnce({ slug: "winner-slug" }); // post-upsert re-read
    mockPrisma.harnessUpload.upsert.mockResolvedValue({});
    const work = vi.fn(async () => ({ slug: "loser-slug" }));

    const result = await withIdempotency("user-1", "upload-1", work);

    expect(result).toEqual({ slug: "winner-slug", replayed: true });
  });

  it("propagates errors from the work callback", async () => {
    mockPrisma.harnessUpload.findUnique.mockResolvedValue(null);
    const work = vi.fn(async () => {
      throw new Error("parse failed");
    });

    await expect(withIdempotency("user-1", "upload-1", work)).rejects.toThrow(
      "parse failed",
    );
    expect(mockPrisma.harnessUpload.upsert).not.toHaveBeenCalled();
  });
});
