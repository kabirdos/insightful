# Developer Setup Fields for User Profiles

**Date:** 2026-04-13
**Status:** Plan — revised 2026-04-13 after codex review (see [`2026-04-13-profile-setup-fields-codex-review.md`](./2026-04-13-profile-setup-fields-codex-review.md))
**Scope:** Add a public "what's your setup" section to user profiles (uses.tech-style).

> **Revisions folded in from codex review:**
>
> - Validation runs on BOTH read and write paths (defense in depth), with `normalizeSetup(stored, stored)` on reads to preserve the persisted `setupUpdatedAt`
> - `version: 1` and server-owned `setupUpdatedAt` baked into the type
> - `primaryModel` derives from `perModelTokens` (active tokens = input+output, deliberately excluding cache) with `models` count as fallback
> - `packageManager` added as a 4th auto-derived field (from `harnessData.cliTools`)
> - OS heuristic returns only `{ os: "..." }`, never the matched path
> - Auto-derive runs on `stripHiddenHarnessData(...)` output, never raw
> - MCP privacy copy ("Review names before publishing…") added to the edit form
> - Migration uses full timestamp directory matching existing convention
> - Verification commands fixed (`npx tsc --noEmit`, `npx vitest run` — no `typecheck` / `test` scripts exist in `package.json`)
> - Suggestion UI states defined: loading / no-reports / no-suggestions / ok / failed / already-applied
> - Prisma null handling: use `Prisma.DbNull` to clear to SQL NULL (NOT `Prisma.JsonNull`, which stores a JSON null literal)

## Goals

- Enrich the public profile with optional, freeform "workstation" fields so it reads like a developer's uses-page, not just a stats dashboard.
- Ship a small v1 quickly (8–12 fields) with high fill-in rate and autosuggest from uploaded harness data.
- Keep storage dumb and display-only — no querying, no analytics on these fields.

## Non-Goals (v1)

- No public directory / search over setup fields.
- No icon library for every tool (just a handful of curated ones).
- No strict enums — tools churn, free text wins.

---

## 1. v1 Field List (11 fields)

Grouped by category. Every field is optional.

### Hardware (3)

| Field      | Input                                                                | Why                                                                                                                                          |
| ---------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `os`       | single-select autosuggest (macOS / Linux / Windows / WSL + freeform) | Everyone knows theirs. Can be **auto-derived** from `harnessData` cwd paths + `versions` strings (e.g. `/Users/` → macOS, `/home/` → Linux). |
| `machine`  | free text                                                            | "M4 Max MBP 64GB", "Framework 13", "Desktop I built". High brag factor.                                                                      |
| `keyboard` | free text                                                            | Keyboard tribalism is real. Instant "ooh same".                                                                                              |

### Editor & Terminal (3)

| Field      | Input                                                                                          | Why                |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------------ |
| `editor`   | autosuggest (VS Code, Cursor, Zed, Neovim, JetBrains family, Windsurf, …)                      | Universal opinion. |
| `terminal` | autosuggest (Ghostty, iTerm2, Warp, Alacritty, Kitty, WezTerm, Terminal.app, Windows Terminal) | Same.              |
| `shell`    | autosuggest (zsh, bash, fish, nushell, PowerShell)                                             | Short, universal.  |

### AI Coding Stack (3, mostly auto-derived)

| Field          | Input                                                         | Why                                                                                                             |
| -------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `primaryAgent` | autosuggest (Claude Code, Codex, Cursor Agent, Aider, Amp, …) | Defaults to "Claude Code" since they uploaded a harness report; still editable.                                 |
| `primaryModel` | free text w/ suggestions                                      | **Auto-derived** from `harnessData.perModelTokens` (token share) with `harnessData.models` (count) as fallback. |
| `mcpServers`   | multi-chip free text                                          | **Auto-derived** from `harnessData.mcpServers` keys. Huge "what's that?" factor.                                |

### Workflow (2)

