---
date: 2026-04-22
topic: tokenized-direct-post
---

# Tokenized Direct-POST Upload

## Problem Frame

The current upload flow is a 5-step scavenger hunt: copy two install commands, run `/insight-harness`, hunt for a dated HTML file in a hidden folder, drag it into the upload UI, sign in with GitHub at the end of the wizard. Polishing this flow (Approach B in the 2026-04-21 brainstorm) would sand the rough edges but leaves ~5 of 9 polish requirements destined for deletion once direct-POST lands. Low usage is the cheapest moment to rebuild — there is no installed base whose habits must be preserved.

This document specifies the direct-POST architecture: the skill authenticates itself with a server-minted bearer token and POSTs the report directly to the upload endpoint. The user never has to find a file, drag it, or switch between terminal and browser mid-flow. First-time cost: three actions (sign in, copy, paste). Repeat cost: one command.

## User Flow

```
┌────────────────────────────────────────────────────────────────────┐
│ FIRST-TIME USER                                                    │
└────────────────────────────────────────────────────────────────────┘

Landing: insightharness.com/upload
   │
   │ Unauth state: example report preview, "what this does" copy,
   │ single "Sign in with GitHub to get started" CTA
   ▼
Sign in with GitHub (NextAuth, existing infra)
   │
   ▼
Post-auth state on /upload:
   ┌─────────────────────────────────────────────────┐
   │ 1. Install the skill (one-time):                │
   │    ┌─────────────────────────────────────────┐  │
   │    │ /plugin marketplace add ...             │  │
   │    │ /plugin install ...                     │  │
   │    └─────────────────────────────────────────┘  │
   │                                                 │
   │ 2. Paste this into Claude Code:                 │
   │    ┌─────────────────────────────────────────┐  │
   │    │ /insight-harness --publish              │  │
   │    │   --token=ih_a1b2c3d4e5f6g7h8           │  │
   │    └─────────────────────────────────────────┘  │
   │                                                 │
   │ ⏳ Waiting for your report…                     │
   └─────────────────────────────────────────────────┘
   │
   │ User runs the command in Claude Code
   ▼
Skill: extract → POST to /api/upload with Bearer token
   │
   ▼
Server: validate token, parse HTML, create draft report
   │
   │ Returns { editUrl: "/r/craigdossantos/edit?draft=1" }
   ▼
Two things happen in parallel:
   - Skill prints the edit URL to stdout (and copies to clipboard)
   - Upload page, polling, detects the POST and redirects to editUrl
   ▼
/r/<slug>/edit?draft=1 — draft is private (404 for everyone else)
User tweaks title / hides sections / links projects
   │
   ▼
Clicks "Make public" → report goes live at /r/<slug>


┌────────────────────────────────────────────────────────────────────┐
│ REPEAT USER                                                        │
└────────────────────────────────────────────────────────────────────┘

Types `/insight-harness` in Claude Code (no --token flag)
   │
   │ Skill reads cached token from ~/.claude/insight-harness/config.json
   ▼
Skill: extract → POST to /api/upload → prints share URL
   │
   │ If report was previously published publicly, new POST creates a
   │ new draft (does not replace the live public report). User can
   │ either publish the new draft (new slug) or discard it.
   ▼
User opens the printed URL when ready
```

## Requirements

**Token Issuance & Lifecycle**

