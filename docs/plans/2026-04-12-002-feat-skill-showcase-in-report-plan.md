---
title: "feat: Skill showcase in insight harness reports"
type: feat
status: completed
date: 2026-04-12
origin: docs/brainstorms/2026-04-11-skill-showcase-integration-requirements.md
---

# Skill Showcase in Insight Harness Reports

## Overview

Extend the Insight Harness pipeline so users can publish their skills — README content and hero images — as part of their shared report. Adds a Skills section to the report page with a teaser card up top and a full renderable showcase below. Data flows through the existing JSON blob transport layer (no new column, no new endpoint); visibility reuses the existing `hiddenHarnessSections` keypath mechanism.

## Problem Frame

Today insight harness reports show skills only as keyword-inferred labels in `src/lib/skill-detector.ts` and as a bare-name list in the harness's `skillInventory`. That loses the actual content — README, hero, description — that makes a skill discoverable by a fellow Claude Code user.

The brainstorm (see origin) frames this as a "steal my setup" feature: reports become practical resources, not just self-reflection. With the JSON data layer now shipped (see `docs/plans/2026-04-12-001-refactor-json-data-layer-plan.md`), the transport is trivial — extend the existing `skillInventory` entries with optional `readme_markdown` and `hero_base64` fields, and the render layer does the rest.

## Requirements Trace

Carried forward from origin brainstorm:

- R1–R6: Data collection in `extract.py` — opt-in `--include-skills` flag, README + hero read, PII scrub, filter `repo: private`/`repo: none`, payload shape
- R7–R10: Upload review — per-skill visibility, single source of truth (hiding propagates)
- R11–R14: Teaser card on report page
- R15–R20: Dedicated renderable section (this plan renders as a section on the report page, not a separate route — see Key Technical Decisions)
- R21: API must apply `stripHiddenHarnessData` on `GET /api/insights/[username]/[slug]` (already implemented via `filterReportForResponse` — see Unit 5, now a regression-coverage unit)
- R22: Client-side PII scrub only
- R23–R25: Empty states and per-upload visibility reset

## Scope Boundaries

- **URL restructure already shipped (PR #84).** All routes in this plan target `/insights/[username]/[slug]` and `/api/insights/[username]/[slug]`. Use `src/lib/urls.ts` helpers when constructing paths in components.
- **Not building a separate `/[username]/skills` route.** The brainstorm originally proposed one. Per user direction during planning, the full showcase renders as a section on the existing report page (matches the brainstorm's scope boundary: "part of the Insight Harness report, not a separate product"). A dedicated profile-scoped route can follow as a separate plan.
- **Not adding object storage.** Heroes ride inside the existing harnessData JSON column as base64 data URIs.
- **Not adding cross-user skill search.**
- **Not modifying the standalone `skill-showcase` skill.** That remains a separate local tool. This plan ports its PII-scrub logic to Python but does not depend on or modify the JS version.
- **Not adding server-side PII scrubbing.** Client-side only in `extract.py`.

## Context & Research

### Relevant Code and Patterns

- `extract.py` — lives in the `kabirdos/insight-harness` plugin (installed locally at `~/.claude/plugins/cache/kabirdos-insight-harness/insight-harness/0.1.0/skills/insight-harness/scripts/extract.py` and developed at `~/Coding/insight-harness/skills/insight-harness/scripts/extract.py`). `extract_skill_inventory()` already walks `~/.claude/skills/` and plugin caches; `generate_html()` builds the JSON blob (search for `_skill_inventory_json`). Data extension happens in the **upstream `~/Coding/insight-harness` repo**, then released as a new plugin version (see Unit 1 dependencies).
- `src/types/insights.ts` — `HarnessData` interface, `SkillInventoryEntry` type, `normalizeHarnessData()`. New fields added here.
- `src/lib/harness-section-visibility.ts` — `stripHiddenHarnessData` already supports item-level keypaths like `skillInventory.<skill-name>`. No new visibility code needed; only new UI toggles.
- `src/lib/item-visibility.ts` — `filterList`, `filterRecord`, `parseKeypath`, `hideSetFromArray`. Already wired for skillInventory.
- `src/app/upload/page.tsx` — upload review step. **Currently uses `getHiddenHarnessSections` (top-level keys only) and strips `harnessData` before POST**. This plan switches it to `getHiddenKeypaths` to preserve item-level keypaths like `skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`) so server-side filtering can apply them on every GET (see Storage Decision below).
- `src/app/insights/[username]/[slug]/page.tsx` — report page. New Skills section inserted here.
- `src/app/api/insights/[username]/[slug]/route.ts` — already calls `filterReportForResponse` (which calls `stripHiddenHarnessData`). The brainstorm-flagged gap is **already closed** by the URL restructure work; Unit 5 becomes a regression-coverage unit, not a fix.
- `src/lib/filter-report-response.ts` — wraps `stripHiddenHarnessData` for the GET path. Unit 5 adds a regression test that hidden `skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`) keypaths drop `readme_markdown` + `hero_base64` from the response.
- `src/lib/urls.ts` — single source of truth for app URL construction. New components must import from here, not hand-build paths.
- `prisma/schema.prisma` — `hiddenHarnessSections String[]` on InsightReport already exists. No migration needed.
- `skills/skill-showcase/scripts/build-showcase.js` — reference implementation of the PII-scrub ruleset in JavaScript. Ported to Python in Unit 1.

