---
title: "feat: Persistent user-owned projects and rich link previews"
type: feat
status: active
date: 2026-04-10
origin: docs/superpowers/specs/2026-04-10-persistent-projects-and-link-previews-design.md
---

# feat: Persistent user-owned projects and rich link previews

## Overview

Move project links from report-owned to user-owned so users can maintain a project library that persists across reports, then fetch Open Graph metadata for live URLs and render a stacked rich-card layout. Both features ship in one PR because they touch the same `ProjectLinks` component and the same data reshape.

**Target branch:** `feat/persistent-projects` (worktree at `.worktrees/feat/persistent-projects`, branched off `feat/insightful-mvp`).

## Problem Frame

Today, `ProjectLink` is owned by `InsightReport`. Every new report forces the user to re-enter projects from scratch, and the rendered card is text-only with no visual even when the `liveUrl` points to a site with perfectly good OG metadata. Users want edits to propagate retroactively, projects to persist in a library, and live-site cards to look like a real link preview (image, title, description, favicon).

See origin: `docs/superpowers/specs/2026-04-10-persistent-projects-and-link-previews-design.md` for the full rationale and all seven locked design decisions.

## Requirements Trace

- **R1.** Users have a persistent project library; editing a Project propagates to every report referencing it (see origin: Decision 1)
- **R2.** `ProjectLink` is dropped and rewritten — no data migration because there are no real users yet (see origin: Decision 2)
- **R3.** OG metadata is fetched synchronously on Project create/edit, cached on the row, with a manual refresh button (see origin: Decision 3)
- **R4.** UI exposes exactly two actions: hide-from-this-report (per-report) and delete-from-library (global) (see origin: Decision 4)
- **R5.** Project editing happens inside the upload flow only; no standalone library page in v1 (see origin: Decision 5)
- **R6.** Project hide/delete lives on `/insights/[slug]/edit`, reachable via a new "Edit Report" button on the profile page (see origin: Decision 6)
- **R7.** Project card is a stacked layout (image on top, text below) with graceful text-only fallback when `ogImage` is null (see origin: Decision 7)
- **R8.** Metadata fetcher has SSRF protection, content-type guard, and a 2MB response size cap (see origin: Security section)
- **R9.** Metadata is atomically cleared before a re-fetch on `liveUrl` change so a failed fetch cannot leave stale data from the old URL (see origin: API Routes)

## Scope Boundaries

**Explicitly NOT in this plan:**

- Standalone `/profile/projects` library management page
- Drag-to-reorder projects within a report
- Downloading `ogImage` to blob storage (store the URL only)
- GitHub URL metadata fetching (skipped in v1 — github.com OG images are generic repo cards)
- Background TTL-based metadata refresh (manual refresh button only)
- Per-report description overrides for the same Project (requires a snapshot model — rejected in Decision 1)
- Migrating existing `ProjectLink` rows in production (dropped outright — no real users)
- A detach-only endpoint ("remove from this report but keep in library") — explicitly cut during brainstorming as too complex

## Context & Research

### Relevant Code and Patterns

**API route conventions:**

- `src/app/api/insights/[slug]/route.ts` — canonical auth/ownership/validation/response-shape pattern
- `src/app/api/insights/[slug]/projects/route.ts:5-58` — current `ProjectLink` POST handler (will be deleted and replaced)
- Pattern order in every mutating route: `auth()` → 401 → `findUnique` → 404 → ownership check → 403 → validate body → mutate → respond. All wrapped in `try/catch` logging `console.error("METHOD /path error:", err)` and returning `{ error: string }` + 500.
- Response shape: success = `NextResponse.json({ data: <payload> }, { status: 200|201 })`; error = `NextResponse.json({ error: "..." }, { status })`. Client unwraps with `data.data ?? data`.
- **Next.js 15+ dynamic params are a Promise** — routes must `await params` before destructuring. See `src/app/api/insights/[slug]/route.ts` for reference.
- **Validation:** house style is manual `typeof` / `.trim()` checks, not zod. The spec mentioned zod speculatively — this plan matches house style instead.

**Prisma conventions:**

- Client import: `import { prisma } from "@/lib/db"` (singleton in `src/lib/db.ts`)
- Cascade pattern: `onDelete: Cascade` on the relation field (see `SectionVote`, `SectionHighlight`, `Comment`, `AuthorAnnotation` in `prisma/schema.prisma`)
- Migration convention: dated directory `prisma/migrations/YYYYMMDD_snake_case/migration.sql` matching existing `20260402_init`
- Postgres — `String` already maps to `TEXT`, no varchar limits, so no `@db.Text` annotation needed for long URLs

**Upload flow state** (`src/app/upload/page.tsx`):

- Step 2 state lives in `useState<ProjectLinkInput[]>` at line 362
- Publish handler `handlePublish` at line 462 builds one big JSON body and POSTs to `/api/insights`, including `projectLinks` inline at line 537
- **Implication:** rather than moving project creation to a separate post-publish call (partial-failure window), this plan keeps the create-report-and-attach-projects path atomic by sending `projectIds: string[]` inline in the same `POST /api/insights` call.

**EyeToggle component:**

- Currently inline in `src/app/insights/[slug]/edit/page.tsx:68-84` — takes `{ enabled: boolean; onToggle: () => void }`, renders `Eye`/`EyeOff` lucide icons
- Plan extracts this to `src/components/EyeToggle.tsx` so both the narrative-section hide and the new per-project hide can reuse it

**Rendering conventions:**

- Avatars use `next/image` with a strict `remotePatterns` allowlist in `next.config.ts` (lines 7-16) — only `api.dicebear.com` and `avatars.githubusercontent.com` are permitted
- **OG images come from arbitrary hosts → must use plain `<img>`**, not `next/image`. The spec already specifies this; do not "upgrade" during implementation.
- No CSP/middleware blocks external `<img>` requests, so runtime `onError` fallback works

**Seed files:**

- `prisma/seed.ts:606` and `:616` — currently two hardcoded `prisma.projectLink.create` calls (the only existing seed of projects)
- `prisma/seed-demos.ts` — `harnessReport()` helper at line 152 does **not** touch projects today
- `prisma/seed-helpers.ts` — where unit-testable default computation helpers live (see learning below)

**ProjectLinks styling** (`src/components/ProjectLinks.tsx`, full file is 80 lines):

- Grid: `grid gap-3 sm:grid-cols-2`
- Card: `rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50`
- Text colors: `text-slate-900 dark:text-slate-100` (primary), `text-slate-500 dark:text-slate-400` (secondary)
- Links: `target="_blank" rel="noopener noreferrer"` — preserve on rewrite
- Icons from `lucide-react` (`GitFork`, `ExternalLink`, `Globe`)