- R1. A new authenticated endpoint `POST /api/harness-tokens` must mint a bearer token for the signed-in user. Returns `{ token: "ih_<random>", expiresAt }`.
- R2. **Token format is `ih_<selector>_<secret>`** — a 12-char random selector plus a 32-char random secret, joined with an underscore. The server persists the selector in plaintext (indexed, for O(1) lookup) and persists only a slow hash (bcrypt or argon2) of the secret. The raw token is returned exactly once at mint time. Token records carry `userId`, `selector` (unique indexed), `hashedSecret`, `createdAt`, `expiresAt`, `lastUsedAt`, `revokedAt`. Rationale: hashing the entire token would force a table scan to authenticate every request. The selector+secret split is standard practice (GitHub PATs, Rails has_secure_token).
- R3. Each user has **at most one active (non-revoked, non-expired) token** at a time. Minting a new token implicitly revokes the user's previous active token. This simplifies the mental model — "my token" is always singular.
- R4. Tokens do not expire on use (they're reusable across many uploads). They expire **90 days** after last use, or immediately when explicitly revoked. Rationale: repeat-publishing is the happy path; expiring per-use would force users back to the browser for every upload.
- R5. _(Removed for v1 — token revocation lives on the `/upload` page per R26. A settings page does not exist yet and building one is out of scope for this feature. Merged into R26.)_

**Bearer Authentication on Upload**

- R6. **A single endpoint handles direct-POST from the skill**: `POST /api/upload` is extended to accept both the existing multipart/form-data browser flow AND a new `application/octet-stream` (or `text/html`) body path when `Authorization: Bearer ih_<token>` is present. Under bearer auth, the endpoint does parse + persist in one call (not just parse as today) — it executes the union of what `/api/upload` and `/api/insights` POST currently do in the browser flow, atomically. The existing multipart browser flow is unchanged. Rationale: the skill should not have to make two round-trips or coordinate a state handoff between two endpoints it doesn't own.
- R7. Reports created via bearer-token POST must be persisted as **drafts** — a new `isDraft` boolean column on the `InsightReport` model, defaulting to `false` for all existing rows (preserves current visibility) and `true` for all bearer-token POSTs.
- R8. The response to a successful bearer-auth POST returns `{ editUrl, slug, status: "draft", uploadId }`. The `editUrl` uses the app's canonical route: `/insights/<username>/<slug>/edit` (see `src/lib/urls.ts`). The `uploadId` is a server-generated ID used by the upload-page poller for correlation (see R24).

**Draft Visibility & Publish**

- R9. Draft reports must be 404 (not 403) for non-owners on the detail route. Unauthenticated visitors and non-owner authenticated visitors see the same "not found" response — no enumeration of draft slugs.
- R9a. **Drafts must be excluded from every public read path.** The current codebase has no visibility filter anywhere (`src/app/api/insights/route.ts` returns all reports; the detail route returns non-owner drafts; the edit page shows a "you can only edit your own" page instead of 404ing). Every read path — the feed listing (`GET /api/insights`), the report detail page and its API, the top / leaderboard queries, the user profile page, the OG image route, search, and any future listing — must filter `isDraft: false` by default and only include drafts when the viewer is the owner. Adding the `isDraft` column without auditing all readers will leak every draft.
- R9b. The existing edit page's "you can only edit your own reports" behavior (`src/app/insights/[username]/[slug]/edit/page.tsx`) must change to 404 for non-owners when the underlying report is a draft, matching R9. For public reports, the current behavior (show the page, disable editing) may stay unchanged.
- R10. The owner's edit page (`/insights/<username>/<slug>/edit`) must include a "Make public" action that flips `isDraft: false`. Before the flip, the report is invisible to everyone except the owner. After, it behaves like any other published report.
- R11. Making a report public must be the only path to public visibility. There is no "publish immediately" shortcut — direct-POST always produces a draft first.

**Rate Limiting & Abuse Protection**

- R12. Bearer-auth uploads must be rate-limited at **both** successful and attempted POSTs: 20 successful uploads AND 60 total POST attempts (failed + successful) per user per rolling 24-hour window. The second cap bounds parse/CPU abuse from a valid token repeatedly POSTing malformed bodies.
- R13. Token minting must be rate-limited to **10 mints per user per 24-hour window** to prevent token-cycling as an abuse vector.
- R14. Rate-limit failures return HTTP 429 with a `Retry-After` header and a message the skill surfaces verbatim to the user.
- R14a. **Idempotency**: Every bearer-auth POST must include a client-generated `X-Upload-Id` header (UUID). The server persists a `(userId, uploadId) → reportSlug` mapping. A replay of the same `uploadId` within 24 hours returns the original `editUrl` instead of creating a duplicate draft. This handles the "skill POSTed, server created draft, network dropped before response reached skill, user reruns" scenario.

**Skill Integration**

- R15. A new flag `--publish` must be added to the `/insight-harness` skill. When combined with `--token=<value>`, the skill persists the token to `~/.claude/insight-harness/config.json` and uses it for the current run.
- R16. When `--publish` is passed without `--token`, the skill reads the token from `~/.claude/insight-harness/config.json`. If no config exists, it prints a friendly message directing the user to `https://insightharness.com/upload` and exits non-zero without extracting.
- R17. The token config file (`~/.claude/insight-harness/config.json`) must be written with file mode `0600` (owner read/write only). Storage is plaintext — acceptable because the file lives on the user's local machine alongside other `~/.claude/` state, and tokens are revocable.
- R18. On successful POST, the skill must:
  - Print the returned edit URL to stdout as the final line (replaces the current "last line is absolute path" contract when `--publish` is used)
  - Copy the edit URL to the system clipboard (same best-effort logic: `pbcopy` on macOS, `wl-copy`/`xclip` on Linux, skip on Windows)
  - Exit 0
- R19. On HTTP 401 (expired or revoked token), the skill must:
  - Save the generated HTML to the usual `~/.claude/insight-harness/report.html` so the user's work is not lost
  - Print a message: "Your token is expired or revoked. Visit https://insightharness.com/upload for a new one. Your report is saved at <path>."
  - Exit non-zero
- R20. On network failure, 5xx, or 429, the skill must save the HTML locally (same as R19) and print the server's error message verbatim plus the local save path. Retry logic is out of scope — the user re-runs the command.
- R21. An optional `--confirm` flag must show an interactive terminal prompt ("Publish this report to insightharness.com? [y/N]") before POSTing. On `n` or non-TTY environments where input isn't available, save locally and exit without POSTing.

**Upload Page**

- R22. The unauthenticated `/upload` page must show: an example report preview or illustrative screenshot, a one-sentence description of what Insightful does, and a single "Sign in with GitHub" CTA. It must **not** be a blank OAuth gate.
- R23. The authenticated `/upload` page must show: (a) the plugin install block (collapsed by default for returning users via localStorage flag), (b) the tokenized `/insight-harness --publish --token=…` command with a copy button, (c) a "Waiting for your report…" status with polling. The page must also show a small "⚠ Your token is on this screen. It gives anyone who sees it permission to publish as you. Close the tab when done." warning near the copy block — tokens will inevitably end up in terminal history; the mitigation is visibility and easy rotation (R26), not preventing the leak.
- R24. The page must poll `GET /api/upload/status?since=<waitStartTimestamp>` (new endpoint) every 3 seconds while waiting. The endpoint returns the user's most recently-created draft whose `createdAt > since`, or empty. This avoids misredirecting to old drafts when the user has prior unpublished work, and handles multi-tab correctly (each tab polls with its own `waitStartTimestamp` captured on page load). On a match, redirect the browser to the draft's edit URL.
- R25. A fallback "Having trouble? Upload a file instead" link must reveal the existing drag-drop flow for users whose terminal can't run the skill for some reason (e.g., they're on a borrowed machine). The fallback path continues to work as it does today.
- R26. The page must expose a "Revoke this token and generate a new one" action next to the copy block, for users who suspect their token has leaked or want to rotate.

