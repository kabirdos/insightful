# Implementation Plan: Per-Item Eye Toggle on Report Edit Page (#28)

**Date:** 2026-04-11
**Issue:** [kabirdos/insightful#28](https://github.com/kabirdos/insightful/issues/28)
**Status:** Planning — no code changes yet

---

## 1. Data model decision: flat keypath list (option a)

**Decision:** Extend the existing `hiddenHarnessSections: String[]` column to hold nested keypaths. Rename is optional — the field already holds "hide keys" and we avoid a Prisma migration.

**Why:**

- No schema migration, no backfill risk.
- Existing section-level keys (`"heroStats"`, `"skillInventory"`, ...) become a proper subset of the new keypath grammar: a bare top-level key means "hide whole section", and keys with a separator mean "hide a sub-item".
- The issue explicitly prefers this.
- A JSON column (option b) would force either `Prisma.JsonValue` parsing in every renderer or a type-wrapper. More moving parts for the same semantics.

**Trade-off accepted:** linear scans during render. In the hot path we build a `Set<string>` from the array once per render — O(1) lookups thereafter.

**If we had chosen option b (for the record):** A new `hiddenItems Json?` column shaped `Record<sectionKey, Record<itemKey, true>>` would need (1) a Prisma migration adding a nullable column, (2) a one-time backfill converting existing `hiddenHarnessSections` entries into `hiddenItems[key] = { __section: true }`, (3) dual-read fallback for a release, (4) an `allowed-fields.ts` extension. Doable, but significantly more risk for marginal gain.

---

## 2. Keypath grammar (the hardest part)

### Design goals

- **Stable across reorders** — array index alone is fragile.
- **Stable across content edits** — if a workflow title is edited, the hide state should follow.
- **Unique within its parent list** — two items in the same list must never collide.
- **Human-debuggable** in the DB (`psql` inspection should be sane).
- **Forward-compatible** — easy to add new hideable sub-lists without rewriting existing keys.

### Grammar

```
keypath := topKey
         | topKey "." itemKey

topKey  := [a-zA-Z][a-zA-Z0-9]*          // existing section keys (e.g. "skillInventory", "impressiveWorkflows")
itemKey := slugFragment ("@" indexFallback)?
slugFragment := url-safe slug of the item's stable natural key (lowercased, kebab-cased, 60 char max)
indexFallback := integer (the item's index at save time)
```

### Stable identifier strategy per list

For each hideable sub-list, pick the most stable natural key available:

| Section                                                     | List                      | Stable natural key            | Fallback                          |
| ----------------------------------------------------------- | ------------------------- | ----------------------------- | --------------------------------- |
| `impressiveWorkflows`                                       | `.impressive_workflows[]` | `slug(title)`                 | `@index`                          |
| `frictionAnalysis`                                          | `.categories[]`           | `slug(category)`              | `@index`                          |
| `projectAreas`                                              | `.areas[]`                | `slug(name)`                  | `@index`                          |
| `suggestions`                                               | `.claude_md_additions[]`  | `slug(addition[:48])`         | `@index`                          |
| `suggestions`                                               | `.features_to_try[]`      | `slug(feature)`               | `@index`                          |
| `suggestions`                                               | `.usage_patterns[]`       | `slug(title)`                 | `@index`                          |
| `onTheHorizon`                                              | `.opportunities[]`        | `slug(title)`                 | `@index`                          |
| `skillInventory`                                            | items                     | `slug(name)`                  | `@index`                          |
| `plugins`                                                   | items                     | `slug(name)`                  | `@index`                          |
| `hookDefinitions`                                           | items                     | `slug(event + "-" + matcher)` | `@index`                          |
| `harnessFiles`                                              | items                     | `slug(file)`                  | `@index`                          |
| `writeupSections`                                           | items                     | `slug(title)`                 | `@index`                          |
| `versions`                                                  | items                     | `slug(version)`               | none (version strings are unique) |
| `agentDispatch.types`                                       | record entries            | `slug(typeName)`              | none (object keys are unique)     |
| `agentDispatch.models`                                      | record entries            | `slug(modelName)`             | none                              |
| `toolUsage`                                                 | record entries            | `slug(toolName)`              | none                              |
| `languages` / `mcpServers` / `cliTools` / `permissionModes` | record entries            | `slug(key)`                   | none                              |

### Collision policy

Because slugs can collide (e.g. two workflows titled "Refactor"), the `itemKey` appends `@<index>` **only when a duplicate slug is detected within the same list at save time**. Logic:

```
function itemKeyFor(list, index, naturalKey):
  base = slug(naturalKey)
  duplicates = list.filter(x => slug(naturalKey(x)) === base)
  if duplicates.length <= 1: return base
  return `${base}@${index}`
```

This means:

- Non-colliding items keep a human-readable, reorder-stable key forever.
- Colliding items fall back to positional disambiguation — acceptable because colliding items are usually near-duplicates anyway, and the `@` suffix makes the fragility explicit on inspection.

### Examples

```
impressiveWorkflows                           // hide whole section (existing behavior)
impressiveWorkflows.parallel-refactor         // hide one workflow card
frictionAnalysis.test-flakiness               // hide one friction category
agentDispatch.types.general-purpose           // hide one agent type row
skillInventory.superpowers-brainstorming      // hide one skill card
impressiveWorkflows.refactor@2                // collision disambiguated by index
```

### Central resolver module

Introduce a single pure module that owns the grammar:

```
src/lib/item-visibility.ts   (new)

export function slugItemKey(natural: string): string
export function buildItemKey(list: T[], index: number, natural: (t:T)=>string): string
export function isItemHidden(hidden: Set<string>, sectionKey: string, itemKey: string): boolean
export function isSectionHidden(hidden: Set<string>, sectionKey: string): boolean   // true if topKey present
export function hideSetFromArray(arr: readonly string[]): Set<string>
export function filterList<T>(list: T[], hidden: Set<string>, sectionKey: string, natural: (t:T)=>string): T[]
export function filterRecord<T>(rec: Record<string, T>, hidden: Set<string>, sectionKey: string): Record<string, T>
```

Every renderer and the server-side stripper imports from this one file. If the grammar ever changes, it changes in one place.

---

## 3. Server-side filtering audit

This is the section the issue most cares about, and the **current state has a pre-existing privacy leak** we should fix while we're here.

### Files where `hiddenHarnessSections` is touched today

| #   | File                                     | Lines                   | Role                                                                                                                                                              | Change needed                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/lib/harness-section-visibility.ts`  | 1–135                   | Section key constants + `stripHiddenHarnessData` (full-section strip only)                                                                                        | Extend with item-level strippers; likely moved/renamed into a broader `src/lib/item-visibility.ts` or a companion module that reuses the same hidden-set.                                                                                                                                                                                                 |
| 2   | `src/app/api/insights/[slug]/route.ts`   | GET 18–139, PUT 141–200 | GET returns harnessData + all narrative sections unfiltered. **No filtering currently applied server-side to `harnessData` on GET.**                              | **CRITICAL:** Apply `stripHiddenHarnessData` (extended version) to `report.harnessData` AND filter hidden items out of every narrative JSON column before serialization. Bypass only when `userId === report.authorId` so the owner still sees hidden items on the edit page (gated behind the same `includeHidden=true` flag already used for projects). |
| 3   | `src/app/api/insights/[slug]/route.ts`   | PUT 141–200             | Passes through `body[field]` for any allowed field                                                                                                                | No behavioral change, but confirm `hiddenHarnessSections` keypaths round-trip correctly via the existing `ALLOWED_PUT_FIELDS` allowlist.                                                                                                                                                                                                                  |
| 4   | `src/app/api/insights/allowed-fields.ts` | 36                      | Allowlist already contains `"hiddenHarnessSections"`                                                                                                              | No change — we are reusing the same column. Add a comment documenting the new keypath grammar.                                                                                                                                                                                                                                                            |
| 5   | `src/app/api/insights/route.ts`          | 229–399                 | POST creation path. Already persists `hiddenHarnessSections` as-is from the upload body (line 397–399).                                                           | Accept keypath entries without validation changes — already `Array.isArray` checked. No code change strictly required, but consider adding a grammar sanity check to reject malformed entries.                                                                                                                                                            |
| 6   | `src/app/upload/page.tsx`                | 51, 679–762             | Calls `stripHiddenHarnessData` at creation time and stores the stripped `harnessData`. Line 760 is the ONLY place the strip actually happens in production today. | Call the extended `stripHiddenHarnessData` that also prunes per-item hides built up during upload. (Even though the upload-time UI is section-level today, we want the server stripper to be capable so the GET endpoint can reuse it.)                                                                                                                   |
| 7   | `src/app/insights/[slug]/page.tsx`       | 36, 71, 270, 341–640    | Client-side gate using `isHarnessSectionHidden`. The harnessData payload arrives whole.                                                                           | Two changes: (a) switch to `isSectionHidden` / `isItemHidden` helpers, (b) trust the server to have already stripped (defense in depth still gates client-side).                                                                                                                                                                                          |
| 8   | `src/app/insights/[slug]/edit/page.tsx`  | 25, 61, 166, 311        | Edit page. Fetches with `?includeHidden=true`.                                                                                                                    | Must fetch unfiltered harnessData + narrative sections — GET must honor `includeHidden=true` for the owner so the owner can toggle items back on. Add per-item `HideableCard` mounts (see §5).                                                                                                                                                            |

### Non-hits (confirmed clean)

Grepping `hiddenHarnessSections` returned 6 files — all listed above. No other call sites.

### New server-side filter strategy (recommendation)

Introduce a single function, `filterReportForResponse(report, { viewerIsOwner, includeHidden })`, that:

1. Parses `hiddenHarnessSections` into a `Set<string>`.
2. If `viewerIsOwner && includeHidden` → returns the report untouched (owner edit view).
3. Otherwise:
   - Calls extended `stripHiddenHarnessData(harnessData, hiddenSet)` — now also prunes items out of lists/records when keypaths are present.
   - Walks each narrative section (`atAGlance`, `interactionStyle`, ..., `funEnding`) and filters its sub-arrays (e.g. `impressiveWorkflows.impressive_workflows`, `frictionAnalysis.categories`, etc.) based on the per-item hides.

Call it from `GET /api/insights/[slug]` (line ~122 in `route.ts`, right before the final `NextResponse.json`), and also from any other endpoint that returns reports (e.g. list endpoints — see `src/app/api/insights/route.ts` GET / homepage feed — confirm no harnessData leaks there).

**Pre-existing leak to fix in the same PR:** currently `GET /api/insights/[slug]` returns `harnessData` verbatim even for section-level hides added via the edit page. Only upload-time hides get stripped. This PR closes the hole for both section and item granularities.

---

## 4. Renderer updates

### Public detail page — `src/app/insights/[slug]/page.tsx`

Replace direct `.map` calls over these lists/records with the `filterList` / `filterRecord` helpers from `item-visibility.ts`, using the owner-visible hidden set (which, post-server-strip, will be the empty set for non-owners — the filter is defense in depth):

- Line ~394: `skillInventory` → `<SkillCardGrid skillInventory={filterList(...)} />`
- Line ~400: `plugins.map`
- Line ~409: `plugins` inner map inside CollapsibleSection
- Line ~480: `agentDispatch.types` entries
- Line ~496: `agentDispatch.models` entries
- Line ~524: `agentDispatch.customAgents.map`
- Line ~541: `languages` entries
- Line ~561: `mcpServers` entries
- Line ~590: `versions.map`
- Line ~612: `writeupSections.map`
- Line ~639: `harnessFiles.map`
- `toolUsage` → already a whole-section toggle; leave as-is initially, add per-key filter as a stretch.

### Narrative section renderer — `src/components/SectionRenderer.tsx`

Each sub-renderer maps over a list and must filter against the hidden set. The cleanest path: accept an optional `hiddenItems?: Set<string>` prop + `sectionKey`, then filter at the top of each case:

- Line 211: `ProjectAreasSection` → filter `data.areas`
- Line 244: `ImpressiveWorkflowsSection` → filter `data.impressive_workflows`
- Line 276: `FrictionAnalysisSection` → filter `data.categories`
- Line 325: `SuggestionsSection` → filter `claude_md_additions`, `features_to_try`, `usage_patterns` (three separate lists under one `sectionKey`, so their itemKeys must include a list discriminator — see below)
- Line 454: `OnTheHorizonSection` → filter `data.opportunities`

**Nested-list problem:** `suggestions` contains three sibling lists. Grammar extension: the `itemKey` for these is `<list>/<slug>`, so full keypath is e.g. `suggestions.features_to_try/worktrees`. Slash-separated list discriminator — chosen because `/` doesn't appear in slugs and keeps the grammar parseable by splitting on the first `.`.

### Components not needing changes

- `HeroStats`, `HowIWorkCluster`, `ActivityHeatmap`, `GitPatternsDisplay`, `PermissionModeDisplay` — no sub-items; section-level hide is still the right granularity. Just keep existing section toggle.
- `HarnessSections.tsx` — appears unused on the detail page today (grep showed it's imported but the detail page uses individual components). Sanity check its usage in upload flow; likely no change.

---

## 5. Edit page UI changes — `src/app/insights/[slug]/edit/page.tsx`

### Current `HideableCard` usage (lines 102–127)

Only the section heading has a toggle. Children render unconditionally inside `!hidden && children`.

### New pattern: `HideableCard` stays, new `HideableItem` for per-item toggles

```tsx
<HideableCard title="Skills" hidden={sectionHidden("skillInventory")} onToggle={...}>
  <SkillCardGrid
    skillInventory={skillInventory.map((skill, i) => (
      <HideableItem
        key={skill.name}
        hidden={itemHidden("skillInventory", itemKey(skillInventory, i, s => s.name))}
        onToggle={() => toggleItem("skillInventory", itemKey(...))}
      >
        <SkillCard skill={skill} />
      </HideableItem>
    ))}
  />
</HideableCard>
```

A `HideableItem` wrapper just renders the EyeToggle above the child and applies `opacity-50` when hidden (same affordance as `HideableCard`).

### Mount points on the edit page

Every `HideableCard` in the edit page currently at lines 468–819 that wraps a list gets per-item toggles added inside. Specifically:

- Line 531 `skillInventory` → wrap each `SkillCard`
- Line 541 `plugins` → wrap each plugin card (line 554 `.map`)
- Line 626 `agentDispatch` → wrap each row in `types`, `models`, `customAgents`
- Line 681 `languages` → wrap each `MiniBarChart` row (may require threading into `MiniBarChart` or pre-filtering at parent)
- Line 705 `mcpServers` → wrap each row
- Line 738 `versions` → wrap each badge
- Line 764 `writeupSections` → wrap each section block
- Line 795 `harnessFiles` → wrap each file row

For narrative sections (lines 886–925) — today the whole section is rendered via `SectionRenderer` with `readOnly`. Two options:

- **(a)** Add per-item toggles inside the edit-page rendering by bypassing `SectionRenderer` and re-rendering the list inline with toggles.
- **(b)** Add a `mode` / `renderItemWrapper` prop to `SectionRenderer` so it can optionally mount an EyeToggle around each item.

**Recommendation: (b).** Keeps one source of truth for the rendering and avoids duplicating `ImpressiveWorkflowsSection` etc. The `renderItemWrapper` prop is a function `(listKey, itemKey, children) => ReactNode` that defaults to identity.

### State shape change

Currently the edit page uses `hiddenSections: Record<string, boolean>` (line 137). Keep the same shape — it already accepts arbitrary string keys. Swap the keys from `"skillInventory"` to full keypaths like `"skillInventory.superpowers-brainstorming"`. The `getHiddenHarnessSections` helper (line 311) already just filters by truthy — no change required.

But: the `HIDEABLE_HARNESS_SECTION_KEYS` allowlist in `harness-section-visibility.ts` currently constrains `getHiddenHarnessSections` to known top-level keys. That allowlist needs to be relaxed to accept keypaths (i.e. pass through any string key whose topKey is in the allowlist).

### Save-behavior change

Currently hidden narrative sections get `body[section.key] = null` (line 307). That is a **hard delete** — the column is nulled. For per-item hides this would be catastrophic (we can't delete individual items without tracking which items). Recommendation:

- Section-level hide continues to null the whole JSON column (backward-compatible, destructive — this matches the existing confirmation modal).
- Item-level hide only writes into `hiddenHarnessSections` keypaths; the JSON column keeps the full data (so the owner can unhide).
- The destructive confirmation modal (lines 940–985) only fires when a top-level section is hidden, not when per-item hides are toggled.

This creates an **owner data-retention asymmetry**: section hides are destructive, item hides are soft. Document this loudly in the UI.

---

## 6. Backward compatibility

### Existing data

Existing `hiddenHarnessSections` arrays contain only top-level keys like `["skillInventory", "plugins"]`. The new grammar treats those as "hide whole section" — 100% backward-compatible. No migration script required.

### Existing renderers

`isHarnessSectionHidden(arr, key)` keeps working for top-level keys because `arr.includes(key)` still returns true. We do NOT remove this helper; new helpers are added alongside.

### Section-level "hide all" convenience

When the user toggles a section off on the edit page, we set the top-level key in the hidden set. Renderers check the top-level key first; if present, they skip the whole section without even looking at per-item hides.

When the user hides all items in a section one-by-one, we do NOT automatically promote to a section-level hide — leave it as N item entries. A stretch: detect "every child hidden" and offer a "hide whole section" promotion, but not for v1.

### Destructive vs non-destructive parity

Existing behavior: hiding a narrative section hard-deletes its JSON column on save. New per-item behavior: soft hide via keypaths. Owners should see a tooltip/badge distinguishing the two. No data migration needed — we just document the asymmetry.

---

## 7. Test plan

### Unit tests (new)

Create `src/lib/__tests__/item-visibility.test.ts` covering:

- `slugItemKey` — idempotent, handles emoji/unicode, kebab-cases, trims
- `buildItemKey` — no collision → bare slug; collision → `slug@index` on the duplicates only
- `isItemHidden` / `isSectionHidden` — top-level hide trumps per-item; per-item works independently
- `filterList` / `filterRecord` — correctness with zero/one/many hides
- Grammar parser — rejects malformed keys; round-trips valid ones

### Integration tests (new)

`src/app/api/insights/__tests__/get-filter.test.ts`:

- Report with no hides → full payload
- Report with top-level hide → section stripped from harnessData AND narrative JSON
- Report with item-level hide → matching items removed from lists/records
- Owner with `?includeHidden=true` → full payload returned (unfiltered)
- Non-owner with `?includeHidden=true` → still filtered (security check)
- **Privacy regression test:** JSON.stringify(response) must not contain the hidden item's natural key anywhere

Extend `src/app/api/insights/__tests__/put.test.ts`:

- Posting `hiddenHarnessSections` with keypath entries round-trips

### Renderer tests (new)

`src/components/__tests__/SectionRenderer.test.tsx`:

- Each narrative sub-renderer filters out items listed in `hiddenItems` set
- `renderItemWrapper` is called with correct `(sectionKey, itemKey, children)` tuple
- Unknown keypaths pass through (don't crash)

### E2E / manual QA

- Load an existing report (pre-migration data) → renders identically.
- Hide one workflow → save → reload → still hidden → public URL in incognito does not expose the hidden workflow in the network response (inspect JSON).
- Hide a whole section → save → destructive confirmation fires → data gone.
- Toggle item back on from edit page → item reappears.

---

## 8. Risk list

### Privacy (highest priority)

- **Pre-existing leak:** today's GET handler returns `harnessData` unfiltered except for upload-time hides. We must fix this in the same PR. Any test PR that only adds renderer filters without server stripping would ship the hole.
- **Defense in depth:** keep client-side filters even after server strip. Bugs in the server filter would otherwise immediately leak.
- **Owner-bypass attack:** the `?includeHidden=true` flag must verify `userId === report.authorId` **before** returning unfiltered data. It already does for projects (route.ts lines 83–92) — the same guard must wrap the harness/narrative strip.

### Keypath stability

- **Rename drift:** if a user edits a workflow title after hiding it, the slug changes and the hide state is lost. Two mitigations: (a) accept this as "rename = unhide" with a visible warning, (b) maintain a `previousItemKey` hint. v1: accept it, document it.
- **Collision hash drift:** if a 3rd duplicate is added to a list that previously had 2 duplicates, indexes might shift. Mitigation: `@index` is assigned at save time using the list state at save time, and the client reconciles after fetching. Acceptable edge-case.

### Destructive-save confusion

- Users may not realize section-hide is destructive while item-hide is soft. UX risk. Mitigation: inline badge/tooltip on section-level toggles ("Removes all items permanently on save").

### Performance

- `Set<string>` lookup is O(1), filter passes are O(n) per list. For reports with ~50 total hideable items this is unmeasurable. No concern.

### Type safety

- `hiddenHarnessSections` is currently typed `HideableHarnessSectionKey[]` in the helper. Widening to `string[]` loses the exhaustiveness check. Mitigation: introduce a branded `HiddenKeyPath` type and a parse function that validates topKey membership.

### Third-party components

- `SkillCardGrid`, `MiniBarChart`, `CliToolsDonut`, `ToolUsageTreemap` take whole records/arrays. Per-item hide is implemented by pre-filtering before passing in — no component API changes required.

---

## 9. Work size & PR breakdown

### Estimate

- **New files:** 2 (`src/lib/item-visibility.ts`, `src/components/HideableItem.tsx`) + 3 test files
- **Modified files:** 8
  1. `src/lib/harness-section-visibility.ts` (extend stripper)
  2. `src/app/api/insights/[slug]/route.ts` (server-side filter in GET)
  3. `src/app/api/insights/allowed-fields.ts` (comment only)
  4. `src/components/SectionRenderer.tsx` (renderItemWrapper + per-case filtering)
  5. `src/app/insights/[slug]/page.tsx` (swap to new helpers, defense-in-depth filter)
  6. `src/app/insights/[slug]/edit/page.tsx` (HideableItem mounts, state-key grammar)
  7. `src/app/upload/page.tsx` (call extended stripper)
  8. `src/app/api/insights/route.ts` (POST — optional grammar validation)
- **Total LOC:** ~600–900 lines added/modified, most of it in the edit page and SectionRenderer.

### PR breakdown recommendation

**Ship as TWO PRs**, in order:

**PR 1 — Foundation + server-side strip (privacy fix):**

- New `src/lib/item-visibility.ts` + unit tests
- Extend `stripHiddenHarnessData` to handle keypaths
- Apply server-side filter in `GET /api/insights/[slug]`
- Apply server-side filter in `POST /api/insights` and the list feeds
- Integration tests for server stripping (including the regression test for the pre-existing leak)
- **No UI changes** — existing section-level hides now get properly stripped server-side, which is a pure privacy fix independent of the per-item UI.
- Ship alone, deploy, verify in production that nothing regressed.

**PR 2 — Per-item UI:**

- `HideableItem` component
- `SectionRenderer` renderItemWrapper + filtering
- Edit page per-item toggles
- Public detail page switch to new helpers
- Renderer + E2E tests

**Why two PRs:** PR 1 fixes the pre-existing privacy leak on its own and is fully reviewable without wading through UI diffs. PR 2 depends on PR 1 but is a large UI change; keeping them separate means the privacy fix can ship (and be reverted independently) without blocking on UI design review. If reviewer prefers one PR, the code is still organized into two commits within it.

### Out of scope (punt to follow-ups)

- Drag-to-reorder items (issue "Out of scope")
- Per-item annotations/edits
- Auto-promoting "all items hidden" to a section-level hide
- Migrating destructive section hides to soft hides (bigger design question)

---

## Critical Files for Implementation

- `src/lib/harness-section-visibility.ts`
- `src/app/api/insights/[slug]/route.ts`
- `src/app/insights/[slug]/edit/page.tsx`
- `src/components/SectionRenderer.tsx`
- `src/app/insights/[slug]/page.tsx`