**Test patterns:**

- `vitest.config.ts` — minimal (only `@` alias + `.worktrees/**` exclusion). No setupFiles, no jsdom by default
- **No existing route-handler test harness.** `src/app/api/insights/__tests__/put.test.ts` only tests an exported allowlist, not the handler itself. This plan establishes the `vi.mock("@/lib/db")` + `vi.mock("@/lib/auth")` pattern.
- `prisma/__tests__/seed-helpers.test.ts` is the reference for pure-helper unit tests (no DB)
- Component test precedent exists at `src/components/__tests__/WorkflowDiagram.test.tsx` — check environment setup before adding `ProjectLinks.test.tsx`

### Institutional Learnings (from `agent/MEMORY.md`)

- **Supabase migration history divergence** (2026-04-06): `prisma migrate dev` sometimes fails on Supabase; `prisma db push` is the escape hatch. Budget for either `migrate reset` or a `db push` fallback if `migrate dev` resists during implementation.
- **Vercel Prisma invariants** (2026-04-04): `binaryTargets = ["native", "rhel-openssl-3.0.x"]` required; default `@prisma/client` output path (no custom path); `prisma generate` must be in `package.json` build script. Verify all three are still in place before deploying.
- **NextAuth v5 session pitfalls** (2026-04-04, 04-06, 04-07): User upsert must happen in the `jwt` callback (not `signIn` event). Stale JWT sessions lack new fields — if this plan added a new `user.*` field, it would need a DB fallback in the `session` callback. This plan does NOT add new session fields, so no action needed, but flag it during review.
- **XSS via `dangerouslySetInnerHTML`** (2026-04-08): `harnessData` was removed from PUT allowedFields due to an XSS vector. This plan's spec already forbids `dangerouslySetInnerHTML` for OG fields — reinforces the rule.
- **Seed helpers live in `prisma/seed-helpers.ts`** (2026-04-10): Default-computation helpers were extracted there for unit testability. Any Project seed defaults in this plan go there too, not inline in `seed-demos.ts`.
- **Don't defer code review findings** (2026-04-07): Upload flow is high-risk; codex review and end-to-end QA the full publish flow before merge. Do NOT ship with deferred review action items.
- **SSRF is greenfield in this repo** (no prior learnings): the `fetchLinkPreview` helper in this plan becomes the institutional reference for the next person. Write it as a small testable module with a threat-model comment.

### External References

External research skipped (Phase 1.2) — local patterns are sufficient and SSRF mitigation is a well-known set of rules. The implementer should verify `unfurl.js` behavior during implementation; if it has issues with specific target sites, an alternative like `metascraper` or `link-preview-js` is an acceptable swap.

## Key Technical Decisions

1. **Match house validation style; do NOT add zod.** The spec mentioned zod, but repo research shows all existing routes use manual validation. Adding a dep for this one feature is unnecessary churn. Validation will use `typeof` / `.trim()` / URL parsing helpers, mirroring `src/app/api/insights/[slug]/projects/route.ts:33`.

