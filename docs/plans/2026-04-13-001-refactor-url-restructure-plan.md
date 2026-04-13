---
title: "refactor: Restructure URLs to username-scoped reports and root profiles"
type: refactor
status: active
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-url-restructure-requirements.md
---

# URL Restructure — Username-Scoped Reports and Root Profiles

## Overview

Move report pages from `/insights/[slug]` to `/insights/[username]/[slug]`, move profile pages from `/u/[username]` to `/[username]`, and delete the `/u/` route. Slug storage drops the username prefix (stores tail only, unique per user). A reserved-username allowlist blocks GitHub users whose login would collide with a top-level app route. All internal link-building funnels through two new helpers.

## Problem Frame

Report URLs today hide the author behind a composite slug (`craig-20260412-a4f2`). Profile URLs carry a `/u/` prefix that has no product or technical justification. The product has no live users yet — a clean restructure now costs less than an SEO-preserving migration later. See origin brainstorm for decision rationale.

## Requirements Trace

All 19 requirements from the origin document map to implementation units below. Key groupings:

- **URL structure (R1–R6):** Units 4, 5
- **Slug storage (R7–R9):** Unit 2
- **Reserved username policy (R10–R13):** Unit 1
- **Username immutability (R14–R15):** Unit 1
- **Profile page (R16):** Unit 4
- **Call-site updates (R17–R18):** Units 3, 6
- **Routing precedence (R19):** Unit 4 (verified via test)

## Scope Boundaries

- **No migration logic.** Dev DB is wiped or manually fixed during local development. No 301 redirects. No `/u/` alias.
- **No profile redesign.** Route move only.
- **No username-change UI.** Immutable by design.
- **No OG image regeneration** beyond updating the route path. Existing PNG generation logic stays.
- **Does not modify the skill-showcase plan** (`docs/plans/2026-04-12-002-feat-skill-showcase-in-report-plan.md`). That plan renders on the report page regardless of URL shape — compatible with new structure.

## Context & Research

### Relevant Code and Patterns

- `src/lib/auth.ts` — NextAuth config. The `jwt` callback at line 10 is where the first-login `prisma.user.upsert` happens. This is the signup seam. It currently also updates username on every login (line 21) — must be removed per R13/R14 so the first-captured username is permanent.
- `src/app/api/insights/route.ts` line 20 — `generateSlug(username)` returns `${username}-${date}-${shortId}`. Change to return tail only.
- `prisma/schema.prisma` — `slug String @unique` on `InsightReport`. Change to composite `@@unique([authorId, slug])`.
- `src/app/insights/[slug]/` — page and edit subroute. Move to `src/app/insights/[username]/[slug]/`.
- `src/app/u/[username]/page.tsx` — move contents to `src/app/[username]/page.tsx`, delete `src/app/u/`.
- `src/app/api/insights/[slug]/` — 5 sub-routes (`route.ts`, `vote`, `highlight`, `annotations`, `comments`, `projects`). All move under `[username]/[slug]/`.
- `src/app/api/og/[slug]/route.tsx` — OG image endpoint. Moves to `[username]/[slug]/`.
- `src/app/api/users/[username]/route.ts` — existing users API, untouched.
- No URL-builder helper exists today. URLs are constructed inline in 12+ places (grep hits: `src/components/Header.tsx`, `InsightCard.tsx`, `ContributorRow.tsx`, `VoteButton.tsx`, `CommentSection.tsx`, pages, upload success redirect).

### Top-Level Route Segments (for reserved list)

Currently present: `api`, `insights`, `search`, `top`, `u`, `upload`. After this work: `api`, `insights`, `search`, `top`, `upload` (`u` deleted). Reserved list must cover present + near-term reserved words per R11.

### Institutional Learnings

- `docs/plans/2026-04-12-001-refactor-json-data-layer-plan.md` established the pattern of deleting old transport paths outright when the product hasn't launched. Same posture applies here — no dual-serve.

### External References