### Institutional Learnings

- `docs/plans/2026-04-12-001-refactor-json-data-layer-plan.md` established that numeric round-trip bugs are caused by HTML scraping. The showcase data should ride the JSON transport from day one — no parallel HTML format.
- Existing item-level keypath pattern (`skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`)) is already load-bearing — reuse it rather than inventing a `hiddenSkills` column.

### External References

None needed. The markdown renderer decision (react-markdown + remark-gfm + rehype-sanitize) is a well-established pattern; full docs are version-locked when added to package.json.

## Key Technical Decisions

- **Extend `skillInventory` entries, don't create a parallel payload.** `SkillInventoryEntry` gets optional `readme_markdown`, `hero_base64`, `hero_mime_type`, `category`, `calls` fields. One source of truth per skill; existing visibility keypaths (`skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`)) already gate the expanded content. (Answers brainstorm Q "schema anchor".)
- **Reuse `hiddenHarnessSections` — no new column.** Per-skill toggles store keypaths generated via `buildItemKey(skillInventory, index, s => s.name)` from `src/lib/item-visibility.ts`, which slugs the name to kebab-case and appends `@<index>` on collision (e.g. `skillInventory.superpowers-brainstorming`, `skillInventory.my-skill@3`). **Never hand-build keypaths from raw names** — spaces, punctuation, casing, or duplicates will silently fail to match in `stripHiddenHarnessData`. `stripHiddenHarnessData` already filters these. Hiding in the existing skill inventory and in the new showcase section is unified by design. (Answers brainstorm Q9.)
- **Pre-existing parser bug fix: empty-slug names.** `buildItemKey` returns `@<index>` when the natural name slugs to empty (e.g. a skill named only with emoji / non-ASCII), but `parseKeypath` rejects item keys starting with `@` (regex requires `[a-z0-9]` first), so `getHiddenKeypaths` silently drops those hides. Unit 4 fixes this at the source: change `buildItemKey`'s empty-slug fallback to `item-${index}` (e.g. `item-0`, which parses cleanly), and update the existing `buildItemKey` "falls back to @index for empty slugs" test plus the `parseKeypath` allow-list test. This is a tiny, safe parser-compatibility fix — no callers rely on the `@0` shape today (verified via grep of test fixtures, which only use `refactor@0`-style collision suffixes).
- **Storage decision: persist FULL `harnessData` in DB; filter on every GET.** Today `upload/page.tsx` calls `stripHiddenHarnessData` client-side and stores the stripped result, AND uses `getHiddenHarnessSections` which silently drops item-level keypaths. This plan changes both: switch to `getHiddenKeypaths` (preserves keypaths) AND remove the client-side strip on POST so the DB holds the complete payload. Filtering happens server-side in `filterReportForResponse` on every read. **Why:** (a) lets the author re-toggle hidden skills later via an edit flow without re-uploading, (b) eliminates the silent keypath drop, (c) single chokepoint for visibility instead of two. **Trade-off:** DB rows are slightly larger (the hidden README/hero bytes are stored). Acceptable given the 8MB worst-case ceiling and that hidden data is the exception, not the rule.
- **Render the full showcase as a section on `/insights/[username]/[slug]`, not a separate route.** Matches brainstorm scope boundary. A future `/[username]/skills` alias belongs in a separate plan, not here.
- **Markdown renderer: `react-markdown` + `remark-gfm` + `rehype-sanitize`.** Sanitize with the default schema + a small allowlist for code fences and images; strip raw HTML. Inline images must use the `data:` URI scheme (the hero the user uploaded) — reject http(s) external images to prevent tracking pixels. (Answers R16.)
- **PII scrub in Python, in `extract.py`.** Port the JS regex ruleset: git username in URLs → `<your-username>`, `/Users/<name>/` → `~/`, git name/email → placeholders. Applied to README markdown text before serialization. Self-test fixture added alongside `extract.py`.
- **Hero cap: 300KB per image (pre-base64), PNG/JPEG only, SVG excluded.** 20 skills × 300KB × 1.33 ≈ 8MB heroes alone. SVG is rejected because the PII grep cannot see inside SVG script/CDATA blocks reliably.
- **Hard payload caps in `extract.py` (Unit 1), measured against the FINAL artifact — not the showcase subset:** per-README 100KB (truncate with a `<!-- truncated -->` marker), per-skill total (README + hero) 400KB. **Total budget: measure the serialized `harness_json` string byte length after each skill is added.** If adding the next skill would push serialized JSON past **6MB**, remaining skills emit summary fields only with `readme_markdown: null`, `hero_base64: null` and a stderr warning. The 6MB ceiling (not 9MB) accounts for: (a) the rest of `harness_json` (existing fields ~500KB–1MB on large users), (b) base64 bloat already counted, (c) JSON escaping overhead, (d) HTML wrapper and other embedded blobs, (e) a ~2MB safety margin below the 10MB Next.js body limit that applies to both `/api/upload` (multipart) AND the subsequent JSON POST to `/api/insights`. Skills emit in `calls`-desc order so high-value skills always fit. Verified by a 50-skill integration fixture in Unit 1 that asserts **both** final HTML file size AND the JSON POST body size stay under 10MB.
- **Opt-in via `--include-skills` flag.** Default extract runs unchanged. Absence of the flag means no showcase data ships — the existing skillInventory summary is unaffected.
- **Visibility resets on re-upload.** Matches R25 — simplest model, no cross-report state.
- **Categories from SKILL.md frontmatter only.** No inference. Skills without `category:` land in "Other". No TOC when no skill has a category.
- **API gap already fixed.** `GET /api/insights/[username]/[slug]` already calls `filterReportForResponse → stripHiddenHarnessData`. Unit 5 covers regression tests for item-level (`skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`)) keypath stripping in this code path — not net-new behavior.

