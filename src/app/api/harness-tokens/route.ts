/**
 * Harness token mint + revoke endpoints (Unit 6 of Wave 3b plan).
 *
 * POST   /api/harness-tokens — mint a fresh token for the session user.
 *                              Implicitly revokes any prior active token
 *                              (one-active-token invariant per Decision 2).
 *                              Body: none. Returns: `{ token, expiresAt }`.
 *
 * DELETE /api/harness-tokens — revoke every active token for the session
 *                              user. Idempotent — 204 even if there's
 *                              nothing to revoke. Returns: 204 No Content.
 *
 * Auth: NextAuth session only. We deliberately do NOT accept bearer auth
 * here — this endpoint mints credentials, not consumes them, and accepting
 * a bearer would let a leaked token rotate itself.
 *
 * Rate limit: POST is gated by both a soft pre-check (`checkMintRateLimit`,
 * gives the most accurate Retry-After) AND a hard per-transaction count
 * inside `mintTokenForUser` (`MintRateLimitError`, prevents concurrent
 * bursts from blowing past the cap). DELETE is unrate-limited.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkMintRateLimit } from "@/lib/harness-rate-limit";
import {
  MintConflictError,
  MintRateLimitError,
  mintTokenForUser,
  revokeActiveTokensForUser,
} from "@/lib/harness-tokens";

const TWENTY_FOUR_HOURS_S = 24 * 60 * 60;

/**
 * Translate a MintRateLimitError's `oldestCreatedAt` to a Retry-After
 * second count. Floor at 1 — emitting `Retry-After: 0` tells clients
 * they may retry immediately, which is exactly the loop we want to
 * avoid.
 */
function retryAfterFromOldest(oldestCreatedAt: Date): number {
  const ageMs = Date.now() - oldestCreatedAt.getTime();
  const remainingMs = TWENTY_FOUR_HOURS_S * 1000 - ageMs;
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

export async function POST() {
  // Wrap the whole handler so any failure in `auth()` or the soft
  // rate-limit query still emits a structured 500. Without this, an
  // upstream NextAuth or DB error would fall through to Next.js's
  // generic error page, breaking the JSON API contract for the upload
  // page that calls this from a fetch().
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // Soft check first: gives an accurate Retry-After in the common
    // (non-racing) case. The hard check sits inside the transaction in
    // `mintTokenForUser` so two concurrent POSTs can't each pass the
    // soft check and serialize through to mint, exceeding the cap.
    const limit = await checkMintRateLimit(userId);
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: "rate_limited",
          reason: limit.reason,
          retryAfter: limit.retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfter) },
        },
      );
    }

    const { raw, expiresAt } = await mintTokenForUser(userId);
    return NextResponse.json(
      { token: raw, expiresAt: expiresAt.toISOString() },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MintConflictError) {
      return NextResponse.json(
        {
          error: "mint_conflict",
          message:
            "Another token mint just succeeded for this user. Reload the page to see the active token.",
        },
        { status: 409 },
      );
    }
    if (error instanceof MintRateLimitError) {
      const retryAfter = retryAfterFromOldest(error.oldestCreatedAt);
      return NextResponse.json(
        {
          error: "rate_limited",
          reason: "mints_24h",
          retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
    console.error("POST /api/harness-tokens error:", error);
    return NextResponse.json(
      { error: "Failed to mint token" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await revokeActiveTokensForUser(session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/harness-tokens error:", error);
    return NextResponse.json(
      { error: "Failed to revoke token" },
      { status: 500 },
    );
  }
}
