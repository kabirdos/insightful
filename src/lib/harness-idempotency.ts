/**
 * Postgres-backed idempotency for the harness direct-POST flow.
 *
 * Two helpers (Decision 11):
 *
 * 1. findIdempotentResult(userId, uploadId) — pure lookup. Returns
 *    `{ slug }` if a prior successful HarnessUpload exists for this
 *    `(userId, uploadId)` pair, else null. Used by the upload route
 *    to short-circuit replays BEFORE the rate-limit check, so that a
 *    user who hits their 24h cap mid-retry still gets back the
 *    original draft URL (R14a).
 *
 * 2. withIdempotency(userId, uploadId, work) — execution wrapper. If a
 *    prior successful row exists, returns the stored slug with
 *    `replayed: true` and does NOT re-run `work`. Otherwise runs
 *    `work`, persists `{ success: true, slug }`, returns
 *    `{ slug, replayed: false }`. Concurrent calls are resolved by the
 *    `(userId, uploadId)` unique constraint — the loser fetches the
 *    winner's slug and reports `replayed: true`.
 */
import { prisma } from "@/lib/db";

export interface IdempotentLookupResult {
  slug: string;
}

export interface IdempotentRunResult {
  slug: string;
  replayed: boolean;
}

export interface IdempotentWork {
  (): Promise<{ slug: string }>;
}

export async function findIdempotentResult(
  userId: string,
  uploadId: string,
): Promise<IdempotentLookupResult | null> {
  const row = await prisma.harnessUpload.findUnique({
    where: { userId_uploadId: { userId, uploadId } },
    select: { slug: true, success: true },
  });
  if (!row || !row.success || !row.slug) return null;
  return { slug: row.slug };
}

export async function withIdempotency(
  userId: string,
  uploadId: string,
  work: IdempotentWork,
): Promise<IdempotentRunResult> {
  // Fast-path: a prior success already exists. Skip the work entirely.
  const existing = await findIdempotentResult(userId, uploadId);
  if (existing) {
    return { slug: existing.slug, replayed: true };
  }

  // Race-resolution path: another concurrent caller may insert before
  // us. We attempt the work; if its INSERT/finalize trips the unique
  // (userId, uploadId) constraint via the loser path, we re-read the
  // winner's slug and report replayed: true.
  try {
    const result = await work();
    await prisma.harnessUpload.upsert({
      where: { userId_uploadId: { userId, uploadId } },
      create: { userId, uploadId, slug: result.slug, success: true },
      update: {}, // never overwrite a winner's row
    });
    // After the upsert, another caller may have won the race and
    // stored a different slug. Re-read to be sure we return the
    // winning slug, not whichever this branch produced locally.
    const finalRow = await prisma.harnessUpload.findUnique({
      where: { userId_uploadId: { userId, uploadId } },
      select: { slug: true },
    });
    const finalSlug = finalRow?.slug ?? result.slug;
    const replayed = finalSlug !== result.slug;
    return { slug: finalSlug, replayed };
  } catch (error) {
    // If the work itself failed, surface the error. Callers are
    // responsible for recording an attempt-failure HarnessUpload row
    // outside the wrapper (the unique constraint means we cannot
    // store both a failure and a later success at the same key).
    throw error;
  }
}
