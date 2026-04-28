/**
 * Hybrid bearer + session authenticator for routes that accept both
 * the harness direct-POST flow and the existing browser session flow.
 *
 * Bearer path (Decision 3, Decision 2):
 *   - Reads `Authorization: Bearer ih_<...>` header.
 *   - Format-validates the token (prefix `ih_`, length 79, all hex
 *     after prefix) BEFORE any DB call. Malformed headers fall
 *     through to the session check rather than emitting a 401, so a
 *     stray header on an otherwise-valid session request still works.
 *   - On format-pass, calls verifyToken(); on success, returns
 *     `{ viaToken: true, tokenSelector }`. The selector is the
 *     plaintext 12-hex selector half — safe to log in trimmed form
 *     (first 8 chars) but never propagate the full token.
 *
 * Session fallback:
 *   - Calls NextAuth `auth()`. If a session resolves, looks up the
 *     user record by id to surface the username. Returns
 *     `{ viaToken: false }`.
 *
 * Returns null when neither path authenticates.
 */
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseToken, verifyToken } from "@/lib/harness-tokens";

export interface AuthenticatedRequest {
  userId: string;
  username: string;
  viaToken: boolean;
  tokenSelector?: string;
}

/**
 * Extract the raw bearer token from the request, if any. Returns null
 * when the header is missing or doesn't start with `Bearer `.
 */
function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  return match[1];
}

export async function authenticateRequest(
  req: Request,
): Promise<AuthenticatedRequest | null> {
  // Bearer path first. Format-validate before any DB call.
  const raw = extractBearer(req);
  if (raw && parseToken(raw)) {
    const verified = await verifyToken(raw);
    if (verified) {
      // verifyToken already touched the token row; we still need the
      // username for downstream URL composition.
      const user = await prisma.user.findUnique({
        where: { id: verified.userId },
        select: { username: true },
      });
      if (user) {
        return {
          userId: verified.userId,
          username: user.username,
          viaToken: true,
          tokenSelector: verified.selector,
        };
      }
    }
  }

  // Session fallback. Bearer that fails verification falls through
  // here so a logged-in user sending a stale token via a misbehaving
  // client doesn't lose their session-authed access.
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true },
  });
  if (!user) return null;

  return {
    userId: user.id,
    username: user.username,
    viaToken: false,
  };
}