## Success Criteria

- A first-time signed-in user can go from landing on `/upload` to viewing a draft report at `/r/<slug>/edit` in **3 or fewer actions**: sign in, copy, paste. (Measurable by counting UI interactions; not a wall-clock claim.)
- A repeat user can publish a new draft with **1 action**: typing `/insight-harness` in Claude Code.
- Zero manual file-hunting. The user never needs to know where `~/.claude/insight-harness/report.html` lives unless an upload fails.
- Drafts are never exposed publicly without explicit owner action. Verified via automated test that an unauthenticated GET on a draft slug returns 404.
- Token abuse surface is bounded: one active token per user, 20 uploads/day, 10 mints/day, per-user-hashed storage.
- The fallback drag-drop flow continues to work for any user who can't or won't use direct-POST.

## Scope Boundaries

- **Out of scope:** Replacing or deprecating the existing drag-drop upload flow. It remains as a fallback indefinitely.
- **Out of scope:** Changes to the `/r/<slug>/edit` page itself beyond adding a "Make public" button. The editing affordances (redactions, project linking, title editing, section hiding) that already exist on this page are reused as-is.
- **Out of scope:** Multiple concurrent tokens per user (deliberately simplified to one active token — see R3).
- **Out of scope:** Token sharing across users or team/org-scoped tokens. Tokens are strictly single-user.
- **Out of scope:** Keychain-backed token storage. Plaintext with `0600` perms is the chosen trust model (R17).
- **Out of scope:** Retry logic in the skill on failed POST. User re-runs manually (R20).
- **Out of scope:** Windows clipboard support in the skill (same boundary as the polish pass).
- **Out of scope:** Webhook / SSE delivery of upload completion. Polling is the chosen mechanism (R24); can be upgraded later if latency is a problem.
- **Out of scope:** Auth providers other than GitHub.

## Key Decisions

