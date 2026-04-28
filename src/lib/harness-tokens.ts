/**
 * Harness bearer token primitives.
 *
 * Token format (Decision 2 in the Wave 2 plan):
 *   ih_<12 hex selector><64 hex secret>
 *   - Total length: 79 chars
 *   - No internal delimiter — selector is bytes [3, 15) and secret is bytes [15, 79).
 *   - selector is stored indexed and plaintext for O(1) lookup.
 *   - secret is bcrypt-hashed (cost factor 10).
 *
 * Expiry rolls forward (Decision 12):
 *   On every successful verifyToken(), the server updates BOTH `lastUsedAt`
 *   AND `expiresAt = NOW() + 90d`. Inactive tokens fall over the cliff once
 *   `expiresAt < NOW()`. The verification check is therefore trivial.
 */
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { prisma } from "@/lib/db";

export const TOKEN_PREFIX = "ih_";
export const SELECTOR_HEX_LENGTH = 12; // 6 random bytes
export const SECRET_HEX_LENGTH = 64; // 32 random bytes
export const TOKEN_LENGTH =
  TOKEN_PREFIX.length + SELECTOR_HEX_LENGTH + SECRET_HEX_LENGTH; // 79

const TOKEN_REGEX = new RegExp(
  `^${TOKEN_PREFIX}[0-9a-f]{${SELECTOR_HEX_LENGTH + SECRET_HEX_LENGTH}}$`,
);

const BCRYPT_COST = 10;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export interface GeneratedToken {
  raw: string;
  selector: string;
  secret: string;
}

export interface VerifiedToken {
  userId: string;
  tokenId: string;
  selector: string;
}

/**
 * Generate a fresh random token. Returns the raw string plus the
 * decomposed parts so callers can persist (selector, hash(secret))
 * without recomputing.
 */
export function generateToken(): GeneratedToken {
  const selector = crypto.randomBytes(SELECTOR_HEX_LENGTH / 2).toString("hex");
  const secret = crypto.randomBytes(SECRET_HEX_LENGTH / 2).toString("hex");
  return {
    raw: `${TOKEN_PREFIX}${selector}${secret}`,
    selector,
    secret,
  };
}

/** Bcrypt the secret half. Cost factor 10 per Decision 2. */
export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_COST);
}

/**
 * Parse a raw token into selector + secret. Returns null for malformed
 * input. Format-only check: does not touch the DB.
 */
export function parseToken(
  raw: string,
): { selector: string; secret: string } | null {
  if (typeof raw !== "string") return null;
  if (raw.length !== TOKEN_LENGTH) return null;
  if (!TOKEN_REGEX.test(raw)) return null;
  return {
    selector: raw.slice(
      TOKEN_PREFIX.length,
      TOKEN_PREFIX.length + SELECTOR_HEX_LENGTH,
    ),
    secret: raw.slice(TOKEN_PREFIX.length + SELECTOR_HEX_LENGTH),
  };
}

/**
 * Mint a new token for `userId`. Implicitly revokes any prior active
 * tokens (R3): a user has at most one active token at a time. Returns
 * the raw token exactly once — callers must surface it immediately
 * because the secret is never recoverable after this call.
 */
export async function mintTokenForUser(
  userId: string,
): Promise<{ raw: string; expiresAt: Date }> {
  const generated = generateToken();
  const hashedSecret = await hashSecret(generated.secret);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + NINETY_DAYS_MS);

  await prisma.$transaction(async (tx) => {
    await tx.harnessToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.harnessToken.create({
      data: {
        userId,
        selector: generated.selector,
        hashedSecret,
        expiresAt,
      },
    });
  });

  return { raw: generated.raw, expiresAt };
}

/** Revoke every active token for `userId`. Idempotent. */
export async function revokeActiveTokensForUser(userId: string): Promise<void> {
  await prisma.harnessToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Validate a raw bearer token. On success returns the resolved
 * userId/tokenId/selector and rolls expiresAt + lastUsedAt forward
 * (Decision 12). On any failure returns null without side effects.
 */
export async function verifyToken(raw: string): Promise<VerifiedToken | null> {
  const parsed = parseToken(raw);
  if (!parsed) return null;

  const token = await prisma.harnessToken.findUnique({
    where: { selector: parsed.selector },
  });
  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt.getTime() < Date.now()) return null;

  const ok = await bcrypt.compare(parsed.secret, token.hashedSecret);
  if (!ok) return null;

  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + NINETY_DAYS_MS);
  await prisma.harnessToken.update({
    where: { id: token.id },
    data: { lastUsedAt: now, expiresAt: newExpiresAt },
  });

  return {
    userId: token.userId,
    tokenId: token.id,
    selector: token.selector,
  };
}