## Open Questions

### Resolved During Planning

- Schema anchor for per-skill visibility → reuse `hiddenHarnessSections` with `skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`) keypaths (no migration)
- Payload shape → extend `skillInventory` entries, not a parallel `skills_showcase` key
- Toggle UI pattern → reuse existing item-level hide pattern in `src/app/upload/page.tsx`, same as how hook/plugin items are hidden today
- Render location → section on the report page; dedicated route deferred to URL-restructure plan
- PII scrub language → port JS to Python, keep in `extract.py`
- Hero size cap → 300KB pre-base64 (tighter than brainstorm's 500KB, to fit current 10MB upload cap)

### Deferred to Implementation

- Exact CSS/layout of the teaser card vs. the full section — follow existing report-page section styling
- Whether to collapse the full showcase by default or render open — decide during implementation based on how many skills a typical user has
- Self-test fixture format for the PII scrubber — Python function + a few known inputs/outputs matching the JS fixture set
- Whether `category` rendering uses a tab bar or anchored headings — decide after seeing 2-3 real reports with showcase data

## High-Level Technical Design

> _This illustrates the intended approach and is directional guidance for review, not implementation specification._

```
User runs: /insight-harness --include-skills
                │
                ▼
┌───────────────────────────────────────────────┐
│  extract.py                                    │
│                                                │
│  extract_skill_inventory()                    │
│    for each skill:                             │
│      if repo: private or none → skip           │
│      read README.md                            │
│      read assets/hero.{png,jpg}                │
│      pii_scrub(readme_md)                      │
│      base64(hero, cap=300KB)                   │
│      emit extended entry                       │
│                                                │
│  build harness_json:                           │
│    skillInventory: [                           │
│      { name, description, source, category,    │
│        calls, readme_markdown, hero_base64,    │
│        hero_mime_type, ... }                   │
│    ]                                           │
│  embed in <script id="harness-data">           │
└───────────────┬───────────────────────────────┘
                │
           upload HTML
                ▼
┌───────────────────────────────────────────────┐
│  /api/upload → parseHarnessHtml()             │
│  → normalizeHarnessData (fills optional        │
│     fields as null/undefined)                  │
│  → upload/page.tsx review step                 │
│    renders per-skill toggle rows when          │
│    any entry has readme_markdown               │
│  → user POSTs with hiddenHarnessSections       │
│    containing skillInventory.<name> keys       │
└───────────────┬───────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────┐
│  GET /api/insights/[username]/[slug]          │
│  → load from DB (FULL harnessData incl hidden) │
│  → filterReportForResponse                     │
│    → stripHiddenHarnessData (already wired)    │
│  → response                                    │
└───────────────┬───────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────┐
│  /insights/[username]/[slug] page             │
│                                                │
│  <SkillsTeaserCard />  ← top-3-5 by calls     │
│    ...existing sections...                    │
│  <SkillsShowcaseSection />  ← full render     │
│    grouped by category                         │
│    react-markdown + rehype-sanitize            │
│    hero img from data: URI                     │
└───────────────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Extend `extract.py` with `--include-skills` flag, README/hero collection, PII scrub**

  **Goal:** Add opt-in showcase data collection to the extract pipeline. Produce extended `skillInventory` entries carrying README markdown and hero base64.

  **Requirements:** R1–R6, R22

  **Dependencies:** None (JSON data layer already ships)

  **Target repo:** `~/Coding/insight-harness` (the upstream `kabirdos/insight-harness` plugin source — NOT the plugin cache, NOT the `insightful` web repo). Edits to the cache path will be overwritten on the next plugin install. Once Unit 1 lands in the upstream repo, cut a new plugin version and have the user `/plugin update insight-harness` locally before proceeding to Units 2–6.

  **Files:**
  - Modify: `~/Coding/insight-harness/skills/insight-harness/scripts/extract.py`
  - Create: `~/Coding/insight-harness/skills/insight-harness/scripts/pii_scrub.py` (importable module; also used by self-test)
  - Create: `~/Coding/insight-harness/skills/insight-harness/scripts/test_pii_scrub.py` (fixture-based self-test, runnable standalone)
  - Bump: `~/Coding/insight-harness/skills/insight-harness/SKILL.md` version (e.g., 0.1.0 → 0.2.0)

  **Approach:**
  - Add `--include-skills` CLI flag. Absent → behavior unchanged from today.
  - In `extract_skill_inventory()`, when the flag is set:
    - For each SKILL.md, parse frontmatter including `repo`, `category`
    - If `repo: private` or `repo: none` → skip entirely (don't even list the skill)
    - Else read sibling `README.md` if present; fall back to SKILL.md body
    - Read `assets/hero.png` or `assets/hero.jpg` if present; reject > 300KB pre-encoded; reject non-PNG/JPEG by signature sniff, not just extension; base64-encode the bytes
    - Apply PII scrub to README markdown text
    - **Enforce per-item caps here**: per-README 100KB (truncate with `\n\n<!-- truncated -->\n` marker), per-skill total 400KB (if hero + README combined exceed 400KB, drop the hero first, then truncate the README further)
    - Emit extended fields on the existing skill entry: `readme_markdown`, `hero_base64` (nullable), `hero_mime_type` (`image/png`|`image/jpeg`|null), `category` (nullable), `calls` (int, from existing session data), plus what's already emitted
  - **Enforce the global 6MB cap in `generate_html()`, not in `extract_skill_inventory()`**, because the real `harness_json` is assembled there. Just before `json.dumps(harness_json)`, iterate `harness_json["skillInventory"]` in `calls`-desc order and measure serialized length cumulatively. For each skill: if adding its showcase fields (`readme_markdown` + `hero_base64` + `hero_mime_type`) would push serialized total over **6MB**, null those three fields on that entry (keep `name`/`description`/`source`/`category`/`calls`) and emit a stderr warning naming the skill and the running byte counter. This keeps a single enforcement point at assembly time where the full payload is known.
  - PII scrub ruleset (Python port of the JS version in `skill-showcase/scripts/build-showcase.js`):
    - `https://github.com/<user>/...` → `https://github.com/<your-username>/...`
    - `/Users/<name>/...` or `/home/<name>/...` → `~/...`
    - Git name from `git config user.name` → `<your-name>`
    - Git email from `git config user.email` → `<your-email>`
    - `@<username>` mentions tied to the git username → `@<your-username>`
  - `test_pii_scrub.py` runs a small fixture table through the scrubber and asserts output equality. Also asserts round-trip fence-block preservation (markdown code blocks must not be mangled).

  **Patterns to follow:**
  - Existing frontmatter parse in `extract_skill_inventory()` at line 172
  - JSON embedding in `generate_html()` around line 1879 (`_skill_inventory_json`)
  - The PII ruleset defined in `skills/skill-showcase/scripts/build-showcase.js`

  **Test scenarios:**
  - Happy path: skill with README.md + hero.png < 300KB → entry has `readme_markdown` (scrubbed), `hero_base64` non-null, `hero_mime_type: "image/png"`
  - Happy path: skill with no hero → entry has `readme_markdown` populated, `hero_base64: null`, `hero_mime_type: null`
  - Edge case: skill with `repo: private` frontmatter → skill is absent from `skillInventory` entirely
  - Edge case: skill with `repo: none` frontmatter → skill is absent from `skillInventory` entirely
  - Edge case: hero > 300KB → warning logged, entry emitted with `hero_base64: null`, skill still present
  - Edge case: hero is .svg → rejected, warning logged, `hero_base64: null`
  - Edge case: file named `.png` but bytes are not a PNG → rejected by signature sniff
  - Edge case: README absent, SKILL.md body used as fallback → `readme_markdown` populated from SKILL.md body
  - Edge case: skill with no `category:` frontmatter → `category: null`
  - Error path: `--include-skills` flag absent → entries do NOT include the new fields (or emit as null); `skillInventory` shape back-compatible
  - Integration: full extract run with `--include-skills` → resulting JSON blob parses cleanly, every entry has the extended fields or explicit nulls
  - PII scrubber self-test: all fixture rows produce expected output; code fences preserved byte-for-byte; no git-username-in-URL leak on the final output

  **Verification:**
  - `python3 extract.py --include-skills` produces HTML with JSON blob containing extended entries
  - `python3 test_pii_scrub.py` exits 0
  - Generated HTML for a 20-skill fixture (each with ~250KB hero + ~50KB README) stays under 10MB total
  - Serialized `harness_json` string length for the same fixture stays under 6MB
  - Truncation fixture: 50-skill input forces budget exhaustion → final skills have nulled showcase fields with stderr warnings; final HTML and the JSON POST body (HTML extracted + re-serialized) both fit under 10MB
  - After release: user runs `/plugin update insight-harness`; subsequent generated HTML contains the new fields

- [ ] **Unit 2: Extend `SkillInventoryEntry` type and `normalizeHarnessData`**

  **Goal:** Carry the new fields through the TypeScript data layer so they survive upload and round-trip.

  **Requirements:** R3, R4

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `src/types/insights.ts`
  - Modify: `src/lib/__tests__/harness-parser.test.ts`
  - Create: `src/lib/safe-image.ts` (exports `isSafeImageDataUri`, `getSafeHeroDataUri`)
  - Create: `src/lib/__tests__/safe-image.test.ts`

  **Approach:**
  - Add to `SkillInventoryEntry`: `readme_markdown?: string | null`, `hero_base64?: string | null`, `hero_mime_type?: "image/png" | "image/jpeg" | null`, `category?: string | null`, `calls?: number`
  - All fields strictly optional (`?`) and nullable — reports without `--include-skills` data must type-check.
  - Extend `normalizeHarnessData()` to coerce missing fields to `null` / `undefined` defaults, not throw
  - No changes to `HarnessData` top-level shape
  - Add a type-narrowing helper `hasShowcaseContent(entry: SkillInventoryEntry): boolean` returning `true` when `readme_markdown` is non-empty — used by render layer to decide whether to show the expanded showcase
  - Add a **shared URI-level validator** `isSafeImageDataUri(uri: string): boolean` exported from a new `src/lib/safe-image.ts` module. Returns `true` only when the string matches `^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$` AND total length is > 0 and ≤ ~570KB (420KB raw × base64 bloat ≈ the decoded 300KB hero cap with headroom).
  - Add `getSafeHeroDataUri(entry: SkillInventoryEntry): string | null` that composes `data:${hero_mime_type};base64,${hero_base64}` from entry fields and returns it only when `isSafeImageDataUri()` accepts the composed string; otherwise returns `null`. Unit 6 must use this helper — no inline hero `src` construction.
  - Unit 3's `SkillReadme` imports `isSafeImageDataUri` from the same module and uses it in its sanitize schema / `urlTransform` for inline markdown images. **One validator, two call sites** — attack surface is unified and sanitizer loosening is caught by tests in both units.

  **Patterns to follow:**
  - Existing nullable handling in `normalizeHarnessData` for fields like `workflowData`, `skillVersion`

  **Test scenarios:**
  - Happy path: JSON with extended fields → fields accessible typed correctly
  - Edge case: JSON without extended fields (old extract or no `--include-skills`) → fields undefined/null, no throw
  - Edge case: extended fields partially present (has `readme_markdown` but no `hero_base64`) → round-trip preserves nulls
  - `hasShowcaseContent`: true when markdown non-empty; false when null, undefined, or empty string
  - `getSafeHeroDataUri`: returns the data URI for valid png + base64; returns `null` when mime is wrong, base64 is malformed (contains `!`, whitespace, etc.), or byte length exceeds the cap
  - `getSafeHeroDataUri`: rejects `image/svg+xml`, `image/gif`, and any non-png/jpeg mime type even if bytes look valid

  **Verification:**
  - `tsc --noEmit` passes
  - Existing harness-parser tests still pass with no fixture changes

- [ ] **Unit 3: Add markdown rendering dependency and sanitized renderer component**

  **Goal:** Produce a single React component that renders a skill's README markdown safely, with a tightly restricted image policy.

  **Requirements:** R16

  **Dependencies:** Unit 2 (for `isSafeImageDataUri` in `src/lib/safe-image.ts`; can otherwise land in parallel)

  **Files:**
  - Modify: `package.json` — add `react-markdown`, `remark-gfm`, `rehype-sanitize`
  - Create: `src/components/SkillReadme.tsx`
  - Create: `src/components/__tests__/SkillReadme.test.tsx`
  - Import from Unit 2: `isSafeImageDataUri` in `src/lib/safe-image.ts`

  **Approach:**
  - `SkillReadme` takes `{ markdown: string, allowDataImages?: boolean }` and returns rendered HTML via `react-markdown` + `remark-gfm` + `rehype-sanitize`.
  - Custom sanitize schema: extend default schema to allow `<img>` with `src`, `alt`, `title` attributes **only when the src matches the regex `^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$`** (allowlist, not denylist). Reject http(s) images, `data:image/svg+xml`, `data:text/html`, malformed base64 padding, and any other scheme.
  - **URL transform for markdown links and images** (in addition to the sanitize schema): pass a custom `urlTransform` to `react-markdown` that allows only `https:`, `http:`, `mailto:`, and `#` (fragment) for links, and only the data-URI regex above for images. Anything else (including `javascript:`, `vbscript:`, `file:`, mixed-case `JaVaScRiPt:`, embedded null bytes) returns empty string → renders as plain text.
  - External links open in new tab with `rel="noopener noreferrer"`.
  - No raw HTML passthrough (`react-markdown` default; do not enable `rehype-raw`). No script execution path.
  - Component is pure / stateless.

  **Patterns to follow:**
  - Other content-rendering components in `src/components/` (check for existing markdown usage — likely none, this is new)

  **Test scenarios:**
  - Happy path: markdown with headings, lists, code fences → rendered semantically
  - Happy path: markdown with GFM table → renders as HTML table
  - XSS (raw HTML): `<script>alert(1)</script>` → stripped (raw HTML disabled)
  - XSS (raw HTML): `<img src="x" onerror="alert(1)">` → entire tag stripped
  - XSS (markdown link): `[link](javascript:alert(1))` → href neutralized, renders as plain text
  - XSS (markdown link, case mix): `[x](JaVaScRiPt:alert(1))` → neutralized
  - XSS (markdown link, vbscript): `[x](vbscript:msgbox(1))` → neutralized
  - XSS (markdown link, data html): `[x](data:text/html,<script>alert(1)</script>)` → neutralized
  - XSS (markdown image): `![pixel](https://evil.com/pixel.gif)` → src stripped, no network request
  - XSS (markdown image, svg): `![x](data:image/svg+xml;base64,PHN2Zy...)` → rejected (only png/jpeg allowed)
  - XSS (markdown image, malformed b64): `![x](data:image/png;base64,not-real-base64!!!)` → rejected
  - Edge case: `![hero](data:image/png;base64,iVBOR...)` → renders `<img>`
  - Edge case: external link `[ex](https://example.com)` → rendered with `target="_blank" rel="noopener noreferrer"`
  - Edge case: fragment link `[toc](#heading)` → renders, no target attr
  - Edge case: mailto `[email](mailto:x@y.com)` → renders
  - Edge case: empty markdown → renders empty fragment, no crash

  **Verification:**
  - Component lib test suite passes
  - `npm run build` succeeds with new dependencies

- [ ] **Unit 4: Upload review — per-skill visibility toggles**

  **Goal:** Let users hide individual skills during the upload review step before publishing. Hidden selections are stored as `skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`) keypaths in `hiddenHarnessSections`.

  **Requirements:** R8, R9, R10

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `src/app/upload/page.tsx`
  - Modify: `src/app/upload/__tests__/*.tsx` (if present — add new test, else new test file)
  - Modify: `src/lib/item-visibility.ts` — change empty-slug fallback in `buildItemKey` from `` `@${index}` `` to `` `item-${index}` `` so the key matches `parseKeypath`'s item-key regex
  - Modify: `src/lib/__tests__/item-visibility.test.ts` — update the "falls back to @index for empty slugs" test to expect `item-0`; add a parseKeypath round-trip test proving `skillInventory.item-0` parses

  **Approach:**
  - Detect if any `skillInventory` entry has showcase content via `hasShowcaseContent()` from Unit 2.
  - When present, add a "Skill Showcase" review subsection listing every skill entry with a toggle (show/hide).
  - Toggle state maps to `skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`) keypaths added to / removed from the disabled-sections record. Build each keypath via `` `skillInventory.${buildItemKey(skills, i, s => s.name)}` ``.
  - **Reuse the existing `HideableItem` component** (`src/components/HideableItem.tsx`), which is currently used on the **edit page** at `src/app/insights/[username]/[slug]/edit/page.tsx`. The upload page has section-level toggles today, not item-level ones — port the `HideableItem` + `buildItemKey` pattern from edit to upload for skill-showcase items.
  - **Switch `getHiddenHarnessSections(disabledSections)` → `getHiddenKeypaths(disabledSections)` at `upload/page.tsx:710`** so item-level keypaths (`skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`)) survive into `hiddenHarnessSections`. The current call silently drops any non-top-level key.
  - **Remove the client-side `stripHiddenHarnessData` call at `upload/page.tsx:790`** (per Storage Decision in Key Technical Decisions). Send full `parsed.harnessData` to the server. Server-side filtering via `filterReportForResponse` handles visibility on every GET. This single change also makes future re-toggle / edit flows possible.
  - `hiddenHarnessSections` array includes both any section-level keys and per-skill keypaths.
  - No cross-report memory — per R25.

  **Patterns to follow:**
  - `HideableItem` usage in `src/app/insights/[username]/[slug]/edit/page.tsx` (the canonical item-level toggle pattern — the upload page does not have one yet)
  - `buildItemKey` and `slugItemKey` in `src/lib/item-visibility.ts`
  - Disabled-sections record management throughout `upload/page.tsx`
  - Mirror the `getHiddenKeypaths` usage already present in test fixtures (`src/lib/__tests__/filter-report-response.test.ts`)

  **Test scenarios:**
  - Happy path: upload with 5 skills having showcase content → review UI shows 5 toggles
  - Happy path: hide 2 skills → disabled-sections record contains `skillInventory.skill-a`, `skillInventory.skill-b`
  - Happy path: publish → POST body's `hiddenHarnessSections` includes the two keypaths (verifies `getHiddenKeypaths` swap)
  - Happy path: publish → POST body's `harnessData.skillInventory` STILL contains the hidden skills' full data (verifies client-side strip removed; server filters on GET)
  - Regression: hiding a top-level section (e.g., `permissionModes`) still works → POST body has `"permissionModes"` in `hiddenHarnessSections`
  - Edge case: skill name slugs to empty (e.g. emoji-only or non-ASCII name) → `buildItemKey` returns `item-<i>`, `getHiddenKeypaths` preserves it, `stripHiddenHarnessData` applies it on GET
  - Edge case: upload with `skillInventory` present but no entry having `readme_markdown` → review subsection absent
  - Edge case: upload with `--include-skills` not used (no extended fields anywhere) → review subsection absent
  - Edge case: toggle off then back on → keypath removed from record
  - Integration: re-upload same report → review UI resets to all-visible (no cross-report state)

  **Verification:**
  - Upload flow E2E from a Unit 1 generated HTML: review step renders toggles, publish persists `hiddenHarnessSections` keypaths correctly