| Field            | Input                                                           | Why                                                                                                             |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packageManager` | autosuggest (pnpm, npm, yarn, bun, uv, pip, cargo, go, mise, …) | **Auto-derived** from `harnessData.cliTools` — match against the known package-manager set, pick highest-count. |
| `dotfilesUrl`    | URL                                                             | Classic uses-page flex; trivial to validate (reuse `isValidUrl`).                                               |

**Total: 11 fields.** Tight, high fill-in rate, **four auto-derivable** (primaryAgent, primaryModel, mcpServers, packageManager).

---

## 2. v2 Field List

Punt these until v1 has fill-in-rate data:

- **Hardware:** `display` (monitor setup), `mouse` (trackball/trackpad), `headphones`, `chair`, `drink`.
- **Editor & Terminal:** `multiplexer` (tmux/Zellij), `editorFont`, `colorTheme`.
- **AI:** `secondaryAgent`, `notableHarnessCustomizations` (auto-derived from hook definitions / plugin list — richer, more privacy review needed).
- **Workflow:** `containers` (Docker/OrbStack/Podman), `gitClient` (CLI/Tower/Fork), `noteTaking` (Obsidian/Notion/…), `devBrowser`.
- **Fun:** `dock` (what's pinned), free-form "random stuff on my desk".

Justification for pushing: display/chair/headphones are fun but niche; multiplexer/font/theme are power-user-only; secondary-agent and notable-customizations require more auto-derivation logic to feel alive. Build the pattern first with v1, extend once.

---

## 3. Data Model

### Current state (verified)

`prisma/schema.prisma` line 12–31: `User` has `displayName`, `bio`, four URL fields. No setup-related columns. Uses PostgreSQL. Prisma migrations are applied via `prisma migrate deploy` (per project note).

### Decision: single JSON column

Add one nullable `Json` column to `User`:

```
setup Json?
```

Shape (TypeScript type, stored as loose JSON):

```ts
// src/types/profile.ts
export const PROFILE_SETUP_VERSION = 1 as const;

export interface ProfileSetup {
  // Server-owned metadata (never accept from client; set/refresh in normalizeSetup):
  version: typeof PROFILE_SETUP_VERSION;
  setupUpdatedAt: string; // ISO-8601, refreshed only when normalized payload changes

  // User fields (all optional, all freeform):
  os?: string;
  machine?: string;
  keyboard?: string;
  editor?: string;
  terminal?: string;
  shell?: string;
  primaryAgent?: string;
  primaryModel?: string;
  mcpServers?: string[];
  packageManager?: string;
  dotfilesUrl?: string;
}
```

`version` and `setupUpdatedAt` are **server-owned** — `normalizeSetup` always overwrites them. Client-supplied values for these two keys are ignored. `setupUpdatedAt` only refreshes when the normalized user-fields payload differs from what's already stored (avoid bumping the timestamp on no-op PUTs).

**Why JSON, not a normalized `ProfileSetup` table:**

- Display-only. No filtering, sorting, joining, or aggregation on these fields.
- Schema will churn (v2 adds ~12 more fields, users will want custom ones eventually).
- Type-safety lives in a TS type + a manual validator in the PUT handler, not in the DB.
- One fewer join on the hot public profile fetch.

**Trade-off acknowledged:** if we ever want "show me all devs using Ghostty", we'd need to backfill a table or use JSONB indexing. Accept that cost later.

---

## 4. Migration

Follow project's "never reset" rule. Match the existing migration directory naming convention (full UTC timestamp, e.g. `20260413003102_slug_per_user_unique`) — **not** the shorter `20260413_add_user_setup` originally proposed.

**File:** `prisma/migrations/<YYYYMMDDHHMMSS>_add_user_setup/migration.sql` (generate the timestamp with `date -u +%Y%m%d%H%M%S` at migration-create time).

```sql
ALTER TABLE "User" ADD COLUMN "setup" JSONB;
```

Then update `prisma/schema.prisma` to add `setup Json?` to the `User` model.

**Verification:**

```
npx prisma validate
npx prisma generate
npx prisma migrate deploy   # against dev DB
npx tsc --noEmit            # confirm Prisma client types compile
```

Note: `package.json` has no `typecheck` or `test` scripts — use `npx tsc --noEmit` and `npx vitest run` directly throughout this plan.

---

## 5. Edit UI

### Current state (verified)

The profile edit form lives **in-page** inside `src/app/[username]/page.tsx` as a `ProfileEditForm` component (lines 139–279). Toggled by an `editing` state (line 288). Saves via `PUT /api/users/me` (line 329). No separate settings page.

### Plan

Add a collapsible "Developer Setup" section to `ProfileEditForm` **below** the "Social Links" block (after line 253). Use a `<details>` element or a controlled `showSetup` toggle for consistency.

Structure:

```
▸ Developer Setup (optional — shown publicly on your profile)
   ─── Hardware ───
     OS               [autosuggest input]
     Machine          [text]
     Keyboard         [text]
   ─── Editor & Terminal ───
     Editor/IDE       [autosuggest]
     Terminal         [autosuggest]
     Shell            [autosuggest]
   ─── AI Stack ───
     Primary agent    [autosuggest, default "Claude Code"]
     Primary model    [text + suggestions]
     MCP servers      [chip input]
   ─── Workflow ───
     Package manager  [autosuggest]
     Dotfiles URL     [url]
