/**
 * Postgres-backed rate limiters for the harness direct-POST flow.
 *
 * Two windows are enforced:
 *
 * 1. checkUploadRateLimit — counts HarnessUpload rows in the last 24h
 *    for `userId`. Successful uploads cap at 20/24h (R12); total
 *    attempts (success or failure) cap at 60/24h. The attempt cap
 *    catches a valid token spamming malformed requests.
 *
 * 2. checkMintRateLimit — counts HarnessToken rows minted in the last
 *    24h for `userId`. Cap is 10/day (R13). Revoked tokens still count
 *    against the cap because a revocation does not erase the mint.
 *
 * Both helpers return `{ ok: true }` on pass or
 * `{ ok: false, retryAfter, reason }` on cap hit. `retryAfter` is the
 * number of seconds until the oldest counted row falls out of the
 * 24h rolling window — the soonest moment the user could retry and pass.
 */
import { prisma } from "@/lib/db";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const UPLOAD_SUCCESS_CAP = 20;
export const UPLOAD_ATTEMPT_CAP = 60;
export const MINT_CAP = 10;

export type UploadRateLimitReason = "uploads_24h" | "attempts_24h";
export type MintRateLimitReason = "mints_24h";

export type RateLimitResult<TReason extends string> =
  | { ok: true }
  | { ok: false; retryAfter: number; reason: TReason };

/**
 * Returns the seconds-until-retry from the oldest row's timestamp.
 * Floor at 1 so callers never emit Retry-After: 0 (which clients
 * treat as "no wait at all").
 */
function retryAfterFromOldest(
  oldestCreatedAt: Date | null | undefined,
): number {
  if (!oldestCreatedAt) return 1;
  const ageMs = Date.now() - oldestCreatedAt.getTime();
  const remainingMs = TWENTY_FOUR_HOURS_MS - ageMs;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export async function checkUploadRateLimit(
  userId: string,
): Promise<RateLimitResult<UploadRateLimitReason>> {
  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

  // Two counts: successful uploads and total attempts. We care about
  // both caps independently; the user could be blocked by either.
  const [successCount, attemptCount] = await Promise.all([
    prisma.harnessUpload.count({
      where: { userId, success: true, createdAt: { gt: since } },
    }),
    prisma.harnessUpload.count({
      where: { userId, createdAt: { gt: since } },
    }),
  ]);

  if (successCount >= UPLOAD_SUCCESS_CAP) {
    const oldest = await prisma.harnessUpload.findFirst({
      where: { userId, success: true, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return {
      ok: false,
      retryAfter: retryAfterFromOldest(oldest?.createdAt),
      reason: "uploads_24h",
    };
  }

  if (attemptCount >= UPLOAD_ATTEMPT_CAP) {
    const oldest = await prisma.harnessUpload.findFirst({
      where: { userId, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return {
      ok: false,
      retryAfter: retryAfterFromOldest(oldest?.createdAt),
      reason: "attempts_24h",
    };
  }

  return { ok: true };
}

export async function checkMintRateLimit(
  userId: string,
): Promise<RateLimitResult<MintRateLimitReason>> {
  const since = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

  const count = await prisma.harnessToken.count({
    where: { userId, createdAt: { gt: since } },
  });

  if (count >= MINT_CAP) {
    const oldest = await prisma.harnessToken.findFirst({
      where: { userId, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return {
      ok: false,
      retryAfter: retryAfterFromOldest(oldest?.createdAt),
      reason: "mints_24h",
    };
  }

  return { ok: true };
}
