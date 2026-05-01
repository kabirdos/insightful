/**
 * Tests for POST/DELETE /api/harness-tokens (Unit 6 of Wave 3b plan).
 *
 * The route delegates to two helpers we've already covered in their own
 * unit tests (`mintTokenForUser`, `revokeActiveTokensForUser`,
 * `checkMintRateLimit`). These tests focus on HTTP-layer concerns:
 *   - session-required auth, both endpoints
 *   - 429 wiring (Retry-After + reason)
 *   - 409 wiring on MintConflictError
 *   - 204 contract on DELETE (always idempotent)
 */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ── Mocks (declared before route import) ────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/harness-rate-limit", () => ({
  checkMintRateLimit: vi.fn(),
}));

vi.mock("@/lib/harness-tokens", () => ({
  // MintConflictError + MintRateLimitError are classes; the route imports
  // them for `instanceof` checks. Re-export shape-compatible doubles so
  // the instanceof branches fire when the mocked mintTokenForUser
  // rejects with `new MintConflictError(...)` / `new MintRateLimitError(...)`.
  MintConflictError: class MintConflictError extends Error {
    constructor(userId: string) {
      super(`Concurrent mint for user ${userId}`);
      this.name = "MintConflictError";
    }
  },
  MintRateLimitError: class MintRateLimitError extends Error {
    readonly oldestCreatedAt: Date;
    constructor(userId: string, oldestCreatedAt: Date) {
      super(`Mint cap reached for user ${userId}`);
      this.name = "MintRateLimitError";
      this.oldestCreatedAt = oldestCreatedAt;
    }
  },
  mintTokenForUser: vi.fn(),
  revokeActiveTokensForUser: vi.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { checkMintRateLimit } from "@/lib/harness-rate-limit";
import {
  MintConflictError,
  MintRateLimitError,
  mintTokenForUser,
  revokeActiveTokensForUser,
} from "@/lib/harness-tokens";
import {
  DELETE as harnessTokensDELETE,
  POST as harnessTokensPOST,
} from "../route";

const mockAuth = auth as unknown as Mock;
const mockMintLimit = checkMintRateLimit as unknown as Mock;
const mockMint = mintTokenForUser as unknown as Mock;
const mockRevoke = revokeActiveTokensForUser as unknown as Mock;

function setSession(userId: string | null) {
  if (userId === null) {
    mockAuth.mockResolvedValue(null);
  } else {
    mockAuth.mockResolvedValue({ user: { id: userId } });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── POST tests ──────────────────────────────────────────────────────

describe("POST /api/harness-tokens", () => {
  it("returns 401 when there is no session", async () => {
    setSession(null);
    const response = await harnessTokensPOST();
    expect(response.status).toBe(401);
    expect(mockMintLimit).not.toHaveBeenCalled();
    expect(mockMint).not.toHaveBeenCalled();
  });

  it("mints a token for the session user and returns { token, expiresAt }", async () => {
    setSession("user-1");
    mockMintLimit.mockResolvedValue({ ok: true });
    const expiresAt = new Date("2027-04-21T00:00:00.000Z");
    mockMint.mockResolvedValue({
      raw: `ih_${"a".repeat(76)}`,
      expiresAt,
    });

    const response = await harnessTokensPOST();
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      token: `ih_${"a".repeat(76)}`,
      expiresAt: expiresAt.toISOString(),
    });
    expect(mockMint).toHaveBeenCalledWith("user-1");
  });

  it("returns 429 with Retry-After + mints_24h reason when the rate limiter blocks", async () => {
    setSession("user-1");
    mockMintLimit.mockResolvedValue({
      ok: false,
      reason: "mints_24h",
      retryAfter: 12345,
    });

    const response = await harnessTokensPOST();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12345");
    const body = await response.json();
    expect(body.reason).toBe("mints_24h");
    expect(body.retryAfter).toBe(12345);
    expect(mockMint).not.toHaveBeenCalled();
  });

  it("returns 409 with mint_conflict body on MintConflictError", async () => {
    setSession("user-1");
    mockMintLimit.mockResolvedValue({ ok: true });
    mockMint.mockRejectedValue(new MintConflictError("user-1"));

    const response = await harnessTokensPOST();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("mint_conflict");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("returns 429 with mints_24h reason when the in-tx rate-limit fires", async () => {
    // Race scenario: soft check passes, but by the time the transaction
    // ran, a concurrent burst pushed the count to cap. The helper throws
    // MintRateLimitError; the route translates to 429 with Retry-After
    // computed from the oldest counted row.
    setSession("user-1");
    mockMintLimit.mockResolvedValue({ ok: true });
    const oldest = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    mockMint.mockRejectedValue(new MintRateLimitError("user-1", oldest));

    const response = await harnessTokensPOST();
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.reason).toBe("mints_24h");
    expect(body.retryAfter).toBeGreaterThan(0);
    // Oldest row is 1h ago in a 24h window → ~23h remaining.
    expect(body.retryAfter).toBeLessThanOrEqual(24 * 60 * 60);
    expect(body.retryAfter).toBeGreaterThan(22 * 60 * 60);
    expect(response.headers.get("Retry-After")).toBe(String(body.retryAfter));
  });

  it("returns 500 (with JSON body) when auth() throws unexpectedly", async () => {
    // If `auth()` blows up (NextAuth crash, DB error in jwt callback),
    // the route must still emit a structured 500 — falling through to
    // Next's generic error page would break fetch clients on the
    // upload page.
    mockAuth.mockRejectedValue(new Error("auth crash"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await harnessTokensPOST();
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
  });

  it("returns 500 on unexpected mint errors", async () => {
    setSession("user-1");
    mockMintLimit.mockResolvedValue({ ok: true });
    mockMint.mockRejectedValue(new Error("boom"));

    // Suppress the route's console.error for the duration of this test.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await harnessTokensPOST();
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
  });
});

// ── DELETE tests ────────────────────────────────────────────────────

describe("DELETE /api/harness-tokens", () => {
  it("returns 401 when there is no session", async () => {
    setSession(null);
    const response = await harnessTokensDELETE();
    expect(response.status).toBe(401);
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it("revokes the user's active tokens and returns 204", async () => {
    setSession("user-1");
    mockRevoke.mockResolvedValue(undefined);

    const response = await harnessTokensDELETE();
    expect(response.status).toBe(204);
    // 204 has no body — verify
    expect(await response.text()).toBe("");
    expect(mockRevoke).toHaveBeenCalledWith("user-1");
  });

  it("is idempotent — returns 204 even when no active token exists", async () => {
    setSession("user-1");
    // revokeActiveTokensForUser is implemented via updateMany → resolves
    // even when nothing matched. Mirror that here.
    mockRevoke.mockResolvedValue(undefined);

    const response = await harnessTokensDELETE();
    expect(response.status).toBe(204);
  });
});