- [ ] **Unit 5: Regression coverage for `skillInventory.<slug>` (where `<slug>` comes from `buildItemKey()`) keypath stripping on GET**

  **Goal:** The brainstorm-flagged gap (R21) is **already closed** — `GET /api/insights/[username]/[slug]` calls `filterReportForResponse → stripHiddenHarnessData`, and `stripHiddenHarnessData` already handles item-level keypaths. This unit adds regression tests proving the showcase fields (`readme_markdown`, `hero_base64`, `hero_mime_type`) are dropped for hidden skills, AND verifies the PUT/edit path does NOT strip.

  **Requirements:** R21 (regression)

  **Dependencies:** Unit 2 (needs the new fields on `SkillInventoryEntry` to assert their absence)

  **Files:**
  - Modify: `src/lib/__tests__/filter-report-response.test.ts` (add showcase-field cases)
  - Modify or create: `src/app/api/insights/[username]/[slug]/__tests__/route.test.ts` (route-level integration test)
  - Modify or create: PUT/edit route test — assert author receives full data (no strip)

  **Approach:**
  - No production code changes expected. If a regression test fails, fix the production code, but the working assumption is that filtering is correct today.
  - Add fixtures with `skillInventory` entries carrying `readme_markdown` + `hero_base64`, then assert: `hiddenHarnessSections: ["skillInventory.foo"]` → `foo` entry absent from GET response, including its showcase bytes.
  - Add a guardrail comment near the PUT handler: `// Author edit path: do NOT call filterReportForResponse — author needs full data to re-toggle.`

  **Patterns to follow:**
  - Existing test cases in `src/lib/__tests__/filter-report-response.test.ts`

  **Test scenarios:**
  - Regression: report with `hiddenHarnessSections: ["skillInventory.foo"]` → GET response's `skillInventory` excludes `foo`, AND no `readme_markdown` / `hero_base64` / `hero_mime_type` for `foo` appears anywhere in the response payload (grep the JSON)
  - Regression: report with `hiddenHarnessSections: ["skillInventory"]` → GET response's `skillInventory` is `[]`
  - Regression: report with empty `hiddenHarnessSections` → showcase fields preserved on visible skills
  - Integration: publish via Unit 4's flow with 5 skills + 2 hidden → GET returns 3 skills with full content; hidden skills' README and hero bytes absent
  - Author path: PUT/edit endpoint (or whatever the owner's read path is) returns the full `harnessData` including hidden skill content, so the author can re-toggle visibility without re-uploading
  - Regression: non-harness `/insights` reports unaffected (no `harnessData` → no strip attempt)

  **Verification:**
  - `npm test -- filter-report-response` passes
  - `curl https://insightharness.com/api/insights/<u>/<slug> | jq '.harnessData.skillInventory[] | select(.name == "<hidden>")'` returns nothing for a hidden skill

- [ ] **Unit 6: Render Skills section on `/insights/[username]/[slug]`**

  **Goal:** Add the teaser card at the top of the report and the full showcase section below. Both respect visibility via the already-filtered data from Unit 5.

  **Requirements:** R11–R20, R23–R24

  **Dependencies:** Units 2, 3, 5

  **Files:**
  - Modify: `src/app/insights/[username]/[slug]/page.tsx`
  - Create: `src/components/SkillsTeaserCard.tsx`
  - Create: `src/components/SkillsShowcaseSection.tsx`
  - Create: `src/components/__tests__/SkillsTeaserCard.test.tsx`
  - Create: `src/components/__tests__/SkillsShowcaseSection.test.tsx`

  **Approach:**
  - `SkillsTeaserCard`: filter `skillInventory` to entries where `hasShowcaseContent(entry)`. Sort by `calls` desc; ties / zero-call skills sort alphabetically. Take top 5. Render name + one-line description. Include "View all →" anchor to the full section below. Badge custom vs. plugin using existing `source` field. Omit the card entirely when no entry has showcase content.
  - `SkillsShowcaseSection`: group entries with showcase content by `category`. Skills with `category: null` → "Other" group. If zero skills have any category → render flat list, omit TOC. For each skill: name, badge, description tagline, hero `<img>` built from **`getSafeHeroDataUri(entry)` only** (Unit 2) — when it returns `null`, render without a hero (do not fall back to any user-controlled string). Rendered README via `<SkillReadme>`. Anchor ids stable for TOC links.
  - Responsive: mobile 375px readable, desktop 1400px comfortable. Follow existing section styling from the report page.
  - Empty states (R23/R24): section absent when no showcase content present; when all visible skills are hidden post-strip, neither teaser nor section render.

  **Patterns to follow:**
  - Existing section rendering in `src/app/insights/[username]/[slug]/page.tsx`
  - Badge styles from the current `skillInventory` display
  - Use `src/lib/urls.ts` helpers for any internal links (do not hand-build paths)

  **Test scenarios:**
  - Happy path (teaser): 5 skills with calls, renders top-5 sorted desc
  - Happy path (teaser): 8 skills, renders top 5; remaining visible in full section
  - Happy path (teaser): mix of custom + plugin → each gets a distinguishing badge
  - Happy path (full): 6 skills across 3 categories → 3 grouped sections with TOC
  - Happy path (full): 3 skills, none with category → flat list, no TOC
  - Happy path (full): skill with valid png hero → `<img>` renders with `data:image/png;base64,...` from `getSafeHeroDataUri`
  - Edge case: skill with malformed `hero_base64` (e.g., contains `!` or whitespace) → hero omitted; rest of skill renders
  - Edge case: skill with `hero_mime_type: "image/svg+xml"` but bytes present → hero omitted (mime allowlist)
  - Edge case: `calls: 0` on all entries → sorted alphabetically
  - Edge case: no entry has `readme_markdown` → teaser card absent, full section absent
  - Edge case (R24): all showcase entries hidden via `hiddenHarnessSections` → Unit 5 strips them; render sees empty list → teaser + section both absent
  - Edge case (R23): harness report without `--include-skills` ever run → no extended fields → no teaser, no section
  - XSS regression: Unit 3's sanitizer is invoked (verified by mounting the component with a script-bearing README)
  - Accessibility: hero `<img>` has `alt` from skill description; anchor ids use kebab-case skill names

  **Verification:**
  - Manual: publish a test report with 3–5 skills having showcase content; open `/insights/<username>/<slug>`; teaser renders at top, full section below with heroes and rendered READMEs
  - Manual: hide 1 skill via upload review, republish, confirm it's gone from both teaser and full section, AND confirm via raw GET that the hidden skill's `readme_markdown` and `hero_base64` are absent from the API response
  - Lighthouse: page still passes a11y checks

## System-Wide Impact

- **Interaction graph:** Additive. The JSON transport is unchanged in shape — only optional fields added to existing entries. `normalizeHarnessData` gains defensive defaults. No callback or middleware changes.
- **Error propagation:** Unit 1's oversized/rejected heroes and invalid images log warnings in extract but do not fail the extract run. Unit 3's sanitizer silently strips malicious content — render does not throw. Unit 5 treats `stripHiddenHarnessData` as pure (no I/O).
- **State lifecycle risks:** None beyond per-upload reset of visibility (R25 — intentional, not a leak).
- **API surface parity:** `GET /api/insights/[username]/[slug]` already applies visibility (Unit 5 adds regression tests, not new behavior). PUT / edit endpoints must NOT strip (author needs full data to re-toggle). Confirm no other GET endpoints expose `harnessData` without stripping.
- **Storage shape change:** `InsightReport.harnessData` will now contain hidden showcase content (previously stripped client-side at publish). DB rows grow modestly. Backfill not required — old rows already lack the showcase fields entirely. Owners can re-toggle skills via a future edit-flow PR without re-uploading.
- **Integration coverage:** End-to-end test: generate HTML with `--include-skills` → upload → hide one skill in review → publish → GET API → render. All six units exercised.
- **Unchanged invariants:** Prisma schema, `HarnessData` top-level shape, existing `skillInventory` consumers (they'll see the same summary fields they already see), the `/insights` (non-harness) parser, the edit page, the OG card.

## Risks & Dependencies

| Risk                                                                                                                                                  | Mitigation                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero base64 payload pushes report over 10MB upload limit (or the 10MB JSON POST to `/api/insights`)                                                   | 300KB/hero, 100KB/README, 400KB/skill-total, **6MB serialized `harness_json` budget** enforced in `extract.py`; 50-skill fixture forces budget exhaustion path; verify both upload HTML size and POST body size stay under 10MB |
| Switching off the client-side strip means hidden showcase bytes hit the DB and the author's edit endpoint                                             | Acceptable per Storage Decision. Worst-case row ~**6MB** (bounded by the serialized-JSON cap). Author-only PUT path is auth-gated. No third party sees hidden data because GET applies the strip.                               |
| Plugin cache vs. upstream repo confusion                                                                                                              | Unit 1 explicitly targets `~/Coding/insight-harness`; user runs `/plugin update insight-harness` between Unit 1 and Unit 2 to refresh cache                                                                                     |
| Python PII scrubber drifts from JS reference                                                                                                          | Shared fixture file asserts byte-for-byte equivalence across a table of inputs                                                                                                                                                  |
| Rasterized PII inside a hero image (visible username in a screenshot)                                                                                 | Documented limit (brainstorm R16 already acknowledges); add README note to the insight-harness skill warning users to review heroes                                                                                             |
| Markdown sanitizer mis-allows an image scheme                                                                                                         | Unit 3 tests enumerate the allowed schemes explicitly; tests fail if the schema is loosened                                                                                                                                     |
| `stripHiddenHarnessData` breaks existing consumers of `skillInventory`                                                                                | Unit 5 tests the non-hidden pre-existing case stays identical; the strip is a no-op when no keypaths match                                                                                                                      |
| `/insights/[username]/[slug]/edit` page doesn't strip hidden data (intentional) — risk that a future dev adds stripping there breaking author editing | Unit 5 adds a code comment on the PUT handler explaining "Author edit path: do NOT call filterReportForResponse"                                                                                                                |

## Documentation / Operational Notes

- Update `~/.claude/skills/insight-harness/SKILL.md` to document the new `--include-skills` flag and the hero size cap
- Bump insight-harness skill version (e.g., 2.3.0 → 2.4.0)
- Add a section to README or SKILL.md warning users to review hero images manually before publishing (rasterized PII warning)
- No migration required on the insightharness.com side — schema unchanged
- No env var changes

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-11-skill-showcase-integration-requirements.md](../brainstorms/2026-04-11-skill-showcase-integration-requirements.md)
- **Upstream dependency:** [docs/plans/2026-04-12-001-refactor-json-data-layer-plan.md](2026-04-12-001-refactor-json-data-layer-plan.md) (JSON data layer — already active)
- **Prerequisite (shipped):** [docs/plans/2026-04-13-001-refactor-url-restructure-plan.md](2026-04-13-001-refactor-url-restructure-plan.md) — URL restructure landed in PR #84. All routes in this plan target the new `/insights/[username]/[slug]` scheme.
- Reference implementation of PII scrub (JS): `skills/skill-showcase/scripts/build-showcase.js` in `~/Coding/claude-toolkit`
- Related code: `src/types/insights.ts`, `src/lib/harness-section-visibility.ts`, `src/lib/item-visibility.ts`, `src/lib/filter-report-response.ts`, `src/lib/urls.ts`, `src/app/insights/[username]/[slug]/page.tsx`, `src/app/upload/page.tsx`, `src/app/api/insights/[username]/[slug]/route.ts`, `~/Coding/insight-harness/skills/insight-harness/scripts/extract.py`