2. **Attach projects inline in `POST /api/insights`, not in a post-publish call.** The spec showed `POST /api/insights/[slug]/projects` as the attach endpoint, but using it during initial publish creates a partial-failure window (report exists but projects don't). Instead, extend `POST /api/insights` to accept `projectIds: string[]` and create `ReportProject` rows in the same Prisma transaction. The `POST /api/insights/[slug]/projects` endpoint still exists for post-publish attach from the edit page.

3. **Extract `EyeToggle` to a shared component before touching the edit page.** It's currently inline at `src/app/insights/[slug]/edit/page.tsx:68-84`. Both the existing narrative-section hide and the new per-project hide need it — DRY it up first as a small refactor unit.

4. **Use plain `<img>` for `ogImage` and `favicon`, not `next/image`.** External OG hosts would require wildcarding `remotePatterns`, which defeats the allowlist. `<img>` with an `onError` handler is sufficient.

5. **Migration naming: `20260410_persistent_projects`** to match the dated-directory convention of `20260402_init`.

6. **`ReportProject.position` is a non-unique integer.** No `@@unique([reportId, position])` constraint — position is an ordering hint, not an invariant. Makes future reorder work simpler (no transaction dance with temp values).

7. **SSRF helper lives in `src/lib/link-preview.ts` alongside the fetcher** — one file, threat-model comment block at the top, exported `fetchLinkPreview(url)` plus an internal `isSafeUrl(url)` helper. Both are testable from `src/lib/__tests__/link-preview.test.ts`.

## Open Questions

### Resolved During Planning

- **zod vs manual validation?** Resolved: manual validation (Decision 1 above).
- **Attach projects in a separate call or inline?** Resolved: inline (Decision 2 above).
- **Will `next/image` work for OG images?** Resolved: no — `next.config.ts` has a strict allowlist. Use `<img>`.
- **Where does EyeToggle come from?** Resolved: extract it first as its own unit.
- **How do existing route handler tests mock Prisma/auth?** Resolved: they don't — this plan establishes the pattern (`vi.mock("@/lib/db")`, `vi.mock("@/lib/auth")`).

### Deferred to Implementation

- **Exact `unfurl.js` response shape** — read the library's types at implementation time and adapt the mapping from their fields to our DB columns. If fields are missing or inconsistent, fall back to `null` per field.
- **DNS resolution method for SSRF check** — probably `node:dns/promises.lookup()`, but the implementer should verify `unfurl.js` uses the same resolver so we can't be bypassed by a library-level DNS differential.
- **Migration mechanics on Supabase** — if `npx prisma migrate dev --name persistent_projects` fails due to history divergence, fall back to `prisma migrate reset` (local) or `prisma db push` (emergency). Local-dev only; production has no real users to protect.
- **Whether to extend `harnessReport()` in `seed-demos.ts` or add a sibling helper** — implementer's call based on how invasive the change looks when opened; both are acceptable as long as seed output reflects the new model.
- **Component test environment** — if `src/components/__tests__/WorkflowDiagram.test.tsx` doesn't use jsdom, adding a jsdom environment for `ProjectLinks.test.tsx` may or may not be needed. Resolve at implementation time.

## High-Level Technical Design

> _This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce._

**Data model reshape:**

```
BEFORE                          AFTER
┌──────────┐                    ┌──────┐      ┌─────────────┐      ┌──────────────┐
│  Report  │                    │ User │─────<│   Project   │>─────│ ReportProject│>────┐
│          │                    └──────┘      │  (library)  │      │  (junction)  │     │
│          │                                  └─────────────┘      │  hidden      │     │
│          │>────┐                                                 │  position    │     │
└──────────┘     │                                                 └──────────────┘     │
                 │                                                                       │
          ┌──────┴──────┐                                          ┌──────────────┐     │
          │ ProjectLink │                                          │   Report     │<────┘
          │  (dropped)  │                                          └──────────────┘
          └─────────────┘
```

**Publish flow sequence (simplified):**

```
User clicks Publish in upload Step 3
  ↓
Client sends POST /api/insights with
  { ...reportFields, projectIds: ["proj_A", "proj_B"] }
  ↓
Server (inside one Prisma transaction):
  1. Create InsightReport
  2. For each projectId, verify it's owned by session.user.id
  3. Create ReportProject rows with position = array index
  4. Return { data: { slug, ... } }
  ↓
Client redirects to /insights/{slug}
```

**Metadata fetch sequence:**

```
POST /api/projects { name, liveUrl, ... }
  ↓
Server:
  1. Parse + validate URL (scheme, syntax)
  2. DNS lookup → check all resolved IPs against blocklist
     (private ranges, loopback, link-local, 169.254.169.254)
  3. fetch(url, { signal: AbortController(4s), redirect: "manual" })
  4. If redirect, re-validate the Location against the blocklist, max 3 hops
  5. Check Content-Type ∈ {text/html, application/xhtml+xml}
  6. Stream body, abort once >2MB read
  7. unfurl.js parses HTML → { ogImage, ogTitle, ogDescription, favicon, siteName }
  8. On ANY failure, return null → save Project with null metadata
  9. Log failures with URL + reason
  ↓
Return { data: project }
```

## Implementation Units

Dependency summary:

- Unit 1 (schema + seed) blocks Units 3–8
- Unit 2 (link preview lib) blocks Units 3, 4
- Unit 5 (EyeToggle extract) blocks Unit 8
- Unit 6 (ProjectLinks rewrite) blocks Unit 8
- Units 3 and 4 block Unit 7 (upload flow needs both library + publish routes)

Suggested parallelization: Units 1, 2, 5 first (1 and 5 can start in parallel with 2 if a second agent is available); then 3, 4, 6 in parallel; then 7, 8 in parallel.

---

- [ ] **Unit 1: Schema migration + seed updates**

**Goal:** Introduce `Project` and `ReportProject` Prisma models, drop `ProjectLink`, regenerate the client, and update both seed files to create Projects under demo users and attach them via junction rows.

**Requirements:** R1, R2

**Dependencies:** None (starts first)

**Files:**

- Modify: `prisma/schema.prisma` — drop `ProjectLink` model (lines 86-95 today), drop the `projectLinks ProjectLink[]` relation on `InsightReport` (line 79), add `Project` and `ReportProject` models, add `projects Project[]` relation on `User`, add `reportProjects ReportProject[]` relation on `InsightReport`
- Create: `prisma/migrations/20260410_persistent_projects/migration.sql` — generated via `npx prisma migrate dev --name persistent_projects`
- Modify: `prisma/seed-helpers.ts` — add a `defaultProjectSeedFor(userSlug: string)` helper that returns a plausible Project shape based on the demo user's identity (testable, no PrismaClient)
- Modify: `prisma/seed-demos.ts` — update `harnessReport()` (or add a sibling helper) so that demo users get 1–3 Projects in their library, and each demo report gets `ReportProject` junction rows for a subset of those projects
- Modify: `prisma/seed.ts` — replace the two hardcoded `prisma.projectLink.create` calls (lines 606, 616) with `prisma.project.create` + `prisma.reportProject.create` pairs
- Test: `prisma/__tests__/seed-helpers.test.ts` — extend with tests for `defaultProjectSeedFor`

**Approach:**

- `Project` fields exactly as specified in the spec: `id`, `userId`, `name`, `description?`, `githubUrl?`, `liveUrl?`, plus metadata columns (`ogImage?`, `ogTitle?`, `ogDescription?`, `favicon?`, `siteName?`, `metadataFetchedAt?`), plus `createdAt`, `updatedAt`
- `ReportProject` fields: `id`, `reportId`, `projectId`, `hidden Boolean @default(false)`, `position Int @default(0)`, with `@@unique([reportId, projectId])` and indexes on both foreign keys
- Cascades: `User → Project → ReportProject` and `InsightReport → ReportProject`, both `onDelete: Cascade`
- No data migration needed (no real users per Decision 2)
- If `prisma migrate dev` fails locally due to Supabase history divergence, fall back to `prisma migrate reset` (acceptable — local only)
- Seed: create Projects BEFORE attaching them (user exists already in the seed, Project is a new child; ReportProject needs both parents first)

**Patterns to follow:**

- Existing cascade models: `SectionVote`, `SectionHighlight`, `Comment`, `AuthorAnnotation` in `prisma/schema.prisma`
- Migration dir convention: `prisma/migrations/20260402_init/`
- Seed helper pattern: existing helpers in `prisma/seed-helpers.ts`

**Test scenarios:**

- _Happy path:_ `defaultProjectSeedFor("jordan-demo")` returns an object with `name`, `description`, `githubUrl`, `liveUrl` all populated as non-empty strings
- _Happy path:_ `defaultProjectSeedFor` returns deterministic output for the same input (seed data must be reproducible)
- _Edge case:_ Unknown user slug returns a generic fallback Project, not `null` or error
- _Integration (manual):_ `npx prisma db push && npx tsx prisma/seed-demos.ts --cleanup && npx tsx prisma/seed-demos.ts` runs without error and demo users' detail pages still render

**Verification:**

- `npx prisma validate` passes
- `npx prisma format` leaves the schema stable
- Seed runs without errors and produces at least one Project per demo user plus junction rows
- `grep -r "projectLink" src/ prisma/` finds no references to the dropped model (cleanup guard — will flag other units' TODOs too)

---

- [ ] **Unit 2: Link preview library with SSRF guard**

**Goal:** Implement `src/lib/link-preview.ts` — a self-contained, testable module that fetches OG metadata from a URL with SSRF protection, content-type validation, response size limits, and a timeout. Returns `null` on any failure mode.

**Requirements:** R3, R8

**Dependencies:** None (pure lib, no DB)

**Files:**

- Create: `src/lib/link-preview.ts` — exports `fetchLinkPreview(url: string): Promise<LinkPreview | null>`; internal `isSafeUrl(url: string): Promise<boolean>`
- Test: `src/lib/__tests__/link-preview.test.ts`
- Modify: `package.json` — add `unfurl.js` as a dependency

**Execution note:** Start with a failing integration test that calls `fetchLinkPreview("http://127.0.0.1")` and asserts `null` (SSRF case) before writing implementation. This gives a strong safety anchor for the rest of the helper.

**Approach:**

- Top of file: threat-model comment block documenting the intent of the SSRF guard and what it does/doesn't protect against (DNS rebinding is the main residual risk — follow redirects manually and re-validate at each hop)
- `isSafeUrl` flow: parse URL → reject non-http(s) → `dns.lookup(hostname, { all: true })` → reject if any resolved address is in a blocked CIDR range
- Blocklist: `127.0.0.0/8`, `::1`, `169.254.0.0/16`, `fe80::/10`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `0.0.0.0`, `169.254.169.254` (explicit, belt-and-suspenders)
- `fetchLinkPreview` flow: `isSafeUrl` → `fetch` with `AbortController` (4s), `redirect: "manual"` → follow up to 3 redirects, re-validating each `Location` against `isSafeUrl` → check `Content-Type` header → stream response body, abort at 2MB → pass HTML to `unfurl.js` → map its fields to `LinkPreview` shape
- On ANY failure (SSRF reject, timeout, 4xx/5xx, content-type mismatch, size cap exceeded, parse error): log `console.warn("fetchLinkPreview failed:", { url, reason })` and return `null`
- Response type: `{ ogImage: string | null; ogTitle: string | null; ogDescription: string | null; favicon: string | null; siteName: string | null; }`

**Technical design:** _(directional guidance, not implementation specification)_

```
fetchLinkPreview(url):
  if not isSafeUrl(url): return null
  try:
    signal = AbortSignal.timeout(4000)
    response = await fetch(url, { signal, redirect: "manual" })
    for hop in 0..3:
      if response.status in (301, 302, 303, 307, 308):
        next = response.headers["location"]
        if not isSafeUrl(next): return null
        response = await fetch(next, { signal, redirect: "manual" })
      else: break
    if response.status not in 200..299: return null
    if content_type not in html_types: return null
    body = readAtMost(response.body, 2 * 1024 * 1024)
    parsed = unfurl(body)
    return mapFields(parsed)
  catch any: return null
```

**Patterns to follow:**

- Privacy-safe helper style from `src/lib/privacy-safe-workflow.ts` (small, pure, well-tested, documented at the top)

**Test scenarios:**

- _Happy path:_ `unfurl` returns full OG data → `fetchLinkPreview` returns all fields populated
- _Happy path:_ `unfurl` returns partial data (only `ogTitle`, no `ogImage`) → returned object has those fields populated, rest as `null`
- _Edge case:_ Empty HTML body with no meta tags → returns object with all fields `null` (not a null object — distinction matters for the UI)
- _Error path — SSRF loopback:_ `fetchLinkPreview("http://127.0.0.1/foo")` returns `null` without ever calling `fetch`
- _Error path — SSRF RFC1918:_ `fetchLinkPreview("http://10.0.0.1/foo")` returns `null`
- _Error path — SSRF cloud metadata:_ `fetchLinkPreview("http://169.254.169.254/")` returns `null`
- _Error path — non-http scheme:_ `fetchLinkPreview("file:///etc/passwd")` returns `null`
- _Error path — redirect to loopback:_ mock `fetch` to return a 302 with `Location: http://127.0.0.1/` → returns `null`
- _Error path — redirect loop:_ mock `fetch` to keep returning 302s → bails after 3 hops, returns `null`
- _Error path — timeout:_ mock `fetch` to never resolve → `AbortController` fires at 4s → returns `null`
- _Error path — content-type mismatch:_ mock `fetch` to return `application/octet-stream` → returns `null`
- _Error path — oversized response:_ mock `fetch` to stream >2MB → aborts, returns `null`
- _Error path — 404:_ mock `fetch` to return 404 → returns `null`
- _Error path — malformed HTML:_ `unfurl.js` throws → caught, returns `null`

**Verification:**

- All test scenarios above pass
- Running the helper against a real URL like `https://vercel.com` in local dev returns non-null metadata
- Running against `http://127.0.0.1` returns `null` and does not make a network call

---

- [ ] **Unit 3: Project library API routes (`/api/projects/*`)**

**Goal:** Implement the user-scoped project library CRUD endpoints: `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/[id]`, `DELETE /api/projects/[id]`, `POST /api/projects/[id]/refresh-metadata`.

**Requirements:** R1, R3, R9

**Dependencies:** Unit 1 (schema), Unit 2 (link preview helper)

**Files:**

- Create: `src/app/api/projects/route.ts` — `GET` (list) + `POST` (create with metadata fetch)
- Create: `src/app/api/projects/[id]/route.ts` — `PATCH` (edit, with clear-before-refetch) + `DELETE`
- Create: `src/app/api/projects/[id]/refresh-metadata/route.ts` — `POST`
- Create: `src/app/api/projects/__tests__/route.test.ts`
- Create: `src/app/api/projects/__tests__/id-route.test.ts`

**Approach:**

- `GET`: returns `{ data: Project[] }` ordered by `updatedAt desc`, scoped to `session.user.id`
- `POST`: validates `name` (required, trimmed, ≤200 chars), `description?`, `githubUrl?`, `liveUrl?` (must parse as URL if present). On success, if `liveUrl` is non-null, call `fetchLinkPreview(liveUrl)` synchronously — await the result (up to ~4s) — and persist the returned metadata on the Project row in the same `create` call. Return `{ data: project }` with 201.
- `PATCH`: fetch existing Project, verify ownership, validate partial body. **Critical: if `liveUrl` changed, in the same update call, null out all cached metadata columns AND `metadataFetchedAt` BEFORE kicking off the new fetch.** If the fetch succeeds, update those columns again in a second call (or use a single transaction). If the fetch fails, the cleared columns remain null — which is the correct state. Return `{ data: project }`.
- `DELETE`: verify ownership, `prisma.project.delete` (cascades to all `ReportProject` rows). Return `{ data: { deleted: true } }`.
- `POST /refresh-metadata`: verify ownership, clear metadata columns, call `fetchLinkPreview` again, update. Return `{ data: project }`.
- All routes: 401 → 404 → 403 → validate → mutate → respond cascade, per house style

**Patterns to follow:**

- `src/app/api/insights/[slug]/route.ts` for the auth/ownership pattern and response shape
- `src/app/api/insights/[slug]/projects/route.ts:33` for manual validation style (`typeof && .trim()`)

**Test scenarios:**

- _Happy path — GET:_ Authenticated user gets only their own Projects (not another user's), ordered `updatedAt desc`
- _Happy path — POST with liveUrl:_ Creates Project; `fetchLinkPreview` is called exactly once with `liveUrl`; returned metadata fields are persisted
- _Happy path — POST without liveUrl:_ Creates Project; `fetchLinkPreview` is NOT called; metadata fields stay `null`
- _Happy path — PATCH name only:_ Updates `name`; `fetchLinkPreview` is NOT called (because `liveUrl` didn't change)
- _Happy path — PATCH changes liveUrl:_ Old metadata is cleared BEFORE new fetch kicks off; new metadata is persisted after fetch returns
- _Happy path — PATCH changes liveUrl, fetch fails:_ Old metadata is cleared; all metadata columns end up `null`; Project still saves
- _Happy path — DELETE:_ Returns success; Project no longer exists; any `ReportProject` rows for it are also gone (cascade)
- _Happy path — refresh-metadata:_ Re-calls `fetchLinkPreview`, updates columns, returns updated Project
- _Error path — unauthenticated:_ 401 on every route
- _Error path — PATCH/DELETE someone else's project:_ 403
- _Error path — PATCH non-existent project:_ 404
- _Error path — POST with invalid liveUrl (not parseable as URL):_ 400
- _Error path — POST with name missing/empty/whitespace:_ 400
- _Integration:_ POST actually stores the metadata fields returned by a mocked `fetchLinkPreview`

**Verification:**

- All test scenarios pass
- `curl`-equivalent manual test: create a Project via `POST` with a real `liveUrl`, GET it back, see metadata fields populated

---

- [ ] **Unit 4: Report-junction routes + publish-path update**

**Goal:** Implement the report-scoped attach and hide endpoints, and update `POST /api/insights` and `GET /api/insights/[slug]` to work with the new junction model.

**Requirements:** R1, R4, R6

**Dependencies:** Unit 1 (schema)

**Files:**

- Modify: `src/app/api/insights/route.ts` — the `POST` handler that creates reports must accept `projectIds: string[]` in the body, verify each id belongs to `session.user.id`, and create `ReportProject` rows in the same Prisma transaction as the report. Drop the old inline `projectLinks: ProjectLinkInput[]` handling.
- Modify: `src/app/api/insights/[slug]/route.ts` — the `GET` handler's `include` clause changes from `projectLinks: true` to `reportProjects: { where: { hidden: false }, orderBy: { position: "asc" }, include: { project: true } }`; update `InsightReportDetailContract` or equivalent type accordingly. The `PUT` handler's narrative-section update logic is unchanged.
- Delete + replace: `src/app/api/insights/[slug]/projects/route.ts` — drop the old ProjectLink create handler; add a new `POST` that accepts `{ projectIds: string[] }` and creates `ReportProject` rows for an existing report (used post-publish from the edit page)
- Create: `src/app/api/insights/[slug]/projects/[projectId]/route.ts` — `PATCH` to toggle the `hidden` flag on a `ReportProject` row
- Delete: `src/app/api/insights/[slug]/projects/[id]/route.ts` (old ProjectLink DELETE handler) — no longer has a UI consumer and the new semantics are "hide" or "delete from library," not "detach"
- Modify: `src/app/api/insights/__tests__/put.test.ts` — update the allowlist field tests if `projectLinks`-related fields were referenced
- Create: `src/app/api/insights/[slug]/__tests__/projects-route.test.ts` — attach and hide tests

**Approach:**

- `POST /api/insights` transaction: `prisma.$transaction(async (tx) => { const report = await tx.insightReport.create(...); if (projectIds.length) { const owned = await tx.project.findMany({ where: { id: { in: projectIds }, userId: session.user.id } }); if (owned.length !== projectIds.length) throw new Error("One or more projects not owned by user"); await tx.reportProject.createMany({ data: projectIds.map((id, i) => ({ reportId: report.id, projectId: id, position: i })) }); } return report; })`
- `POST /api/insights/[slug]/projects` (post-publish attach): same ownership check on projectIds, upserts junction rows (ignore duplicates via unique constraint catch), assigns `position` as `(max existing position) + 1 + index`
- `PATCH /api/insights/[slug]/projects/[projectId]`: ownership check is 2-layer — the report must belong to `session.user.id` AND the junction row must exist. Body is `{ hidden: boolean }`. Returns `{ data: reportProject }`.
- `GET /api/insights/[slug]` already filters hidden rows server-side via the `where` clause in the `include`, so the frontend gets pre-filtered data. Keep it that way for the public detail page; the edit page will need to see hidden rows too (override with a query flag OR fetch separately).
- **Edit page needs to see hidden projects** so the user can unhide them. Either (a) add `?includeHidden=true` query param on GET that only works when `session.user.id === report.authorId`, or (b) the edit page fetches projects from `/api/projects` + the junction state from `/api/insights/[slug]/projects-meta` (a new GET). Prefer (a) for simplicity — it reuses the existing GET.

**Patterns to follow:**

- `src/app/api/insights/[slug]/route.ts` for route shape and Prisma transaction style
- Existing `POST /api/insights` handler for the ownership-cascade-in-transaction pattern

**Test scenarios:**

- _Happy path — POST /api/insights with projectIds:_ Report is created; `ReportProject` rows exist for each id; positions are sequential starting at 0
- _Happy path — POST /api/insights without projectIds:_ Report is created; no junction rows created
- _Happy path — GET /api/insights/[slug]:_ Only non-hidden projects returned, ordered by position
- _Happy path — GET /api/insights/[slug]?includeHidden=true as owner:_ Hidden projects included
- _Happy path — POST /api/insights/[slug]/projects (post-publish attach):_ New junction rows are created with positions after existing ones
- _Happy path — PATCH /api/insights/[slug]/projects/[projectId]:_ `hidden` flag toggles; subsequent GET reflects the new state
- _Error path — POST /api/insights with projectId owned by another user:_ Transaction rolls back, 400 or 403, no report created, no junction rows created
- _Error path — GET /api/insights/[slug]?includeHidden=true as non-owner:_ 403 or silently ignores the flag
- _Error path — PATCH on a junction row for someone else's report:_ 403
- _Error path — PATCH on non-existent junction row:_ 404
- _Edge case — POST /api/insights/[slug]/projects with a projectId already attached:_ Unique constraint catches it, returns 409
- _Edge case — POST /api/insights with empty projectIds array:_ Report is created with no junction rows (same as omitting)
- _Integration:_ Full publish flow creates report + junction rows atomically; if any projectId is invalid, the report is NOT created

**Verification:**

- All test scenarios pass
- Grep for `projectLinks` in `src/` returns only frontend locations that still need to be migrated (tracked in Units 6, 7, 8)

---

- [ ] **Unit 5: Extract `EyeToggle` to shared component**

**Goal:** Move the inline `EyeToggle` from `src/app/insights/[slug]/edit/page.tsx` to a reusable component at `src/components/EyeToggle.tsx`, then import it in the edit page.

**Requirements:** R4, R6 (enables Unit 8)

**Dependencies:** None (pure refactor, can start in parallel with Unit 1)

**Files:**

- Create: `src/components/EyeToggle.tsx`
- Modify: `src/app/insights/[slug]/edit/page.tsx` — delete the inline definition (lines 68-84), add an import for the new component
- Create: `src/components/__tests__/EyeToggle.test.tsx` _(only if component test environment is already set up; otherwise defer the test and note it here)_

**Approach:**

- Component signature: `{ enabled: boolean; onToggle: () => void; label?: string }` — add an optional `label` prop so the new project-hide use can show "Hide this project" vs the existing "Hide this section"
- Preserve the exact lucide icons and classes from the inline version
- Use `"use client"` directive

**Patterns to follow:**

- Existing client components in `src/components/` (e.g., `ProjectLinks.tsx`) for file shape and `"use client"` placement

**Test scenarios:**

- _Happy path:_ Renders `Eye` icon when `enabled=true`, `EyeOff` when `enabled=false`
- _Happy path:_ Clicking the button fires `onToggle` exactly once
- _Edge case:_ Custom `label` prop overrides the default title text
- Test expectation: none — if component test harness isn't already set up for React rendering in this repo, defer tests rather than set up a new test environment for one small component. Call this out and let the implementer decide at execution time.

**Verification:**

- Edit page still renders without TypeScript errors
- Manual check: narrative-section hide toggles still work on the edit page exactly as before
- `grep -n "Eye, EyeOff" src/app/insights/[slug]/edit/page.tsx` returns nothing (imports moved out)

---

- [ ] **Unit 6: Rewrite `ProjectLinks` component (stacked rich card)**

**Goal:** Rewrite `src/components/ProjectLinks.tsx` to render the new stacked layout with optional `ogImage`, with graceful fallback to text-only when no image is present, and an `onError` handler that hides the image block at runtime if the `ogImage` URL fails to load.

**Requirements:** R7, R9

**Dependencies:** Unit 1 (new data shape)

**Files:**

- Modify: `src/components/ProjectLinks.tsx` — full rewrite of the card, keep the outer grid wrapper
- Update: any TypeScript type imports that previously pointed at the `ProjectLink` shape now point at the new `Project` + `ReportProject` shape
- Create: `src/components/__tests__/ProjectLinks.test.tsx` _(only if component test environment exists; otherwise skip per Unit 5 note)_

**Approach:**

- Input prop: `projects: Array<{ project: Project; hidden: boolean; position: number }>` matching the shape returned by the updated GET endpoint (renamed or kept as `projects` prop — internal detail)
- On the public detail view the caller filters out `hidden` rows before passing to this component; component itself doesn't need to filter
- Card layout:
  1. If `ogImage` is non-null AND `<img>` hasn't errored → render 16:9 image block at the top
  2. If `siteName` or `favicon` is non-null → render a small row with favicon (16x16) + site name in `text-slate-500 dark:text-slate-400`
  3. Name in `text-slate-900 dark:text-slate-100`
  4. Description with `line-clamp-2` in `text-slate-500 dark:text-slate-400`
  5. Footer row with GitHub and Live link buttons (preserve existing icon button styling)
- `onError` handler on the `<img>` sets a React state flag that removes the image block for that card
- Render `ogImage` and `favicon` as plain `<img>`, NOT `next/image` (see Decision 4)
- OG title/description are rendered as React text nodes — NEVER `dangerouslySetInnerHTML`
- Preserve `target="_blank" rel="noopener noreferrer"` on all external links
- Keep the outer `grid gap-3 sm:grid-cols-2` wrapper and the `rounded-xl border … dark:bg-slate-800/50` card shell

**Patterns to follow:**

- Current `src/components/ProjectLinks.tsx` styling (colors, borders, dark mode)
- Privacy-safe rendering: spec Security section ("never `dangerouslySetInnerHTML`")

**Test scenarios:**

- _Happy path:_ Renders with full metadata → image block, site name + favicon, name, description, GitHub and Live buttons all present
- _Happy path — no image:_ `ogImage: null` → image block absent, rest of card renders
- _Happy path — no live URL at all:_ `liveUrl: null` → no image block, no Live button, no site name row, just name/description/GitHub
- _Happy path — only GitHub URL:_ card renders with GitHub button only
- _Edge case — very long description:_ `line-clamp-2` truncates cleanly
- _Edge case — missing name:_ shouldn't happen per validation, but component should not crash (render empty string)
- _Runtime error — broken image URL:_ `<img>` `onError` fires → image block hides, rest of card stays
- Test expectation: per Unit 5, component tests are conditional on existing test harness. If absent, verify manually in local dev with seeded data.

**Verification:**

- Local demo report pages (e.g., `/insights/jordan-demo-harness`) render with the new card layout
- Projects that have `ogImage` show the image; ones without fall back cleanly
- Dark mode matches existing project card styling

---

- [ ] **Unit 7: Rewrite upload flow Step 2 (library picker)**

**Goal:** Replace the inline project entry form in `src/app/upload/page.tsx` Step 2 with a library picker: load the user's existing Projects, let them check which to include, allow inline Edit to update library entries, and allow "Add new project" inline with a loading state while metadata is being fetched.

**Requirements:** R1, R3, R5

**Dependencies:** Unit 1 (schema), Unit 3 (library routes), Unit 4 (publish path accepts projectIds)

**Files:**

- Modify: `src/app/upload/page.tsx` — replace Step 2 state (`projectLinks`, `newLink`, `addProjectLink`, `removeProjectLink`, the JSX block around lines 981-1060) with new picker UI; update `handlePublish` to send `projectIds: string[]` instead of `projectLinks: ProjectLinkInput[]`
- Possibly create: `src/components/ProjectLibraryPicker.tsx` — extracted component to keep `upload/page.tsx` from ballooning further. Implementer's judgment call; if the edit experience is simple enough, inline it.

**Approach:**

- On Step 2 mount: `fetch("/api/projects")` → populate `library: Project[]` state
- `selectedProjectIds: Set<string>` state tracks which are checked
- Each library card shows: name, description (truncated), checkbox, Edit button
- "Add new project" button toggles an inline form with fields (name, description, githubUrl, liveUrl) and a Save button
- Save path: `POST /api/projects` → show "Fetching preview…" loading state with button disabled during the synchronous call → on success, add the returned Project to `library` state and auto-add its id to `selectedProjectIds`
- Edit button: expands the card into an inline edit form (no modal). Save → `PATCH /api/projects/[id]` → same "Fetching preview…" loading state if `liveUrl` changed → on success, update the library state in place
- **No Delete button in upload flow** (Decision 5 — deletion lives on the report edit page)
- `handlePublish` change: `body.projectIds = [...selectedProjectIds]` instead of `body.projectLinks`
- Preserve all other upload flow state untouched (title, narrative fields, file upload, etc.)

**Patterns to follow:**

- Existing `useState` state management style in `src/app/upload/page.tsx`
- Existing loading/submit state pattern in Step 3 `handlePublish`
- Shared card styling from `src/components/ProjectLinks.tsx`

**Test scenarios:**

- _Happy path — load library:_ Step 2 mounts → GET /api/projects called → cards render for each Project
- _Happy path — check/uncheck:_ Toggling a card's checkbox updates `selectedProjectIds`
- _Happy path — add new project:_ Inline form + Save → POST /api/projects → loading state shown → on return, new card appears in library, auto-selected
- _Happy path — edit existing:_ Edit button → inline form with prefilled values → Save → PATCH /api/projects/[id] → list updates
- _Happy path — publish:_ `handlePublish` sends `projectIds` array in the POST body; publish succeeds and redirects to the new report
- _Edge case — empty library:_ Step 2 loads with no existing projects → "Add new project" form is immediately visible (don't show an empty-state blocker)
- _Edge case — POST /api/projects returns 400:_ Form shows the error, doesn't crash, loading state clears
- _Edge case — PATCH liveUrl change triggers long metadata fetch:_ Button disabled, loading text visible for up to ~4s, then form closes cleanly
- _Integration:_ The full Step 2 → Step 3 → Publish path ends in a report detail page with the expected Projects attached

**Test expectation:** Happy-path coverage via a higher-level integration or E2E test is more valuable here than unit tests; if component tests are hard to set up for `useState`-heavy flows in this repo, rely on the Playwright QA flow for this unit.

**Verification:**

- Manual upload flow end-to-end in local dev
- Seeded demo projects appear as pre-existing library entries
- Publishing with zero projects still works (library-empty path)
- Publishing with multiple projects creates junction rows with correct positions

**Execution note:** This is the highest-risk UI unit per institutional learnings ("upload flow is high-risk, QA end-to-end before merge"). Run the QA workflow and codex review on this unit's diff specifically before merge.

---

- [ ] **Unit 8: Report edit page project section + profile Edit Report button**

**Goal:** Add a "Projects" section to `src/app/insights/[slug]/edit/page.tsx` with per-project Hide toggle (reusing `EyeToggle`), Delete-from-library button, and Refresh-metadata button. Separately, add an "Edit Report" button to the profile page next to the existing Delete button.

**Requirements:** R4, R6

**Dependencies:** Unit 1 (schema), Unit 4 (junction PATCH endpoint), Unit 5 (extracted EyeToggle), Unit 6 (new card shape), Unit 3 (Delete from library endpoint)

**Files:**

- Modify: `src/app/insights/[slug]/edit/page.tsx` — add new Projects section; fetch report with `?includeHidden=true`; render each attached Project using the same card shell from `ProjectLinks.tsx` with added action buttons; wire up hide toggle (`PATCH /api/insights/[slug]/projects/[projectId]`), delete (`DELETE /api/projects/[id]`), refresh metadata (`POST /api/projects/[id]/refresh-metadata`)
- Modify: `src/app/u/[username]/page.tsx` — on each report card, when `session.user.username === username`, render a new "Edit Report" link button next to the existing Delete button (line 503 area), linking to `/insights/[slug]/edit`

**Approach:**

- Edit page: new Projects section between existing section toggles (position it wherever feels natural in the current layout — likely after narrative section toggles)
- Each Project row: image + name + description (truncated), plus three buttons:
  1. `<EyeToggle enabled={!hidden} onToggle={...} label="Hide from this report" />`
  2. "Delete from library" — confirm dialog (`window.confirm`) → `DELETE /api/projects/[id]` → on success, remove from local state (and from all other reports' displays on refresh)
  3. "Refresh metadata" — `POST /api/projects/[id]/refresh-metadata` → on success, update local state with new metadata
- Profile page Edit button: `<Link href={`/insights/${report.slug}/edit`}>` styled as a secondary button, same size as Delete, placed to the left of Delete so actions read Edit→Delete left-to-right
- Only show Edit/Delete when `isOwnProfile` (the existing condition gating Delete already handles this)

**Patterns to follow:**

- Existing narrative-section hide pattern in `src/app/insights/[slug]/edit/page.tsx` (use the extracted `EyeToggle` from Unit 5)
- Profile page Delete button styling at `src/app/u/[username]/page.tsx:503`
- Confirm dialog pattern used for Delete Report: `if (!confirm("...")) return;`

**Test scenarios:**

- _Happy path — hide toggle:_ Click toggle → PATCH fires → junction row's hidden flag flips → visiting the public report page hides the project
- _Happy path — unhide toggle:_ Same flow reversed
- _Happy path — delete from library:_ Confirm → DELETE fires → Project and all junction rows gone → edit page no longer shows it; other reports that referenced it no longer show it
- _Happy path — refresh metadata:_ Button click → POST fires → metadata re-fetched → card re-renders with new image/title
- _Happy path — profile Edit Report button:_ Click → navigates to `/insights/[slug]/edit`
- _Edge case — delete confirmation dismissed:_ Nothing happens
- _Edge case — hidden projects still visible on edit page:_ The `?includeHidden=true` GET returns them; the public detail page does not
- _Error path — PATCH failure:_ Show an inline error, toggle reverts, don't crash
- _Error path — DELETE failure:_ Show an inline error, card stays
- _Error path — non-owner hits /insights/[slug]/edit directly:_ Existing page guard rejects (unchanged from today)
- _Integration:_ Full round-trip — upload a report with 3 projects → go to profile → click Edit Report → hide one → visit public page → hidden project not shown → unhide → visible again

**Test expectation:** Same guidance as Unit 7 — lean on Playwright/manual QA for integration coverage rather than trying to unit-test the full edit page.

**Verification:**

- Manual QA: the full hide/delete/refresh cycle
- Profile page Edit button visible only on own profile
- `/insights/[slug]/edit` shows all attached projects including hidden ones
- Public `/insights/[slug]` filters hidden ones out

## System-Wide Impact

- **Interaction graph:**
  - `POST /api/insights` (create report) gains a project-attach side-effect inside the same transaction. Any code path that bypasses this route (seed files, admin scripts, tests) must also create junction rows if it creates Projects.
  - `GET /api/insights/[slug]` include clause changes — any consumer of the return shape must handle `reportProjects[].project` instead of `projectLinks[]`. Grep-check before merge.
  - Adding the Projects list to the edit page means the edit page now does 2+ independent mutations (section hide PUT + per-project PATCH). Keep them independent — don't try to batch them.

- **Error propagation:**
  - Metadata fetch failure is swallowed (returns null) — this is intentional per Decision 3. Do NOT let SSRF rejections bubble up as 500s; they should produce 201-with-null-metadata on POST and 200-with-null-metadata on PATCH/refresh.
  - Transaction failure on `POST /api/insights` must roll back BOTH the report and any junction rows — use `prisma.$transaction` not sequential calls.

- **State lifecycle risks:**
  - **Partial write on publish:** Avoided by using a single Prisma transaction (Decision 2).
  - **Stale metadata after liveUrl edit:** Avoided by clearing all metadata columns BEFORE the new fetch (R9).
  - **Orphaned junction rows:** Prevented by `onDelete: Cascade` on both sides of `ReportProject`.
  - **Delete library project currently attached to 10 reports:** Cascades cleanly via the schema; no application code needed, but verify cascade works as intended in an integration test.

- **API surface parity:**
  - Frontend + any tests referencing `projectLinks` on a report response must migrate to the new shape. Grep across `src/` before merge.
  - Seed files are NOT an API surface but share the same model and must be updated in lockstep (Unit 1).

- **Integration coverage:**
  - Full publish path (Unit 7) — mocked unit tests will not prove the transaction rolls back on a bad projectId. Add one integration test or manual QA step for this specifically.
  - Cross-layer cascade: deleting a Project must remove it from reports rendered on the public detail page. Covered by Unit 3 tests + one end-to-end manual verification.

- **Unchanged invariants:**
  - Report ownership model (`authorId` on `InsightReport`) is unchanged.
  - Narrative section hide/show (the existing EyeToggle usage on the edit page) behaves exactly as today.
  - OG metadata generation for the report's own social card (`src/app/api/og/[slug]/route.tsx`) is completely separate from the new link preview system and is not affected by this plan.

## Risks & Dependencies

| Risk                                                                                                             | Mitigation                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSRF bypass via DNS rebinding (attacker resolves to public IP then switches to internal before the actual fetch) | Partially mitigated by re-validating each redirect hop. Residual risk documented in the threat model comment in `src/lib/link-preview.ts`. Not fully eliminable without a custom DNS resolver — accepted for v1.                             |
| `unfurl.js` quirks on specific target sites (empty results, unexpected fields)                                   | Test scenarios cover the null-on-error path. If a high-value site fails, the implementer can swap to `metascraper` or `link-preview-js` without re-architecting.                                                                             |
| Supabase migration history divergence prevents `prisma migrate dev`                                              | Fall back to `prisma migrate reset` (local) or `prisma db push` (emergency). Documented in deferred questions.                                                                                                                               |
| Upload Step 2 rewrite breaks the publish flow for edge cases (no projects, many projects, slow metadata fetch)   | Unit 7 has an explicit execution note requiring end-to-end QA before merge. Codex review also gated on this unit per institutional learnings.                                                                                                |
| Clear-before-refetch window leaves metadata null if the user refreshes during the ~4s fetch                      | Accepted — user sees "no metadata yet" for up to 4s, then refreshes and sees the new metadata. Acceptable UX.                                                                                                                                |
| 2MB response cap triggers on large-but-legitimate pages (e.g., SPAs that inline everything)                      | Cap is a trade-off. 2MB is generous for HTML; real SPA payloads may exceed it, in which case metadata is null and the user sees a text-only card. Refresh button doesn't help. Document as a known limitation in the helper's comment block. |
| Codex review catches major rework findings after most units merged                                               | Run codex review on the spec+plan BEFORE starting Unit 7 (the highest-risk unit) so blocking feedback lands early rather than mid-implementation.                                                                                            |

## Documentation / Operational Notes

- **Agent memory update on merge:** Add an entry to `agent/MEMORY.md` documenting the SSRF helper as "the institutional reference for server-side link fetching" (per learnings researcher recommendation).
- **README/docs:** No user-facing docs to update; the feature is self-explanatory in the upload flow.
- **Seed re-run command** for local dev: `npx tsx prisma/seed-demos.ts --cleanup && npx tsx prisma/seed-demos.ts` — preserves the existing workflow.
- **Deployment:** Standard Vercel deploy via PR merge. Verify `prisma generate` runs in the build step and the new migration is picked up by Supabase.
- **Monitoring:** Watch server logs post-deploy for a flood of `fetchLinkPreview failed` warnings — high rate could mean SSRF blocklist is too aggressive or `unfurl.js` is struggling with real-world pages.

## Sources & References

- **Origin document:** `docs/superpowers/specs/2026-04-10-persistent-projects-and-link-previews-design.md`
- **Related code:**
  - `prisma/schema.prisma` (lines 79, 86-95 for current `ProjectLink`)
  - `src/app/api/insights/[slug]/route.ts` (canonical auth/ownership pattern)
  - `src/app/api/insights/[slug]/projects/route.ts` (current `ProjectLink` POST to be replaced)
  - `src/app/insights/[slug]/edit/page.tsx:68-84` (inline `EyeToggle` to extract)
  - `src/app/upload/page.tsx:362, 462, 537, 981-1060` (upload Step 2 state and JSX)
  - `src/components/ProjectLinks.tsx` (component to rewrite)
  - `src/app/u/[username]/page.tsx:503` (Delete Report button location — Edit Report goes here)
  - `prisma/seed.ts:606, 616` (hardcoded `projectLink.create` calls to replace)
  - `prisma/seed-demos.ts:152` (`harnessReport()` helper to extend)
  - `prisma/seed-helpers.ts` (add `defaultProjectSeedFor` here)
  - `src/lib/privacy-safe-workflow.ts` (reference style for small, testable helper module)
  - `next.config.ts:7-16` (`images.remotePatterns` allowlist — do not add wildcards)
- **Institutional learnings:** `agent/MEMORY.md` entries cited throughout the Context section
- **External docs:** None required — SSRF patterns and `unfurl.js` usage are standard