```

**Autosuggest component:** use an `<input list="...">` + `<datalist>` — native, zero deps, free text allowed. Suggestion sources live in a new file `src/lib/profile-setup-suggestions.ts`:

```ts
export const OS_SUGGESTIONS = ["macOS", "Linux", "Windows", "WSL"];
export const EDITOR_SUGGESTIONS = ["VS Code", "Cursor", "Zed", "Neovim", "JetBrains", "Windsurf", ...];
// …
```

**MCP servers chip input:** comma-separated text → `string[]` on submit. Pre-filled from auto-derive (see §7).

**Copy at top of section (privacy note):**

> "These appear publicly on your profile. All fields optional — leave blank to hide."

**State management:** extend `EditFormData` (currently at line 130) with a `setup: ProfileSetup` object. Serialize into the `PUT /api/users/me` body.

### API changes

**File:** `src/app/api/users/me/route.ts`

- In `GET`, add `setup: true` to the Prisma `select` (line 30–40). **Run the result through `normalizeSetup(stored, stored)` before returning** — defense in depth against malformed JSON from manual DB edits or stale shapes. Passing `stored` as `prevStored` ensures a well-formed stored blob preserves its persisted `setupUpdatedAt` on every read (no thrash).
- In `PUT`, accept `body.setup`, run through `normalizeSetup(raw, prevStored): ProfileSetup | null` (see helper below). `prevStored` is the user's currently persisted `setup` read earlier in the handler.
- The current update accumulator is typed `Record<string, string | null>` (line 67) — widen to `Prisma.UserUpdateInput` (or a hand-typed superset) to allow the `Json | null` value. The "no valid fields" check (line 97) must accept "clear setup to null" as a valid update.
- **For Prisma JSON null handling: pass `Prisma.DbNull` to clear the column to SQL `NULL`. Do NOT use `Prisma.JsonNull` (that stores a JSON `null` literal, which is NOT what we want). Do NOT pass plain JS `null`.** Document the choice inline. [Prisma docs](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields#using-null-values).
- Include `setup` in both the response `select` blocks (lines 30–40 and 107–117), normalized with `prevStored = stored`.

**`normalizeSetup` helper:**

New file: `src/lib/profile-setup-normalize.ts`. Pure function used on **every read and write path** (PUT body, GET response in `me` route, GET response in public `[username]` route, server-side render in setup card, derivation suggestion endpoint).

Behavior:

- Reject non-object input → returns `null`.
- Strip unknown keys.
- Trim all strings; coerce empty → undefined.
- Validate `dotfilesUrl` via existing `isValidUrl` (drop on fail).
- Cap each free-text field at 120 chars (truncate, don't reject).
- Cap `mcpServers` array length at 20 and each string at 80 chars.
- If every user field is undefined/empty after normalization → return `null` (clear blob).
- Otherwise overwrite `version: PROFILE_SETUP_VERSION` and set `setupUpdatedAt`:
  - If `prevStored` is provided AND the normalized user-field payload (excluding `setupUpdatedAt`) deep-equals `prevStored`'s user-field payload → preserve `prevStored.setupUpdatedAt` (no-op write).
  - Otherwise set `setupUpdatedAt = new Date().toISOString()`.

**File:** `src/app/api/users/[username]/route.ts` (public GET)

- Add `setup: true` to Prisma select.
- Normalize via `normalizeSetup(stored, stored)` before returning (same pattern as the private GET — preserves the persisted `setupUpdatedAt`). Normalization prevents stale unknown keys leaking through if the type changes.

**Verification:**

```
npx tsc --noEmit
npx vitest run profile-setup-normalize
curl -X PUT -H 'content-type: application/json' \
  -d '{"setup":{"editor":"Zed"}}' http://localhost:3000/api/users/me
