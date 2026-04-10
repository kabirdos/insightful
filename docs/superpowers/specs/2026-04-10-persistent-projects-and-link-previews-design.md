# Persistent Projects & Rich Link Previews

**Status:** Draft — awaiting user review
**Date:** 2026-04-10
**Branch (planned):** `feat/persistent-projects` (worktree)

## Problem

Today, a project link on a report is owned by the report (`ProjectLink` table). Each time a user uploads a new report they must re-enter all their projects from scratch. Projects also render as plain text-only cards — a name, description, and two link icons — even when the `liveUrl` points to a site with perfectly good Open Graph metadata waiting to be used.

Two related asks:

1. **Projects should persist across reports.** Users maintain a library of projects on their profile. When uploading a new report, they pick which to include, edit as needed, and those edits propagate to every report showing the project. On a report edit page they can hide per-report or delete globally.
2. **Live-site links should render with a visual.** Fetch Open Graph metadata (image, title, description, favicon, site name) and render a richer card when we have it.

Both ship together in one PR.

## Goals & Non-Goals

**In scope:**

- New `Project` (user-owned) and `ReportProject` (junction) Prisma models
- Drop existing `ProjectLink` table — no data migration (no real users yet)
- Upload flow Step 2 reworked to pick from + edit + add to user's project library
- Report edit page (`/insights/[slug]/edit`) gains a Projects section with hide-per-report and delete-from-library actions
- Profile page gets an **Edit Report** button per report card, linking to the existing edit page
- `src/lib/link-preview.ts` — server-side Open Graph metadata fetcher using `unfurl.js`, with 4s timeout and graceful null-return
- Rewritten `ProjectLinks` component rendering a stacked card (image on top, text below) with graceful fallback to text-only

**Out of scope (explicit non-goals):**

- Standalone `/profile/projects` management page (deferred — YAGNI)
- Drag-to-reorder projects within a report (deferred)
- Downloading `ogImage` to local blob storage (store URL only in v1)
- GitHub URL metadata fetching (skipped — github.com OG images are generic repo cards, not valuable enough to fetch)
- Background refresh of stale metadata (manual refresh button only)
- Migrating existing `ProjectLink` rows in production (dropped outright)

## Design Decisions

Key decisions made during brainstorming, with the reasoning behind each:

1. **Edits propagate retroactively.** One canonical `Project` row per user; all reports referencing it show the latest state. Matches "these are my projects, I maintain them" mental model. Alternative was per-report snapshots — rejected as over-engineering for a moving target (live URLs already drift).

2. **Drop and rewrite, no data migration.** No real users yet, so preserving `ProjectLink` rows adds complexity for no benefit. Clean migration.

3. **Fetch metadata on create/edit, cache on the Project row, manual refresh button.** Fastest read path for report viewers, no background jobs, no TTL logic. Staleness handled by explicit user action. URL-only (no blob download) — revisit if image 404s become a real problem.

4. **Two actions only: Hide from this report (per-report), Delete from library (global).** A third "remove from this report but keep in library" option was considered and rejected as confusing — users wouldn't know why it differs from hide, and unhiding recovers the same state.

5. **Editing lives inside the upload flow only for v1.** No standalone library management page. The trigger is "edit projects when uploading a new report," which matches how the user described the need. Standalone page can come later if wanted.

6. **Project hide/delete controls live on the report edit page, not the public report view.** Keeps edit controls off pages other people see. Requires adding an "Edit Report" entry point on the profile page (the edit page exists today but is unreachable from the profile).

7. **Stacked card shape for link previews.** Image on top (16:9), text below. Fits the existing 2-col grid on `ProjectLinks.tsx`, degrades cleanly when `ogImage` is absent (card just hides the image block).

## Data Model

```prisma
model Project {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  githubUrl   String?
  liveUrl     String?

  // Cached link preview metadata — nullable; absence = not fetched or fetch failed
  ogImage           String?
  ogTitle           String?
  ogDescription     String?
  favicon           String?
  siteName          String?
  metadataFetchedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  reportProjects ReportProject[]

  @@index([userId])
}

model ReportProject {
  id        String  @id @default(cuid())
  reportId  String
  projectId String
  hidden    Boolean @default(false)
  position  Int     @default(0)

  report  InsightReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  project Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([reportId, projectId])
  @@index([reportId])
  @@index([projectId])
}
```

**Cascading semantics:**

- Delete `User` → all their Projects + junction rows removed
- Delete `InsightReport` → junction rows for that report removed, Projects survive in library
- Delete `Project` → all junction rows for that project removed, project disappears from every report
- Hide on a report → `ReportProject.hidden = true`, no row deletion

**Migration:** single Prisma migration drops `ProjectLink`, creates `Project` + `ReportProject`. Seed files (`prisma/seed-demos.ts`) updated to create Projects under each demo user and attach them via junction rows.

## API Routes

**Library (user-scoped):**
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List current user's Projects |
| `POST` | `/api/projects` | Create Project; synchronously fetch metadata before responding |
| `PATCH` | `/api/projects/[id]` | Edit fields; re-fetch metadata if `liveUrl` or `githubUrl` changed |
| `DELETE` | `/api/projects/[id]` | Delete from library (cascades to all junctions) |
| `POST` | `/api/projects/[id]/refresh-metadata` | Manual metadata refresh |

