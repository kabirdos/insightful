---
title: "Harness direct-POST publish contract"
type: reference
status: shipped-and-live
date: 2026-06-20
audience: insight-harness skill side (kabirdos/insight-harness) + insightful server side
verified: "Probed against https://insightharness.com 2026-06-20 — endpoint live, bearer auth working."
---

# Harness direct-POST publish contract

This is the authoritative, code-verified contract for `/insight-harness --publish
--token=ih_…` autopublish. **Both sides are already implemented and live** — this
document exists so the contract is written down in one place and the stale-checkout
confusion that prompted it (see "Status" below) doesn't recur.

## Status (2026-06-20)

- **Server (`insightful`, this repo):** SHIPPED and LIVE in production. The bearer
  path in `src/app/api/upload/route.ts` was added by the Wave-3b "tokenized
  direct-POST" plan (`docs/plans/2026-04-22-001-feat-tokenized-direct-post-plan.md`).
  Verified live via probe on 2026-06-20.
- **Skill (`kabirdos/insight-harness`):** SHIPPED. `extract.py` ≥ 2.10.0 has
  `--publish/--token/--confirm` and `post_report()` POSTing to `/api/upload`. The
  conforming client code is `post_report()` in `skills/insight-harness/scripts/extract.py`.
- **Web mint UI:** LIVE. `NEXT_PUBLIC_DIRECT_POST_ENABLED="true"` in Vercel
  production, so a signed-in user on `/upload` is shown the token-mint UI.

> ⚠️ **Stale-checkout caveat.** There are two copies of the skill on disk:
> `claude-toolkit/skills/insight-harness` (was **2.3.0**, NO `--publish`) and the
> shipped `kabirdos/insight-harness` (**2.10.0+**, full publish). `~/.claude/skills/
insight-harness` symlinks the _stale_ claude-toolkit copy, which shadows the working
> marketplace plugin. Anyone auditing "does the skill consume `--publish`?" must read
> the **kabirdos** copy, not claude-toolkit.

## 1. Endpoint

```
POST {base}/api/upload
```

- `{base}` is `https://insightharness.com` in production. The skill resolves it via
  `publish_base_url()` (env-overridable for dev/preview).
- Same route as the legacy multipart browser flow. **Flow is selected by
  `Content-Type`:** `multipart/form-data` → legacy parse-only browser path;
  `application/octet-stream` or `text/html` → bearer-auth direct-POST path (this contract).
- Token mint/revoke is a separate endpoint: `POST` / `DELETE {base}/api/harness-tokens`.
- Browser poll-for-completion: `GET {base}/api/upload/status?since=<ISO>`.

## 2. Auth

- Header: `Authorization: Bearer ih_<selector><secret>`.
- **Token format:** `ih_` + 12 hex (selector) + 64 hex (secret) = **79 chars total**,
  no internal delimiter. Regex: `^ih_[0-9a-f]{76}$`.
- Server validates format BEFORE any DB hit (`parseToken`), then looks up by the
  12-char selector and `bcrypt`-compares the secret half (`verifyToken`,
  `src/lib/harness-tokens.ts`).
- Rejected if: malformed / unknown selector / `revokedAt` set / `expiresAt < now` /
  secret mismatch → all surface as **401** on the upload route.
- **Expiry rolls forward on every successful use:** `expiresAt = NOW() + 90d` and
  `lastUsedAt = NOW()`. A token used at least once every 90 days never expires.
- **One active token per user.** Minting a new token implicitly revokes the prior
  one (DB partial-unique index `HarnessToken_userId_active_unique`).
- Tokens are obtained from the web UI (`POST /api/harness-tokens`, returns the raw
  token exactly once) — there is no client-side token generation; a self-minted
  token cannot pass server bcrypt verification.

## 3. Payload

- **Body:** raw report HTML bytes (the same HTML the skill writes locally). No
  multipart wrapper, no JSON envelope.
- **Headers (required):**
  - `Authorization: Bearer ih_…`
  - `Content-Type: application/octet-stream` (or `text/html`)
  - `X-Upload-Id: <uuid v4>` — idempotency key. **Must be a syntactically valid
    UUID** (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).
    Reuse the same value to retry safely (see idempotency below).