curl -X PUT -H 'content-type: application/json' \
  -d '{"setup":null}' http://localhost:3000/api/users/me   # clears
curl -s localhost:3000/api/users/me | jq '.data.setup'      # normalized
```

---

## 6. Display UI

### Current state (verified)

Public profile rendering is in the same `src/app/[username]/page.tsx`, starting around line 398. `SocialLinks` (line 79–128) is the pattern to follow: render only non-empty links.

### Plan: `SetupCard` component

New file: `src/components/profile/SetupCard.tsx`.

- Props: `setup: ProfileSetup | null`.
- Short-circuit to `null` if the blob is null or every field is empty (prevents empty placeholder card).
- Layout: **labeled rows, not icon grid**. Rationale:
  - Fields are heterogeneous (URLs, chip lists, long strings like "M4 Max MBP 64GB"). Icon grid forces uniformity that doesn't fit.
  - A two-column `dl` (label / value) scans fast and is trivial in Tailwind.
  - Group headings: Hardware, Editor & Terminal, AI, Workflow. Only render a group if at least one field in it is present.
  - Special rendering:
    - `mcpServers`: render as chips.
    - `dotfilesUrl`: render as external link with GitHub icon if host includes `github.com`, else generic globe.
    - `os` / `editor` / `terminal`: optionally pair with a small lucide icon (Monitor, Code, TerminalSquare) but keep text-forward.

**Mount point:** below the header/bio block (around `src/app/[username]/page.tsx:480`, before "Shared Reports"), full-width. The avatar+bio header is a flex layout (page.tsx:401) — long values like "M4 Max MBP 64GB" or chip lists wrap more predictably in a full-width block underneath than in a right rail.

**Also update `src/app/api/users/[username]/route.ts`** (public GET) to include `setup` in its Prisma select, and `UserProfile` interface (line 38–64 of the page file) to add `setup?: ProfileSetup | null`.

**Verification:**

- Manually visit `/yourname` with an empty setup → no card renders.
- Fill two fields via edit → only those two rows render, only their group heading renders.

---

## 7. Auto-Derivation Pass

On the edit form's mount, pre-fill suggestions from the user's most recent uploaded report.

### Source fields in `harnessData` (verified in `src/types/insights.ts` lines 225–250)

- `harnessData.perModelTokens: Record<string, {input,output,cache_read,cache_create}>` → `primaryModel` = key with max **active tokens** (`input + output`, deliberately excluding cache reads/creates — cache traffic distorts the "primary" signal toward whichever model happened to inherit long cached context, which isn't what "primary model" should mean). **Falls back to** `harnessData.models` (message count) if `perModelTokens` absent.
- `harnessData.mcpServers: Record<string, number>` → `mcpServers` = array of keys, sorted by count desc, top N=8.
- `harnessData.cliTools: Record<string, number>` → `packageManager` = first match in the known set `{pnpm, npm, yarn, bun, uv, pip, cargo, go, mise}`, picking the highest-count match if multiple.
- **OS hint**: scan `harnessData.harnessFiles: string[]` + `harnessData.versions: string[]` for `/Users/` (macOS), `/home/` (Linux), `C:\` or `\\wsl$` (Windows/WSL). **The helper returns ONLY `{ os: "macOS" }` — never the matched path, never logs evidence, never serializes the source string.** Local file paths are classified as high-risk private data per `docs/research/review-step-design.md`.

### Privacy filtering on the source side

The derivation helper must operate on **privacy-filtered** harness data, not raw — `harnessFiles` and `mcpServers` are both hideable via `hiddenHarnessSections`. The suggestions endpoint must:

1. Select `hiddenHarnessSections` alongside `harnessData` from the report.
2. Run `stripHiddenHarnessData(harnessData, hiddenHarnessSections)` (existing helper in `src/lib/harness-section-visibility.ts`) to produce filtered data.
3. Derive from the filtered output. If a section is hidden, the corresponding suggestion is simply absent — not an error.

### Flow

1. New API endpoint `GET /api/users/me/setup-suggestions` (new file: `src/app/api/users/me/setup-suggestions/route.ts`):
   - Find `InsightReport` for the current user where `reportType = 'insight-harness'`, ordered by `createdAt desc`, take first.
   - Pull `harnessData` JSON + `hiddenHarnessSections`. Normalize via `normalizeHarnessData`. Strip hidden sections via `stripHiddenHarnessData`.
   - Derive `{ primaryAgent: "Claude Code", primaryModel?, mcpServers?, packageManager?, os? }` via `deriveSetupFromHarness(filtered)`.
   - Return `{ status: "ok", suggestions: {...}, sourceReportId, sourceReportCreatedAt }` OR `{ status: "no-reports" }` (no insight-harness reports yet) OR `{ status: "no-suggestions" }` (report exists but every field came back empty).
2. In `ProfileEditForm`, when the "Developer Setup" section is first expanded, fetch this endpoint. For each derived field that is currently empty in the form, render an inline `"Suggest: claude-sonnet-4-5 — use?"` chip that fills the field on click.
   - For `mcpServers`: render the list with copy "Review names before publishing — server names can hint at private projects."
   - **Do not auto-save; do not auto-fill inputs.** User confirms per field.
3. If user already has `setup.primaryModel` set (etc.), don't suggest over it.

### UI states for the suggestions panel

| State                           | UI                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| loading                         | small spinner + "Looking at your latest harness report…"                           |
| `status: "no-reports"`          | dimmed copy: "Upload a harness report to get setup suggestions." (link to /upload) |
| `status: "no-suggestions"`      | dimmed copy: "No suggestions from your latest report." (no error tone)             |
| `status: "ok"` with suggestions | inline "Suggest: X — use?" chips next to each empty field                          |
| fetch failed                    | dimmed copy: "Couldn't load suggestions." (no error toast — non-critical)          |
| field already filled            | suppress the chip for that field; if user clears the field later, re-show          |
| chip clicked → field filled     | chip disappears; field updates dirty state for the form's save button              |

### Helper file

New: `src/lib/profile-setup-derive.ts` — pure function `deriveSetupFromHarness(harness: HarnessData): Partial<Pick<ProfileSetup, 'primaryAgent' | 'primaryModel' | 'mcpServers' | 'packageManager' | 'os'>>`. Unit-tested independently. Never returns paths or other evidence.

**Verification:**

```
npx vitest run profile-setup-derive
```

Test cases:

- empty harness → `{}`
- harness with only `models` (no `perModelTokens`) → primaryModel from count fallback
- harness with `perModelTokens` → primaryModel from token share (different from count winner)
- harness with `mcpServers` → mcpServers array, top 8, sorted
- harness with `cliTools` containing pnpm + npm → packageManager = highest-count match
- Windows-path `harnessFiles` → os: "Windows", **no path returned in result**
- Linux-path `versions` → os: "Linux"
- harness with `mcpServers` filtered out by `stripHiddenHarnessData` → no mcpServers suggestion

---

## 8. Privacy

- Copy at the top of the Setup section in the edit form: "These appear publicly on your profile. Leave blank to hide."
- Above the MCP servers field specifically: "Review names before publishing — server names can hint at private projects."
- `SetupCard` never renders empty fields or empty groups, so blanks are truly invisible (not just "N/A").
- `dotfilesUrl` runs through the same `isValidUrl` check used for social URLs (rejects non-http(s)).
- **OS heuristic helper returns ONLY the label** (`{ os: "macOS" }`), never the matched path, never logs evidence, never includes the source string in the response. Test asserts the helper output contains no `/Users`, `/home`, `C:\` strings.
- Auto-derivation runs on `stripHiddenHarnessData(...)` output, so any user-hidden harness section (e.g. mcpServers, harnessFiles) is also absent from suggestions.
- API normalization runs on **read** paths too — old/malformed JSON from manual DB edits or version drift can't leak unknown keys through public endpoints.

**Decision:** `setup` does NOT get a separate `setupVisible: boolean` flag. Blank-field semantics cover the use case. Add later if users ask.

---

## 9. Phased Rollout

### Phase A — Schema, types, normalize helper

1. Add `src/types/profile.ts` with `ProfileSetup`, `PROFILE_SETUP_VERSION`, the user-fields subset type used by the derive helper.
2. Add `src/lib/profile-setup-normalize.ts` with `normalizeSetup(raw, prevStored?)`.
3. Edit `prisma/schema.prisma` to add `setup Json?` on `User`.
4. Create migration `prisma/migrations/<UTC-timestamp>_add_user_setup/migration.sql` (`ALTER TABLE "User" ADD COLUMN "setup" JSONB;`).
5. Update `src/app/api/users/me/route.ts`: include `setup` in both `select` blocks; widen `updateData` accumulator type; accept+validate in PUT via `normalizeSetup`; allow "clear to null" as a valid update; use `Prisma.JsonNull` when clearing; normalize on read before returning.
6. Update `src/app/api/users/[username]/route.ts` GET to include `setup` in select and run through `normalizeSetup` before returning.

**Verify:**

```
npx prisma validate && npx prisma generate && npx prisma migrate deploy
npx tsc --noEmit
npx vitest run profile-setup-normalize
curl -s localhost:3000/api/users/me | jq .data.setup   # null on a fresh user
curl -s -X PUT -H 'content-type: application/json' \
     -d '{"setup":{"editor":"Zed"}}' localhost:3000/api/users/me
