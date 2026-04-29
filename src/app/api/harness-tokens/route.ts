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
 * Rate limit: POST hits checkMintRateLimit (10/24h per user, R13). DELETE
 * is unrate-limited; revocation is fast and incentive-aligned with safety.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkMintRateLimit } from "@/lib/harness-rate-limit";
import {
  MintConflictError,
  mintTokenForUser,
  revokeActiveTokensForUser,
} from "@/lib/harness-tokens";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

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

  try {
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
    console.error("POST /api/harness-tokens error:", error);
    return NextResponse.json(
      { error: "Failed to mint token" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