None needed. Next.js App Router dynamic-route precedence (static segments win over dynamic) is standard behavior; verified via the Unit 4 test rather than external docs.

## Key Technical Decisions

- **Signup seam: NextAuth `jwt` callback in `src/lib/auth.ts`.** Throw an auth error when the GitHub login hits the reserved list and the user doesn't yet exist. Existing users (shouldn't exist, but defensive) are unaffected.
- **Immutable username enforced at the callback.** Remove `username: username` from the `update` branch of the upsert. Keep `displayName` and `avatarUrl` syncing from GitHub.
- **Reserved allowlist as a single exported `Set<string>`** in `src/lib/reserved-usernames.ts`. Case-insensitive match. Imported by the auth callback.
- **Slug tail format: `{YYYYMMDD}-{6-char-base36}`.** Same entropy as today minus the username prefix.
- **Composite unique index on `(authorId, slug)`.** Drops the global `@unique` on slug.
- **URL helpers in `src/lib/urls.ts`**: `buildReportUrl(username, slug)`, `buildProfileUrl(username)`, `buildReportApiUrl(username, slug)`, `buildReportEditUrl(username, slug)`, `buildOgImageUrl(username, slug)`. Pure functions, no IO, trivially testable.
- **Route move via rename, not dual-serve.** Next.js App Router picks routes up from filesystem — moving `[slug]` under `[username]/` is a directory reorg.
- **Grep-driven call-site audit.** Single pass to find every hardcoded `/insights/` or `/u/` URL construction and replace with the helpers.
- **Dev DB wiped with `prisma migrate reset`.** No data-migration script. Any local state is disposable.

## Open Questions

### Resolved During Planning