- **Size cap:** 10 MB (checked against `Content-Length` first, then actual bytes).
- The server parses the HTML with the same pipeline as the browser path and persists
  a **draft** `InsightReport` (`isDraft: true`) — invisible to everyone but the owner
  until they click "Make public" on the edit page.

## 4. Success response

`200 OK`, JSON:

```json
{
  "editUrl": "https://insightharness.com/insights/<username>/<slug>/edit",
  "slug": "<slug>",
  "uploadId": "<the X-Upload-Id you sent>",
  "status": "draft",
  "replayed": false
}
```

- `editUrl` is **host-qualified** (server prepends `AUTH_URL` or the request origin) so
  the skill can print it as a directly-clickable link.
- The report lands as a **draft**. The user must open `editUrl` and "Make public" to
  publish — that is the only path to public visibility for direct-POST reports.

### Idempotency

- The `(userId, X-Upload-Id)` pair is unique. Re-POSTing the same `X-Upload-Id`
  returns the **original** `{ editUrl, slug }` with `"replayed": true` and does **not**
  create a second draft.
- **Idempotent replay beats the rate limit:** a replay of a prior successful
  `X-Upload-Id` returns 200 even if the user is currently at their 24h upload cap.
  (So a retry after a lost response always succeeds.)

## 5. Errors

| Status  | When                                                                                    | Body                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **401** | missing/malformed/expired/revoked token, or session-only (no bearer) on the direct path | `{ "error": "Unauthorized" }`                                                                                          |
| **400** | `X-Upload-Id` missing or not a UUID                                                     | `{ "error": "X-Upload-Id header is required and must be a UUID" }`                                                     |
| **400** | body isn't HTML / parses to an empty report / >10 MB                                    | `{ "error": "<reason>" }`                                                                                              |
| **415** | `Content-Type` not octet-stream/text-html                                               | `{ "error": "Unsupported Content-Type", "message": "Send the report as application/octet-stream or text/html." }`      |
| **429** | rate limit hit                                                                          | `{ "error": "rate_limited", "reason": "uploads_24h"\|"attempts_24h", "retryAfter": <seconds> }` + `Retry-After` header |
| **500** | server-side parse/publish failure                                                       | `{ "error": "Failed to publish draft report" }`                                                                        |

**Rate limits** (`src/lib/harness-rate-limit.ts`, per user, rolling 24h):

- Successful uploads: **20 / 24h** (`reason: "uploads_24h"`).
- Total attempts incl. failures: **60 / 24h** (`reason: "attempts_24h"`).
- Token mints: **10 / 24h** (`reason: "mints_24h"`, on `POST /api/harness-tokens`).
- `retryAfter` = seconds until the oldest counted row leaves the window (floor 1).

## Mint endpoint (`POST /api/harness-tokens`)

- Auth: NextAuth **session only** (deliberately no bearer — a leaked token can't
  rotate itself).
- `201` → `{ "token": "ih_…", "expiresAt": "<ISO>" }` (raw token returned once).
- `429` → `{ "error": "rate_limited", "reason": "mints_24h", "retryAfter": <s> }`.
- `409` → `{ "error": "mint_conflict", "message": "…reload…" }` (concurrent mint race).
- `DELETE /api/harness-tokens` revokes all active tokens for the session user → `204`.

## Status endpoint (`GET /api/upload/status?since=<ISO>`)

- Auth: session only (browser poll). Returns the caller's newest draft created after
  `since`: `{ editUrl, slug, createdAt }`, or `{ editUrl: null }` if none.
- `Cache-Control: no-store`. `400` on missing/invalid `since`, `401` unauth.

## Verified probes (2026-06-20, against production)

```
POST /api/upload  (no token, text/html)                 → 401 {"error":"Unauthorized"}
POST /api/upload  (valid token, text/html, no Upload-Id)→ 400 {"error":"X-Upload-Id header is required and must be a UUID"}
POST /api/upload  (valid token, application/json)        → 415 {"error":"Unsupported Content-Type",...}
```

The 400 (not 401) on the second probe proves the token authenticated and the endpoint
is live — auth and content-type checks both passed; only the missing idempotency key
stopped it.