curl -s -X PUT -H 'content-type: application/json' \
     -d '{"setup":null}' localhost:3000/api/users/me   # clears to null
```

### Phase B — Display

7. Create `src/components/profile/SetupCard.tsx`.
8. Wire into `src/app/[username]/page.tsx`: add `setup` to `UserProfile` interface, render `<SetupCard setup={profile.setup} />` below header/bio, full-width, before "Shared Reports".

**Verify:** visual check `/your-username` with manually-seeded setup via the API. Confirm empty groups don't render. Confirm that an old/malformed setup blob (manually inserted) returns normalized output, not raw.

### Phase C — Edit UI

9. Extend `EditFormData` in `src/app/[username]/page.tsx` with `setup` object. Add a collapsible "Developer Setup" section to `ProfileEditForm`.
10. Create `src/lib/profile-setup-suggestions.ts` with autosuggest arrays and wire up `<datalist>`.
11. Quick `Grep` check first: is there an existing autosuggest component pattern in `src/components` to reuse, or is `<datalist>` the project's first use? If a pattern exists, follow it.

**Verify:** edit a field, save, reload — persists and displays. Edit and clear all fields, save — `setup` returns to null in the GET response.

### Phase D — Auto-derivation

12. Create `src/lib/profile-setup-derive.ts` + tests (covering all cases listed in §7).
13. Create `src/app/api/users/me/setup-suggestions/route.ts` — runs `stripHiddenHarnessData` before deriving.
14. Wire suggestion chips + state machine (loading / no-reports / no-suggestions / ok / failed / applied) into the edit form.

**Verify:** upload a harness report, open edit form, confirm suggestions appear and fill on click. Hide `mcpServers` on a report, refresh suggestions, confirm mcpServers suggestion is absent. Test the no-reports state on a fresh user.

---

## 10. Resolved Decisions

1. **Layout:** `SetupCard` mounts below the header/bio block, full-width, before "Shared Reports".
2. **Type location:** new file `src/types/profile.ts`.
3. **`setupUpdatedAt`:** baked into the JSON blob, **server-owned only** — never accept from client; only refresh when the normalized user-fields payload actually changes.
4. **MCP input UI:** comma-separated text → `string[]` for v1. Proper chip input deferred.
5. **Schema version:** `version: 1` baked into the blob and the type alias `PROFILE_SETUP_VERSION`.
6. **Autosuggest:** check for an existing generic component in Phase C step 11. If absent, use native `<input list>` + `<datalist>` for v1.

## 11. Outstanding Open Questions

None blocking implementation. v2 questions (sortable freshness column, search/filter over setup, chip input, v1→v2 schema migration) are tracked under §2.

---

### Critical Files for Implementation

- /Users/craigdossantos/Coding/insightful/prisma/schema.prisma
- /Users/craigdossantos/Coding/insightful/src/app/api/users/me/route.ts
- /Users/craigdossantos/Coding/insightful/src/app/[username]/page.tsx
- /Users/craigdossantos/Coding/insightful/src/app/api/users/[username]/route.ts
- /Users/craigdossantos/Coding/insightful/src/types/insights.ts (HarnessData reference for auto-derive)