- **OG path shape:** `/api/og/[username]/[slug]` matches the rest of the restructure. Consistent layout wins over minimal diff.
- **Dev data cleanup:** `prisma migrate reset` in local development. No one-off script.
- **Auth-callback hook location:** `src/lib/auth.ts`, inside the `jwt` callback's upsert — reject before `prisma.user.upsert` runs with `create` semantics.
- **Route precedence verification:** Next.js App Router guarantees static routes beat dynamic ones at the same level. Add a unit test that requests `/search` while a user named "search" somehow exists (shouldn't happen due to reserved list, but the test documents the guarantee).

### Deferred to Implementation

- Exact copy for the reserved-username rejection error shown to the user on the login page
- Whether to keep `src/app/(auth)/login/page.tsx` unchanged or surface the rejection as a banner vs a toast
- Whether the URL helpers should live in `src/lib/urls.ts` or `src/lib/url-builders.ts` — cosmetic
- How to handle comment / highlight / vote API URLs constructed in the client: helpers vs template strings in one place

## High-Level Technical Design

> _This illustrates the intended approach and is directional guidance for review, not implementation specification._

```
Signup path (GitHub OAuth → NextAuth → Prisma)
────────────────────────────────────────────────
GitHub profile.login
   │
   ▼
src/lib/auth.ts jwt() callback
   │
   ├── is user already in DB?  ── yes ──▶ proceed, DO NOT update username
   │
   └── no → check reserved-usernames.ts
            │
            ├── match (case-insensitive) ──▶ throw Error → auth fails
            └── no match ──▶ create user, cache username on token

Request path (route resolution)
────────────────────────────────────────────────
GET /search        → src/app/search/page.tsx (static wins)
GET /craig         → src/app/[username]/page.tsx
GET /insights/craig/20260412-a4f2   → src/app/insights/[username]/[slug]/page.tsx
GET /insights/craig-20260412-a4f2   → 404 (no matching route)
GET /u/craig                         → 404 (route deleted)

Slug storage
────────────────────────────────────────────────
DB:   InsightReport { authorId, slug: "20260412-a4f2", @@unique([authorId, slug]) }
URL:  buildReportUrl(user.username, report.slug)
      → "/insights/craig/20260412-a4f2"
```

## Implementation Units

- [ ] **Unit 1: Reserved username allowlist and immutability enforcement**

  **Goal:** Prevent signups with reserved GitHub usernames. Lock username to its first-captured value.

  **Requirements:** R10, R11, R12, R13, R14, R15

  **Dependencies:** None — can land first and independently.

  **Files:**
  - Create: `src/lib/reserved-usernames.ts`
  - Create: `src/lib/__tests__/reserved-usernames.test.ts`
  - Modify: `src/lib/auth.ts`
  - Modify: `src/app/(auth)/login/page.tsx` (surface rejection message — exact UX deferred)

  **Approach:**
  - Export a `RESERVED_USERNAMES` constant — `Set<string>` of lowercased reserved words. Initial list: `api`, `insights`, `search`, `top`, `u`, `upload`, `settings`, `login`, `logout`, `signup`, `about`, `pricing`, `admin`, `dashboard`, `docs`, `blog`, `help`, `terms`, `privacy`, `welcome`, `new`. Also covers route-group-flattened names (e.g., `(auth)/login` flattens to `/login`, which is already `login` in the list).
  - Export `isReservedUsername(candidate: string): boolean` that does a case-insensitive lookup.
  - In `src/lib/auth.ts` `jwt` callback, before the `prisma.user.upsert`, look up `findUnique({ githubId })`. If absent AND `isReservedUsername(username)` is true → signal rejection via the **`signIn` callback** rather than throwing from `jwt` (which NextAuth wraps as a generic `CallbackRouteError`, losing the reason). Concretely: move the reserved-name check into the `signIn` callback in `src/lib/auth.config.ts` and return `"/login?error=ReservedUsername"` (a redirect-to-path return value) so NextAuth preserves the error in the URL. The `jwt` callback does not need to change for this.
  - In the `jwt` callback's upsert, change the `update` branch: remove `username: username` so the username field is never overwritten. Keep `displayName` and `avatarUrl` as-is (those can sync from GitHub).
  - The login page reads `searchParams.error` and, when it equals `ReservedUsername`, renders a clear message ("This GitHub username matches a reserved app route. Contact support if you need an exception."). Exact copy deferred.

  **Patterns to follow:**
  - Existing `jwt` callback structure in `src/lib/auth.ts`
  - Error handling pattern in `src/app/(auth)/login/page.tsx` (if existing error surfacing is present)

  **Test scenarios:**
  - Happy path: `isReservedUsername("craig")` → false; `isReservedUsername("api")` → true; `isReservedUsername("API")` → true (case-insensitive)
  - Edge case: empty string, whitespace-only, unicode → false (not in set)
  - Edge case: reserved list contains every current top-level route segment from `src/app/`, including route-group-flattened segments (e.g., `src/app/(auth)/login/` → `login` must be in the list). Test walks the directory tree, extracts flattened paths (stripping `(group)` segments), and asserts every public top-level path has a reserved-list entry. Catches drift automatically.
  - Integration (signIn callback): GitHub profile with `login: "search"` and no existing user row → signIn returns redirect to `/login?error=ReservedUsername`; no user row created
  - Integration (signIn callback): GitHub profile with `login: "craig"` and no existing user row → signIn returns true; `jwt` callback upsert creates the user
  - Integration (auth.ts): GitHub profile with `login: "craig"` and existing row where username is `"craig"` — GitHub login changes to `"cdossantos"` → user row's username remains `"craig"` (immutability verified)
  - Integration (login page): visit `/login?error=ReservedUsername` → distinguishable rejection message renders

  **Verification:**
  - All tests pass
  - Manual: sign in with a GitHub test account whose login is a reserved word → rejected. Sign in with a normal account → accepted.

- [ ] **Unit 2: Schema change — slug becomes per-user unique, prefix removed from generation**

  **Goal:** Slug stores only the tail. Per-user uniqueness enforced at the DB level. Generator emits tail-only slugs.

  **Requirements:** R7, R8, R9

  **Dependencies:** Unit 1 (not strict, but convenient to land after auth is stable so dev accounts can be recreated cleanly)

  **Files:**
  - Modify: `prisma/schema.prisma`
  - Create: `prisma/migrations/YYYYMMDDHHMMSS_slug_per_user_unique/migration.sql` (generated by `prisma migrate dev`)
  - Modify: `src/app/api/insights/route.ts` — `generateSlug` function
  - Modify: `prisma/seed.ts` — remove username prefix from seed slugs; update `upsert({ where: { slug } })` calls to use the composite key `{ authorId_slug: { authorId, slug } }`
  - Modify: `prisma/seed-demos.ts` — same updates as `seed.ts`
  - Modify: `prisma/seed-helpers.ts` — if it exposes a slug generator, update to match `generateSlug()` behavior
  - Modify: `src/app/api/insights/__tests__/put.test.ts` and other tests that reference slug shape

  **Approach:**
  - Edit `prisma/schema.prisma` `InsightReport` model: remove `@unique` from `slug String @unique`; add `@@unique([authorId, slug])` at the bottom of the model.
  - Run `prisma migrate dev` in local dev. Note: existing dev rows do NOT necessarily violate the new composite constraint (global unique is stricter), so the schema change itself migrates cleanly — the real issue is that existing rows still carry the old `{username}-{date}-{short}` prefix in their slug column. Use `prisma migrate reset` to wipe and re-seed with the new tail-only format.
  - Change `generateSlug(username)` to `generateSlug()` (or keep signature but ignore username) and return `${YYYYMMDD}-${6-char-base36}`. Slug generation no longer needs username.
  - Update the POST handler at line 249 in `src/app/api/insights/route.ts` to call the new generator and pass the tail slug.
  - Update `prisma/seed.ts` and `prisma/seed-demos.ts`: both currently call `prisma.insightReport.upsert({ where: { slug } })` with prefixed slugs. Change to `upsert({ where: { authorId_slug: { authorId, slug } } })` and drop the username prefix from generated slugs.
  - Update any test fixture that asserts the `{username}-` prefix in slug.

  **Patterns to follow:**
  - Existing Prisma composite-unique usage in `ReportProject` (`@@unique([reportId, projectId])`)
  - Existing migration file structure under `prisma/migrations/`

  **Test scenarios:**
  - Happy path: create two reports for the same user → second fails with unique-constraint error
  - Happy path: create reports for two different users with the same slug tail → both succeed
  - Happy path: `generateSlug()` returns a tail matching `/^\d{8}-[a-z0-9]{6}$/`
  - Edge case: two calls to `generateSlug()` within the same millisecond → different tails (random entropy)
  - Integration: POST `/api/insights` as user `craig` → creates a row with slug like `20260413-a4f2b1`, NOT `craig-20260413-a4f2b1`
  - Test expectation: existing slug-shape assertions in put/route tests updated to new format

  **Verification:**
  - `npx prisma migrate dev` succeeds
  - `npx prisma validate` passes
  - Create two dev reports for one user — second fails on constraint
  - `tsc --noEmit` passes

- [ ] **Unit 3: URL builder helpers**

  **Goal:** Single module that constructs every report and profile URL in the app. Any future URL change becomes a one-file edit.

  **Requirements:** R17, R18

  **Dependencies:** None — can land in parallel with Unit 1 or 2.

  **Files:**
  - Create: `src/lib/urls.ts`
  - Create: `src/lib/__tests__/urls.test.ts`

  **Approach:**
  - Export pure functions:
    - `buildReportUrl(username: string, slug: string): string` → `/insights/{username}/{slug}`
    - `buildProfileUrl(username: string): string` → `/{username}`
    - `buildReportEditUrl(username, slug): string` → `/insights/{username}/{slug}/edit`
    - `buildReportApiUrl(username, slug): string` → `/api/insights/{username}/{slug}`
    - `buildReportSubResourceApiUrl(username, slug, subpath): string` → `/api/insights/{username}/{slug}/{subpath}` for `vote`, `highlight`, `comments`, `annotations`, `projects`, `projects/[projectId]`
    - `buildOgImageUrl(username, slug): string` → `/api/og/{username}/{slug}`
  - Encode path segments with `encodeURIComponent` defensively (usernames are GitHub-validated, but defense-in-depth).
  - No trailing slashes. No absolute URLs unless a variant is specifically needed (e.g., for share meta tags — add `buildAbsoluteReportUrl` only if call sites demand it; defer until Unit 6 reveals need).

  **Patterns to follow:**
  - Pure helper modules like `src/lib/harness-section-visibility.ts` — no IO, tested standalone

  **Test scenarios:**
  - Happy path: each helper produces the documented shape for normal inputs
  - Edge case: slug with unusual base36 chars → unchanged
  - Edge case: username with capital letters → preserved (GitHub allows mixed case; URL is case-sensitive as far as Next.js is concerned — document and test the current behavior)
  - Edge case: empty slug or username → returns URL with empty segment (don't silently fix; caller's responsibility — test documents this contract)
  - Consistency: `buildReportUrl` output is a valid substring prefix of `buildReportEditUrl` output

  **Verification:**
  - `tsc --noEmit` passes
  - 100% line coverage on the helper (trivial given the module size)

- [ ] **Unit 4: Move page routes — reports, profile, delete `/u/`**

  **Goal:** Relocate filesystem routes. Reports move from `src/app/insights/[slug]/` to `src/app/insights/[username]/[slug]/`. Profile moves from `src/app/u/[username]/` to `src/app/[username]/`. The `src/app/u/` directory is deleted.

  **Requirements:** R1, R2, R3, R6, R16, R19

  **Dependencies:** Unit 2 (slug storage change), Unit 3 (helpers available for any in-page URL construction)

  **Files:**
  - Move: `src/app/insights/[slug]/page.tsx` → `src/app/insights/[username]/[slug]/page.tsx`
  - Move: `src/app/insights/[slug]/edit/page.tsx` → `src/app/insights/[username]/[slug]/edit/page.tsx`
  - Move: `src/app/insights/[slug]/layout.tsx` (if present) → new location
  - Move: `src/app/insights/__tests__/edit-flow.test.ts` → updated route paths inside the file
  - Move: `src/app/u/[username]/page.tsx` → `src/app/[username]/page.tsx`
  - Delete: `src/app/u/` directory
  - Create: `src/app/[username]/__tests__/route-precedence.test.ts` (verifies static routes win)

  **Approach:**
  - Filesystem reorganization; Next.js App Router reads routes from directories.
  - **All three moved pages are client components (`"use client"`) using `useParams()` from `next/navigation`, not server `params` props.** Concretely:
    - `src/app/insights/[slug]/page.tsx` → at top: `const { slug } = useParams()`. After move, read both: `const { username, slug } = useParams() as { username: string; slug: string }`.
    - `src/app/insights/[slug]/edit/page.tsx` → same pattern.
    - `src/app/u/[username]/page.tsx` → already reads `username` via `useParams()`; no change needed after move.
  - **Data fetching is client-side** (fetch to `/api/insights/${slug}`, not server Prisma queries). Update each fetch URL to the new shape: `fetch(buildReportApiUrl(username, slug))` using the Unit 3 helper.
  - **Add a server wrapper at `src/app/[username]/layout.tsx`** (or rename the page to a `page.tsx` with `notFound()` branch using `useParams` + a client fetch returning 404). Why: the current `/u/[username]/page.tsx` client component renders a "No user found" message at HTTP 200 when the user doesn't exist. Moved to root `/[username]`, that makes EVERY unknown URL (typos, bad links) serve a soft-404 instead of a real 404 — bad for SEO and UX. Options: (a) convert the page to a server component that calls `prisma.user.findUnique({ where: { username } })` and invokes `notFound()` on miss, (b) add a server `layout.tsx` wrapper that does the same check and renders `notFound()` before the client page mounts. Pick (a) if the profile page's data needs can be server-rendered cleanly; pick (b) if preserving the current client-side implementation matters. Decide during implementation — surface the choice in the PR description.
  - Route precedence tests: hit `/search`, `/top`, `/upload`, and `/login` (a route-group-flattened path from `src/app/(auth)/login/`). All must resolve to their static routes, not `[username]`. Covers the route-group case flagged by review.
  - Delete `src/app/u/` entirely once the move is verified. Confirm no stale imports reference it via grep.

  **Patterns to follow:**
  - Existing nested dynamic route shape (none exists — this is the first multi-segment dynamic route; follow Next.js App Router docs)

  **Test scenarios:**
  - Happy path: `GET /insights/craig/20260413-a4f2b1` → renders the report for user craig with slug 20260413-a4f2b1
  - Happy path: `GET /craig` → renders profile for user craig (same component tree as former /u/craig)
  - Edge case: `GET /insights/craig` (missing slug) → 404
  - Edge case: `GET /insights/craig/nonexistent-slug` → 404
  - Edge case: `GET /u/craig` → 404 (route deleted)
  - Edge case: `GET /search`, `/top`, `/upload`, `/login` — all static or route-group-flattened top-level routes — resolve to their respective static pages, not the `[username]` page. Route-precedence test covers all four.
  - Edge case: user with the same slug tail as another user → each `/insights/{username}/{slug}` resolves to its own report
  - Edge case (soft-404 prevention): `GET /nonexistent-username-xyz` returns HTTP 404 (not 200 with a "no user found" shell). Asserted against response status, not just body content.
  - Integration: edit flow test (moved fixture) — navigate to edit URL with both params, save, verify data round-trips

  **Verification:**
  - `npm run build` succeeds; Next.js build logs show new route paths
  - Dev server: manually hit each new URL
  - `src/app/u/` no longer exists
  - Grep for `/u/` in `src/` returns no matches outside code comments

- [ ] **Unit 5: Move API routes**

  **Goal:** Mirror the page-route restructure on the API side. Every `/api/insights/[slug]/...` route moves under `[username]/[slug]/`.

  **Requirements:** R4, R5

  **Dependencies:** Unit 2

  **Files:**
  - Move: `src/app/api/insights/[slug]/route.ts` → `src/app/api/insights/[username]/[slug]/route.ts`
  - Move: `src/app/api/insights/[slug]/vote/route.ts` → `.../[username]/[slug]/vote/route.ts`
  - Move: `src/app/api/insights/[slug]/highlight/route.ts` → same pattern
  - Move: `src/app/api/insights/[slug]/annotations/route.ts` → same pattern
  - Move: `src/app/api/insights/[slug]/comments/route.ts` → same pattern
  - Move: `src/app/api/insights/[slug]/projects/route.ts` → same pattern
  - Move: `src/app/api/insights/[slug]/projects/[projectId]/route.ts` → same pattern
  - Move: `src/app/api/og/[slug]/route.tsx` → `src/app/api/og/[username]/[slug]/route.tsx`
  - Move: all `__tests__/` subdirectories with their route files
  - Update each handler's `params` signature from `{ slug }` to `{ username, slug }`
  - Update each handler's data lookup from `findUnique({ where: { slug } })` to scoped lookup via author relation

  **Approach:**
  - Same filesystem reorg as Unit 4 but on the API side.
  - For each handler: add a helper (possibly in `src/lib/insight-lookup.ts` — decide during implementation whether it's worth extracting) that takes `{ username, slug }` and returns the report or null. Each route uses the helper.
  - Error handling: if the username segment is valid but the slug doesn't exist for that user → 404 (same as today for unknown slug).
  - The GET route continues to apply `stripHiddenHarnessData` per the skill-showcase plan (cross-plan integration — if Unit 5 lands first, skill-showcase plan's Unit 5 is unaffected; if skill-showcase lands first, this unit preserves that call).

  **Patterns to follow:**
  - Existing handler patterns in `src/app/api/insights/[slug]/*`
  - Existing param-destructuring style

  **Test scenarios:**
  - Happy path: `GET /api/insights/craig/20260413-a4f2b1` → 200 with report data
  - Happy path: `POST /api/insights/craig/20260413-a4f2b1/vote` → vote recorded
  - Happy path: `GET /api/og/craig/20260413-a4f2b1` → PNG response
  - Edge case: slug exists but belongs to a different user → 404 (scoped lookup prevents cross-user access via URL hacking)
  - Edge case: `GET /api/insights/[slug]` (old shape) → 404, no server error
  - Regression: tests migrated from `[slug]/__tests__/` produce equivalent assertions with new param shape
  - Integration: OG image generation still works with new params

  **Verification:**
  - `npm test` passes
  - Manual: curl each endpoint against a local dev server with a seed report

- [ ] **Unit 6: Call-site audit and helper adoption**

  **Goal:** Every component, page, and test that constructs a report or profile URL uses the helpers from Unit 3. No hardcoded `/insights/` or `/u/` strings remain.

  **Requirements:** R17, R18

  **Dependencies:** Units 3, 4, 5

  **Files (audit scope):**
  - Modify: `src/components/Header.tsx` (dropdown profile link currently `/u/${username}`; mobile nav same)
  - Modify: `src/components/InsightCard.tsx`
  - Modify: `src/components/ContributorRow.tsx`
  - Modify: `src/components/VoteButton.tsx`
  - Modify: `src/components/CommentSection.tsx`
  - Modify: `src/components/EyeToggle.tsx`
  - Modify: `src/app/page.tsx`
  - Modify: `src/app/search/page.tsx`
  - Modify: `src/app/top/page.tsx`
  - Modify: `src/app/upload/page.tsx` (success redirect + preview URL references)
  - Modify: `src/app/api/insights/route.ts` (POST response includes URL — use helper)
  - Modify: `src/app/insights/[username]/[slug]/page.tsx` (moved in Unit 4 — now must use helpers for any internal fetches and share-URL construction, including `fetch(\`/api/insights/${slug}\`)`patterns which become`fetch(buildReportApiUrl(username, slug))`)
  - Modify: `src/app/insights/[username]/[slug]/edit/page.tsx` (same — client fetches to sub-resource endpoints like `/api/insights/${slug}/projects` need both segments)
  - Modify: `src/app/[username]/page.tsx` (moved profile page — any internal links)
  - Modify: any share-button component from PR #62
  - Modify: OG-card callers from PR #58
  - Possibly modify: test files that assert URL shape

  **Approach:**
  - Start with a grep sweep for `"/insights/"`, `"/u/"`, `` `/insights/ ``, `` `/u/ ``, and `$\{...slug` template literal patterns. Enumerate every match.
  - Replace each with the appropriate helper import + call. Every site that previously built a report URL now takes both `username` and `slug` (where it previously passed only `slug`, pass `report.author?.username` or equivalent).
  - This means many components' props expand to include `username`. Propagate through call chains. The added prop is always present because reports are always fetched with their author.
  - Tests that literally asserted URL strings get updated to the new shape. Tests that exercise the URL as input continue to pass because URLs resolve through the new routes.
  - Final sweep: grep confirms no remaining hardcoded `/insights/` or `/u/` patterns in `src/` outside comments and the helper module itself.

  **Patterns to follow:**
  - The helper signatures defined in Unit 3

  **Test scenarios:**
  - Happy path: `InsightCard` renders with `href={buildReportUrl(username, slug)}`
  - Happy path: upload success redirect lands on `/insights/{username}/{slug}`, not a 404
  - Happy path: share button produces a URL that, when fetched, resolves to the report
  - Regression: existing component tests pass with the added `username` prop
  - Audit verification: `grep -rn "\"/u/" src/` returns no matches; `grep -rn "\"/insights/\`" src/` returns only the helper and its tests

  **Verification:**
  - `npm run build` succeeds
  - Manual: click through every page — profile card, report card, share button, upload success — confirm all URLs resolve
  - Final grep confirms no hardcoded URL construction remains

## System-Wide Impact

- **Interaction graph:** Route moves cascade through every link-producing component. No runtime behavior changes beyond the URL shape and the scoped DB lookup.
- **Error propagation:** Cross-user URL probing (`/insights/alice/craig-slug-id`) returns 404 instead of leaking another user's report. This is a privacy improvement over global slug lookup.
- **State lifecycle risks:** Dev DB reset wipes local state. Document in the unit 2 PR description so reviewers aren't surprised.
- **API surface parity:** Every `/api/insights/*` endpoint changes shape. Any external consumer (there are none today) would break. Publicly documented API surface: none.
- **Integration coverage:** End-to-end click-through test exercises the full chain — login, upload, view, share, edit — against the new URLs.
- **Unchanged invariants:** `InsightReport`'s semantic data, `User`'s identity model (still keyed by `githubId`), the OG image pixel output, the report's rendered HTML content, the skill-showcase plan's rendering logic (it renders on the report page at whatever path that page lives at).

## Risks & Dependencies

| Risk                                                                                                                             | Mitigation                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A reserved-username edge case (e.g., a future route added after deploy) silently breaks signup for a user with that GitHub login | Unit 1 test scans `src/app/` and asserts every top-level segment is in the reserved list — catches drift automatically                                                                                                           |
| Composite unique index migration fails on a dirty dev DB                                                                         | `prisma migrate reset` documented in Unit 2; rollback plan is `git revert` + `prisma migrate reset`                                                                                                                              |
| A component is missed in the grep sweep and ships with a broken URL                                                              | Final grep verification step in Unit 6 fails the PR if any `"/u/"` or hardcoded `"/insights/"` template literal remains                                                                                                          |
| Next.js App Router route precedence differs from expectation for nested dynamic segments                                         | Unit 4 test validates the concrete precedence before merging                                                                                                                                                                     |
| The skill-showcase plan (2026-04-12-002) ships first and its Unit 5 conflicts with Unit 5 here                                   | Both units modify `src/app/api/insights/[slug]/route.ts`. Coordinate by merging this plan first OR rebasing the skill-showcase plan; the changes compose (showcase's stripHiddenHarnessData call lives inside the moved handler) |
| A user whose GitHub login changes after signup ends up with a URL mismatch between their profile identity and their account      | Accepted per R14 — username is immutable; support handles rename requests manually                                                                                                                                               |
| The root-level `/[username]` route accidentally shadows a future top-level route a dev adds without updating the reserved list   | Reserved-list drift test in Unit 1 runs on every CI build; a new top-level segment without a reserved-list update fails CI                                                                                                       |

## Documentation / Operational Notes

- Update the README or contributor docs if URL shape is referenced anywhere
- No env var changes
- No Vercel / infra configuration changes
- Sitemap regenerates automatically on deploy (if sitemap generation exists — check during planning; not a requirement of this plan)
- Announce the reserved-list mechanism in CLAUDE.md or an `AGENTS.md` under Invariants so future contributors know why new top-level routes also need a reserved-list entry

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-13-url-restructure-requirements.md](../brainstorms/2026-04-13-url-restructure-requirements.md)
- **Adjacent plan (compatible):** [docs/plans/2026-04-12-002-feat-skill-showcase-in-report-plan.md](2026-04-12-002-feat-skill-showcase-in-report-plan.md)
- **Related code:** `src/lib/auth.ts`, `src/app/api/insights/route.ts`, `prisma/schema.prisma`, `src/app/insights/[slug]/`, `src/app/u/[username]/`, `src/app/api/insights/[slug]/` subtree, `src/app/api/og/[slug]/`
- **PRs affecting link-producing components:** #58 (home share card), #62 (share buttons), #63 (featured card metrics) — grep these PRs' touched files during Unit 6 audit