- **Private by default**: All direct-POST uploads create drafts. The user makes them public explicitly. Removes the need for a pre-publish "are you sure" prompt — the draft state _is_ the confirmation gate.
- **One active token per user**: Simpler UX ("my token" is always singular) and simpler revocation semantics. Users rotate by minting a new one; the old one is implicitly dead.
- **Tokens are long-lived (90-day inactivity expiry) and reusable**: Optimized for the repeat-publish happy path. Short-lived per-use tokens would force the user back to the browser for every publish, which defeats the whole point.
- **Plaintext token storage at `~/.claude/insight-harness/config.json` with mode 0600**: Matches the trust model of `~/.aws/credentials`, `~/.netrc`, GitHub CLI's token file. Revocable from the web UI if leaked. Keychain integration is over-engineering for local-dev audience.
- **Publish-first, edit-after (with draft gate)**: User lands on the edit page, makes tweaks, clicks "Make public." This replaces the current multi-step pre-publish wizard. Simpler, fewer abandoned uploads.
- **Polling over SSE/websockets**: 3-second poll is simple, stateless, and reliable across corporate firewalls and CDN edges. Latency is acceptable (user just ran a skill that took 30-90s; waiting another 3s is not the bottleneck).
- **Drag-drop fallback stays**: Zero-maintenance fallback for edge cases (borrowed laptop, terminal issues, CI-like environments). Not deprecated.
- **Hashed token storage server-side**: Standard practice. Even if the database leaks, tokens can't be replayed.

## Dependencies / Assumptions

- **Verified against codebase** (2026-04-22):
  - `POST /api/upload` currently requires NextAuth session (`src/app/api/upload/route.ts:55`). Extending it to accept bearer auth is additive.
  - The `/r/<slug>/edit` page already supports redactions, project linking, section hiding, and title editing. Adding a "Make public" button is the only net-new UI affordance.
  - The `InsightReport` Prisma model currently has no `isDraft` column. Adding one is a straightforward migration (nullable boolean defaulting to `false` for existing rows to preserve visibility, and `true` for all new bearer-token uploads).
  - The skill's extract script currently prints the report's absolute path as its final stdout line (`extract.py:3101`). `SKILL.md` documents this contract (line 65). Changing the final-line semantics under `--publish` requires a coordinated update to both.
- Plaintext in `~/.claude/insight-harness/config.json` with mode `0600` is acceptable to the user (confirmed).
- The existing `/r/<slug>/edit` page's auth check already 404s for non-owners — needs verification during planning.

## Outstanding Questions

### Resolve Before Planning

_(none — all planning-blocking design choices are now specified in the requirements above. The items in "Deferred to Planning" below are implementation-level questions that a planner can answer from the codebase or with a short investigation; they don't require product-level input.)_

### Deferred to Planning

- [Affects R7, R9a][Technical] `isDraft` as a boolean column vs. `publishedAt` timestamp (draft == null) vs. a separate model: the choice is mechanical once R9a's "filter every reader" requirement is accepted. Boolean + `publishedAt DateTime?` is probably cleanest (visibility filter is `publishedAt IS NOT NULL OR userId = :viewer`). Planning picks.
- [Affects R6][Technical] Bearer-auth plumbing pattern — middleware before NextAuth, in-handler helper, or a unified `auth()` wrapper that tries bearer then falls back to session. Planning picks whichever is most consistent with the app's existing patterns.
- [Affects R12, R13, R14a][Needs research] Rate-limit + idempotency store. Does the app already use Upstash/Redis? If yes, use it. If not, the `(userId, uploadId)` idempotency map and the sliding-window counters can live in Postgres with a cleanup job — fine at this scale.
- [Affects R22][Design] Unauth landing state copy + preview asset. Not blocking planning of the architecture; a separate design pass can ship the page polish after the plumbing lands.
- [Affects R21][Technical] Non-TTY detection in the skill (`sys.stdin.isatty()` inside Claude Code's background bash context). Planning verifies during skill-side implementation.
- [Affects R18][Technical] `SKILL.md` final-line contract under `--publish`. Options: version the contract via a new section in `SKILL.md`, or print a structured prefix (`RESULT: <url>` vs. `RESULT: <path>`) so consumers can disambiguate. Planning picks.
- [Affects R2][Technical] Selector length and entropy for `ih_<selector>_<secret>`. 12 chars base62 gives ~71 bits of selector entropy, 32 chars gives ~190 bits of secret entropy — overkill, but standard. Planning can dial down if desired without changing the shape.

## Next Steps

→ `/ce:plan` for structured implementation planning
