/**
 * Postgres-backed idempotency for the harness direct-POST flow.
 *
 * Two helpers (Decision 11):
 *
 * 1. findIdempotentResult(userId, uploadId) — pure lookup. Returns
 *    `{ slug }` ONLY if a prior SUCCESSFUL HarnessUpload exists for this
 *    `(userId, uploadId)` pair. A row at `success: false` returns null
 *    so the upload route does NOT short-circuit on a half-finished
 *    prior attempt (which would skip the rate-limit check AND skip the
 *    actual work, leaving the user stuck on the partial failure).
 *    Used by the upload route to short-circuit replays BEFORE the
 *    rate-limit check, so a user who hits their 24h cap mid-retry
 *    still gets back the original draft URL (R14a).
 *
 * 2. withIdempotency(userId, uploadId, work) — claim-then-execute
 *    wrapper. The state machine on HarnessUpload.success:
 *
 *      | Pre-existing row              | Action                            |
 *      |-------------------------------|-----------------------------------|
 *      | None (we win the insert race) | Run work, UPDATE success=true.    |
 *      | success=true                  | Replay. Skip work.                |
 *      | success=false                 | Run work, UPDATE success=true.    |
 *
 *    Tradeoff: a `success=false` row can be either a real prior
 *    failure OR a concurrent first-time call still in flight. We
 *    collapse the two cases — both re-run `work()`. The collision
 *    window is tiny (the inner `work()` is ~hundreds of ms, then the
 *    UPDATE flips success=true), and the practical worst case is two
 *    drafts created when two first-time calls race. The common
 *    "skill retried after a network blip" case is caught earlier by
 *    `findIdempotentResult`, which the upload route calls before the
 *    rate-limit check.
 *
 *    Critically, this wrapper does NOT use Prisma's `upsert` with
 *    `update: {}` — that pattern silently leaves a stale `success=false`
 *    row at `success=false` forever, even after a later attempt
 *    actually succeeds, which broke retry-after-failure (P1.C). Instead
 *    we INSERT-OR-UPSERT a `success=false` claim row first, run work,
 *    then explicitly UPDATE the row to `success=true, slug=<result>`
 *    on success. On work() failure the row stays `success=false` so
 *    later retries can flip it.
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
  // Step 1: claim. Try to insert a `success=false` placeholder. If the
  // row already exists (concurrent first-time call OR prior attempt),
  // `update: {}` leaves it untouched and the existing row's success
  // flag tells us which branch to take.
  //
  // Note: We need to know whether the existing row already had
  // success=true. The cheapest way is to read after the upsert.
  await prisma.harnessUpload.upsert({
    where: { userId_uploadId: { userId, uploadId } },
    create: { userId, uploadId, slug: null, success: false },
    update: {}, // existing row left as-is — we read it next
  });

  const claimed = await prisma.harnessUpload.findUnique({
    where: { userId_uploadId: { userId, uploadId } },
    select: { slug: true, success: true },
  });
  if (!claimed) {
    // Vanishingly unlikely: row was deleted between upsert and read.
    // Surface as an error rather than silently re-creating.
    throw new Error(
      `withIdempotency: claim row disappeared for ${userId}/${uploadId}`,
    );
  }

  // Step 2: replay path. Prior success → return the stored slug, do
  // NOT re-run work().
  if (claimed.success && claimed.slug) {
    return { slug: claimed.slug, replayed: true };
  }

  // Step 3: execute path. Either we won the insert race (claimed.success
  // is false because we just inserted it) or the row was at success=false
  // from a prior failure / concurrent in-flight call. Both cases run
  // work() and flip the row to success=true on success.
  const result = await work();
  await prisma.harnessUpload.update({
    where: { userId_uploadId: { userId, uploadId } },
    data: { slug: result.slug, success: true },
  });
  return { slug: result.slug, replayed: false };
}