**Report junction (report-scoped):**
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/insights/[slug]/projects` | Attach existing projects by id (`{ projectIds: string[] }`); creates junction rows; `position` assigned as the array index (0-based, preserving request order) |
| `PATCH` | `/api/insights/[slug]/projects/[projectId]` | Toggle `hidden` flag |

Note: there is deliberately no DELETE endpoint for detaching a project from a report without deleting it from the library. The UI only surfaces **Hide** (per-report) and **Delete from library** (global) — see Decision 4. If future work needs "detach only," add the endpoint then.

All routes verify ownership via `next-auth` session.

**Metadata fetcher** — new `src/lib/link-preview.ts`:

```ts
type LinkPreview = {
  ogImage: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  favicon: string | null;
  siteName: string | null;
};

async function fetchLinkPreview(url: string): Promise<LinkPreview | null>;
```

- Uses `unfurl.js` (no Puppeteer, just HTML parsing)
- 4-second timeout via `AbortController`
- Any error (timeout, HTTP non-2xx, malformed HTML) → returns `null`; Project still saves with null metadata
- Called only for `liveUrl`; `githubUrl` is skipped in v1
- If a Project has only `githubUrl` (no `liveUrl`), no fetch is attempted at all — all metadata fields stay null and the card renders text-only
- Server logs failures for observability

## UI Changes

### Upload flow — `src/app/upload/page.tsx` Step 2

1. On mount, fetch `GET /api/projects` to load user's library
2. Render a **picker**: each library Project as a selectable card (checkbox)
3. Checked projects will be attached when the report publishes
4. **"Add new project"** inline form below the picker → creates a new library Project, auto-checks it
5. Each library card has an inline **Edit** button that expands the card into an inline edit form (no modal) → `PATCH /api/projects/[id]` + refresh list on save
6. No delete option in the upload flow (deletion lives on the report edit page only in v1)
7. On publish, API receives `projectIds: string[]` and creates junction rows in order

### Report edit page — `src/app/insights/[slug]/edit/page.tsx`

Add a new "Projects" section alongside existing section toggles. For each attached project:

- Render the full rich card preview
- **Eye toggle** (reuse existing `EyeToggle` component) → toggles `hidden` via `PATCH /api/insights/[slug]/projects/[projectId]`
- **Delete from library** button with confirm dialog → `DELETE /api/projects/[id]` (cascades)
- **Refresh metadata** button → `POST /api/projects/[id]/refresh-metadata`
- No reorder controls in v1

### Profile page — `src/app/u/[username]/page.tsx`

- Add **Edit Report** button on each report card, next to the existing Delete button
- Links to `/insights/[slug]/edit`
- Only visible on own profile

### Rich card — `src/components/ProjectLinks.tsx`

Rewrite for stacked layout:

```
┌────────────────────────────┐
│       [ogImage 16:9]        │  ← hidden if null
├────────────────────────────┤
│ [favicon] site name         │  ← hidden if no siteName
│ Project Name                │
│ description (line-clamp-2)  │
│ [GitHub] [Live ↗]           │
└────────────────────────────┘
```

- Server-side query filters out `hidden` junction rows and sorts by `position ASC`
- Graceful fallback: no `ogImage` → image block hidden; card looks like today's minus icons
- Card inside the existing 2-col responsive grid (no change to grid)

## Error Handling

- **Metadata fetch failure** → save Project anyway with null metadata. User can retry via refresh button. Server logs the failure with URL + error.
- **Invalid URL on create** → zod validation rejects before fetch attempt (no 500).
- **Duplicate attach** → unique constraint `[reportId, projectId]` catches it, API returns 409.
- **Delete project attached to published reports** → cascading delete succeeds; those reports simply render fewer cards. No extra confirmation nag.
- **Hide toggle on a project the user doesn't own** → 403 via ownership check in route handler.

## Tests

New/extended vitest coverage:

- `src/lib/__tests__/link-preview.test.ts` — mock `fetch`; cover success, 404, timeout (AbortController), malformed HTML, explicit null-on-error path
- `src/app/api/projects/__tests__/route.test.ts` — CRUD with auth guards; assert metadata fetcher is called on create and on update when URL changes; assert it is NOT called when URL unchanged
- `src/app/api/insights/[slug]/projects/__tests__/route.test.ts` — attach / hide / ownership
- `src/components/__tests__/ProjectLinks.test.tsx` — renders with ogImage, without ogImage, without liveUrl
- `prisma/__tests__/seed-helpers.test.ts` — extend for Project/ReportProject seed helpers
- Integration test for upload publish path creating junction rows in correct order

## Rollout

Single PR to `feat/insightful-mvp`. No feature flag. Seed data gets updated so local dev and demo profiles reflect the new model immediately.

## Out of Scope / Future Work

- Standalone `/profile/projects` library management page
- Drag-to-reorder projects on a report
- `ogImage` local blob caching (Vercel Blob or Supabase Storage)
- GitHub URL metadata synthesis
- Background TTL-based metadata refresh
- Editing a `Project`'s URL while also preserving old-report-snapshot semantics (would require the "snapshot" model we rejected)
