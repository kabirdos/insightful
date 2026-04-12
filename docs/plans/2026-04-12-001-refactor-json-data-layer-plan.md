---
title: "refactor: Replace HTML scraping with embedded JSON data layer"
type: refactor
status: active
date: 2026-04-12
---

# Replace HTML Scraping with Embedded JSON Data Layer

## Overview

Restructure the insight-harness data pipeline to embed all structured data as a JSON blob inside the HTML report, and have the website read that JSON directly instead of scraping HTML with cheerio. The HTML continues to serve as a local preview for users; the site never looks at the HTML rendering.

## Problem Frame

The current pipeline is:

```
extract.py → format data as HTML → upload to site → cheerio scrapes HTML back into data → store
```

Every field goes through two lossy transformations: Python dict → HTML string → regex/cheerio parse. This caused:

- "4.1B" parsed as "4" (missing B suffix in `parseNumericValue`)
- Cache-key typos silently producing 0 values in HTML that the parser faithfully reproduced
- Format suffix disagreements between the Python `fmt()` function and the TS `parseNumericValue` parser
- 680 lines of fragile parsing code (`harness-parser.ts`) that must exactly mirror the HTML structure

The fix: embed the raw structured data as JSON, read it directly, skip the HTML entirely.

## Requirements Trace

- R1. The harness HTML report must embed a complete JSON blob containing all data currently in `HarnessData`
- R2. The site must read the JSON blob directly. No fallback to HTML parsing — harness reports without valid embedded JSON are rejected with a clear 400 error
- R3. Numbers must survive the round-trip without formatting/parsing — stored as numbers, read as numbers
- R4. Adding a new field to the harness report must require only: (a) add to Python dict, (b) add to TS type — no parser function needed
- R5. The HTML report must continue to render a human-readable local preview
- R6. Plain `/insights` reports (non-harness) must continue to parse via the existing HTML parser — JSON embedding is harness-only
- R7. `writeupSections[].contentHtml` must be sanitized at the JSON ingestion boundary (strip scripts, iframes, event handlers) since it is rendered with `dangerouslySetInnerHTML`
- R8. The upload route must source ALL harness data from the JSON blob — no cheerio scraping of the top-level harness HTML (`extractEnhancedStats` must be skipped for harness reports)

## Scope Boundaries

- **In scope:** extract.py JSON embedding, parser simplification, upload detection, type enrichment
- **Out of scope:** Removing the HTML rendering from extract.py (users still view it locally), changing the Prisma schema beyond adding optional fields
- **No backward compat needed:** The product hasn't launched yet. All harness reports will be generated with v2.3.0+ (JSON-embedded). No need to support pre-JSON harness reports. The cheerio harness parsing code can be deleted entirely.
- **Not changing:** The `/insights` (non-harness) report parsing — that uses a separate `parseInsightsHtml()` parser and must continue working. The upload UX flow, the edit page, and the public detail page rendering also stay the same (they consume `HarnessData` from the DB).

## Context & Research

### Relevant Code and Patterns

- `~/.claude/skills/insight-harness/scripts/extract.py` — generator, 2500 lines. Already embeds a small JSON integrity manifest in `<script id="insight-harness-integrity">`. The pattern exists; we're expanding it to include ALL data.
- `src/lib/harness-parser.ts` — 689 lines, 21 parse functions. Almost entirely replaceable.
- `src/types/insights.ts` — `HarnessData` interface (25 fields), `normalizeHarnessData()` validation function, `safeParseHarnessData()` deserializer.
- `src/app/api/upload/route.ts` — detects report type via `isHarnessReport()`, calls `parseHarnessHtml()`, returns parsed data to the upload page.
- `src/app/upload/page.tsx` — receives parsed data, maps fields, POSTs to `/api/insights`.

### Existing JSON Embedding Pattern

The integrity manifest already uses the exact pattern we want to expand:

```html
<script type="application/json" id="insight-harness-integrity">
  { "payload": "{\"v\":2,\"skill_version\":\"2.2.0\",...}", "hash": "abc123" }
</script>
```

The parser already reads this (`parseIntegrityHash`, `parseSkillVersion`). We just need a second, larger blob for the full data.

## Key Technical Decisions

- **Separate script tag, not expanding integrity manifest:** The integrity manifest serves a specific purpose (hash verification). The full data blob gets its own `<script id="harness-data">` tag. This keeps concerns separate and avoids breaking the hash when data changes.
- **JSON shape matches HarnessData directly:** The embedded JSON should map 1:1 to the TypeScript `HarnessData` interface. No intermediate format, no translation layer. extract.py builds the same dict shape, serializes it, and the TS parser deserializes it directly into `HarnessData`.
- **No cheerio fallback for harness reports:** Since the product hasn't launched, all harness reports will have embedded JSON. The 21 cheerio parse functions for harness data can be deleted. `isHarnessReport()` stays (detects harness vs `/insights`). The `/insights` HTML parser (`parseInsightsHtml`) is a separate codepath and stays unchanged. Missing or malformed JSON in a harness report returns a 400 error — no silent degradation.
- **Numbers stay as numbers:** Token counts, session counts, durations — all stored as raw numbers in JSON. No K/M/B formatting on the Python side for data fields. The HTML rendering can still format for display, but the JSON blob carries raw values.
- **Writeup HTML sanitization preserved:** The current cheerio parser sanitizes `writeupSections[].contentHtml` by stripping `<script>`, `<iframe>`, `<object>`, `<embed>`, and event handler attributes. This sanitization must be preserved at the JSON ingestion boundary since these strings are rendered with `dangerouslySetInnerHTML` in 4 places. Apply the same cheerio-based strip after JSON.parse, before returning `HarnessData`.
- **Enhanced stats from JSON, not HTML:** The upload route currently scrapes `linesAdded`, `linesRemoved`, `fileCount`, `dayCount`, `msgsPerDay` from harness HTML via `extractEnhancedStats()`. These must be included in the JSON blob and sourced from there for harness reports, so the claim "site never looks at the HTML rendering" is actually true.
- **Richer data deferred:** Per-model 4-way token breakdowns (`perModelTokens`), daily activity arrays (`dailyActivity`), and per-session metadata are deferred to a follow-up PR when UI is wired to consume them. This PR focuses on transport correctness only.

## High-Level Technical Design

> _This illustrates the intended approach and is directional guidance for review, not implementation specification._

```
┌─────────────────────────────────────────────────────┐
│                  extract.py                          │
│                                                      │
│  data = {stats, autonomy, tools, skills, ...}       │
│                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │  HTML Rendering       │  │  JSON Serialization  │ │
│  │  (local preview)      │  │  (data transport)    │ │
│  │                       │  │                      │ │
│  │  Bar charts, grids,   │  │  json.dumps(data)    │ │
│  │  formatted numbers    │  │  raw numbers, arrays │ │
│  └──────────┬───────────┘  └──────────┬───────────┘ │
│             │                          │              │
│             ▼                          ▼              │
│  <div class="stats-grid">   <script id="harness-data"│
│    <div>1.5M</div>            type="application/json"│
│    ...                        >{...all raw data}</    │
│  </div>                      script>                  │
└─────────────────────────────────────────────────────┘
                         │
                    HTML file
                         │
                    ┌────▼────┐
                    │ Upload  │
                    └────┬────┘
                         │
              ┌──────────▼──────────┐
              │  /api/upload         │
              │                      │
              │  hasEmbeddedData()?  │
              │    YES → JSON.parse  │  ← new path (5 lines)
              │    NO  → cheerio     │  ← legacy fallback
              └──────────┬──────────┘
                         │
                    HarnessData
                    (identical shape
                     either path)
```

## Implementation Units

- [ ] **Unit 1: Build the JSON data dict in extract.py**

  **Goal:** Construct the complete data dict that will be embedded as JSON, matching the `HarnessData` TypeScript interface shape.

  **Requirements:** R1, R3, R4

  **Dependencies:** None

  **Files:**
  - Modify: `~/.claude/skills/insight-harness/scripts/extract.py`

  **Target repo:** `~/.claude/skills/insight-harness` (local skill, not the insightful repo)

  **Approach:**
  - In `generate_html()`, after all data is assembled but before HTML string construction, build a `harness_json` dict with keys matching `HarnessData` field names exactly: `stats`, `autonomy`, `featurePills`, `toolUsage`, `skillInventory`, `hookDefinitions`, `hookFrequency`, `plugins`, `harnessFiles`, `fileOpStyle`, `agentDispatch`, `cliTools`, `languages`, `models`, `permissionModes`, `mcpServers`, `gitPatterns`, `versions`, `writeupSections`, `workflowData`, `integrityHash`, `skillVersion`
  - All numeric values stored as raw numbers (no K/M/B formatting)
  - The `writeupSections` field should carry the same HTML content strings (sanitization happens on the TS side at ingestion)
  - Include `lifetimeTokens` (number) in the stats dict
  - Include enhanced stats fields that the upload route currently scrapes from HTML: `linesAdded` (number), `linesRemoved` (number), `fileCount` (number), `dayCount` (number), `msgsPerDay` (number) — these go in a top-level `enhancedStats` dict
  - Serialize with `json.dumps(harness_json)` and embed in the HTML as `<script type="application/json" id="harness-data">{json}</script>`
  - **Mandatory:** escape `</script>` in the JSON string: `json_str.replace("</script>", "<\\/script>")` — this is not optional, writeup content can contain arbitrary HTML
  - Keep the existing `<script id="insight-harness-integrity">` tag unchanged (it serves hash verification)

  **Patterns to follow:**
  - The existing integrity manifest embedding pattern at the bottom of `generate_html()`

  **Test scenarios:**
  - Happy path: Run extract.py, verify the output HTML contains `id="harness-data"` with valid JSON
  - Happy path: Parse the embedded JSON, verify every key exists and has the expected type (number, string, array, dict)
  - Edge case: Verify raw token numbers are integers (not formatted strings like "1.5M")
  - Edge case: Verify `writeupSections[].contentHtml` containing `</script>` is properly escaped and doesn't break the script tag
  - Edge case: Verify `enhancedStats` fields (linesAdded, linesRemoved, fileCount, dayCount, msgsPerDay) are present as raw numbers
  - Integration: Parse the JSON and compare key values (totalTokens, sessionCount, models) against the HTML-rendered values to confirm they agree

  **Verification:**
  - Generated HTML opens in browser (local preview still works)
  - `python3 -c "import json; ..."` can parse the embedded blob and read all fields

- [ ] **Unit 2: Add JSON extraction path to harness-parser.ts**

  **Goal:** Replace the 21 cheerio parse functions with a single JSON extraction. Delete the cheerio harness parsing code entirely.

  **Requirements:** R2, R3, R6, R7

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `src/lib/harness-parser.ts`
  - Modify: `src/lib/__tests__/harness-parser.test.ts`
  - Modify: `src/lib/__tests__/harness-parser-workflow.test.ts` (rewrite — currently depends on HTML scraping)

  **Approach:**
  - Replace `parseHarnessHtml()` body: extract JSON from `<script id="harness-data">` via regex, `JSON.parse`, sanitize writeup HTML, validate with `normalizeHarnessData()`. ~30 lines replacing ~600.
  - **Sanitize `writeupSections[].contentHtml`** after JSON.parse: strip `<script>`, `<iframe>`, `<object>`, `<embed>` tags and `onclick`/`onerror`/`onload`/`onmouseover` attributes. Use cheerio for this (same approach as current parser, just applied to the JSON-extracted strings instead of the full HTML DOM).
  - `isHarnessReport()` stays (detects harness vs `/insights`)
  - Delete ALL 21 cheerio parse functions: `parseHarnessStats`, `parseAutonomy`, `parseFeaturePills`, `parseBarChart`, `parseSkillInventory`, `parseHookDefinitions`, `parsePlugins`, `parseHarnessFiles`, `parseFileOpStyle`, `parseAgentDispatch`, `parseKvSection`, `parseGitPatterns`, `parseVersionTags`, `parseWriteupSections`, `parseWorkflowData`, `parseIntegrityHash`, `parseSkillVersion`, `findSectionByTitle`, `parseNumericValue`
  - Keep cheerio import for writeup sanitization only (lightweight usage — sanitize individual HTML strings, not full document parsing)
  - Throw a descriptive error if the `harness-data` script tag is missing or JSON is malformed — the upload route catches this and returns 400
  - Regex for extraction must be robust to attribute order (test both `id="harness-data" type="application/json"` and reversed)
  - Rewrite tests to use JSON-embedded HTML fixtures instead of cheerio-parsed HTML fixtures

  **Patterns to follow:**
  - `normalizeHarnessData()` in `types/insights.ts` — already validates and fills defaults

  **Test scenarios:**
  - Happy path: HTML with `id="harness-data"` JSON → returns HarnessData with correct values
  - Happy path: All expected fields present and type-correct
  - Edge case: Malformed JSON in script tag → throws descriptive error (no silent fallback)
  - Edge case: Missing `harness-data` script tag → throws descriptive error
  - Edge case: Valid JSON but missing optional fields → `normalizeHarnessData` fills defaults
  - Edge case: Script tag attributes in reversed order → still extracts correctly
  - **XSS regression:** `writeupSections[].contentHtml` containing `<script>alert(1)</script>` → script tag stripped after ingestion
  - **XSS regression:** `contentHtml` with `<img onerror="alert(1)">` → event handler stripped
  - Integration: Parse a real generated HTML (from Unit 1) → all values match ground truth

  **Verification:**
  - Tests pass with new JSON-based fixtures
  - cheerio kept only for writeup sanitization (confirm no full-document parsing usage)
  - File shrinks from ~689 lines to ~50-80

- [ ] **Unit 3: Add enhancedStats to HarnessData type and update normalizeHarnessData**

  **Goal:** Add `enhancedStats` to the TypeScript type so the upload route can source these from JSON instead of HTML scraping. Confirm `lifetimeTokens` works via JSON path.

  **Requirements:** R4, R8

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `src/types/insights.ts`
  - Test: `src/lib/__tests__/harness-parser.test.ts` (extend existing)

  **Approach:**
  - Add `HarnessEnhancedStats` interface: `{ linesAdded: number | null, linesRemoved: number | null, fileCount: number | null, dayCount: number | null, msgsPerDay: number | null }`
  - Add `enhancedStats?: HarnessEnhancedStats | null` to `HarnessData`
  - Confirm `lifetimeTokens?: number` on `HarnessStats` (already added in PR #54) works via JSON path
  - Update `normalizeHarnessData()` to handle `enhancedStats` with `?? null` default
  - Note: `safeParseHarnessData()` does not exist in the codebase — no update needed

  **Patterns to follow:**
  - Existing nullable fields on `HarnessData` like `workflowData: HarnessWorkflowData | null` and `skillVersion: string | null`

  **Test scenarios:**
  - Happy path: JSON with `enhancedStats` present → correctly parsed and accessible
  - Edge case: JSON without `enhancedStats` (future-proofing) → field is null, no crash
  - Edge case: `normalizeHarnessData` with partial `enhancedStats` → fills defaults without throwing
  - Confirm `lifetimeTokens` round-trips correctly as a number

  **Verification:**
  - TypeScript compiles clean
  - Existing tests pass
  - `enhancedStats` accessible when present, gracefully absent when not

  **Deferred to follow-up:** `perModelTokens`, `dailyActivity`, per-session metadata — add when UI is wired to consume them

- [ ] **Unit 4: Update upload route to source harness data from JSON**

  **Goal:** Stop scraping harness HTML for enhanced stats. Source all harness data from the JSON blob. Return 400 for invalid harness reports.

  **Requirements:** R2, R6, R8

  **Dependencies:** Unit 2, Unit 3

  **Files:**
  - Modify: `src/app/api/upload/route.ts`
  - Test: manual verification via upload flow + route-level error tests

  **Approach:**
  - For harness reports, skip `extractEnhancedStats(html)` — source `linesAdded`, `linesRemoved`, `fileCount`, `dayCount`, `msgsPerDay` from `harnessData.enhancedStats` instead
  - `extractEnhancedStats()` stays for plain `/insights` reports (it parses the insights stats row)
  - Catch the descriptive error thrown by `parseHarnessHtml()` when JSON is missing/malformed and return a 400 with a clear message (not a generic 500)
  - Verify that `totalTokens` and other scalar fields now carry raw JSON numbers
  - The harness stat override block (`...(harnessData ? { sessionCount: ..., commitCount: ..., dayCount: ... } : {})`) should pull `dayCount` from `enhancedStats` instead of falling back to 30

  **Patterns to follow:**
  - Existing upload flow at `src/app/api/upload/route.ts` lines 88-145

  **Test scenarios:**
  - Happy path: Upload a v2.3.0 HTML report with embedded JSON → `totalTokens` matches the raw number from JSON (e.g., 9500000 not 1500000)
  - Happy path: Enhanced stats (linesAdded, fileCount, etc.) sourced from JSON, not HTML scraping
  - Error: Upload a harness report without `harness-data` script tag → returns 400 with descriptive message
  - Error: Upload a harness report with malformed JSON → returns 400, not 500
  - Unchanged: Upload a plain `/insights` report → `extractEnhancedStats` still used, works as before
  - Integration: Full upload → publish flow → verify stored `harnessData` in DB has correct token values

  **Verification:**
  - Upload a fresh report generated by Unit 1's extract.py
  - Confirm the published report shows correct numbers
  - Confirm `extractEnhancedStats` is NOT called for harness reports

## System-Wide Impact

- **Interaction graph:** The change is isolated to the parse layer. Everything downstream (DB storage, API responses, React rendering) consumes `HarnessData` — the shape doesn't change, only how it's populated. No callbacks, middleware, or observers affected.
- **Error propagation:** JSON parse failure throws a descriptive error caught by the upload route, which returns 400. No silent degradation — harness reports must have valid JSON.
- **State lifecycle risks:** None — the JSON blob is read-only, parsed once during upload, never mutated.
- **API surface parity:** No API changes. The `HarnessData` JSON column in the DB stores the same shape regardless of source.
- **Integration coverage:** The upload → parse → store → render pipeline should be tested end-to-end with JSON-embedded reports. Old HTML-only harness reports are not supported (product hasn't launched).
- **Unchanged invariants:** The Prisma schema, the `InsightReport` model, the GET/PUT API routes, the edit page, the public detail page, the OG card — all unchanged. They read from `harnessData` in the DB, which has the same shape either way.

## Risks & Dependencies

| Risk                                                   | Mitigation                                                                                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON blob too large (writeup sections contain HTML)    | Measure size. Current integrity manifest is ~500 bytes; full data with writeups will be ~50-100KB. Well within HTML limits.                                                             |
| Script tag content breaks if JSON contains `</script>` | **Mandatory** escape in extract.py: `json_str.replace("</script>", "<\\/script>")`. `json.dumps` won't produce this, but writeup content can contain arbitrary HTML. Tested explicitly. |
| XSS via writeup contentHtml in JSON                    | Sanitize `writeupSections[].contentHtml` at the JSON ingestion boundary (strip scripts, iframes, event handlers). Same cheerio-based approach as current parser.                        |
| Auto-update overwrites extract.py fixes again          | Already disabled in this session. Also: once extract.py is published to the remote repo (craigdossantos/claude-toolkit), the auto-update will pull the fixed version.                   |
| `/insights` reports still need HTML parsing            | Separate parser (`parseInsightsHtml`) is untouched — only harness cheerio code is deleted.                                                                                              |
| Upload route still scrapes harness HTML                | `extractEnhancedStats()` skipped for harness reports — enhanced stats sourced from JSON blob's `enhancedStats` field instead.                                                           |

## Documentation / Operational Notes

- After implementing, update `~/.claude/skills/insight-harness/SKILL.md` description to mention the embedded JSON data layer
- Bump skill version to 2.3.0
- The remote repo (craigdossantos/claude-toolkit) should be updated with the new extract.py so auto-update pulls the correct version for all users

## Sources & References

- Related issues: #42, #43 (token counting bugs caused by HTML round-trip)
- Audit doc: `docs/research/2026-04-11-insight-harness-audit.md`
- Current parser: `src/lib/harness-parser.ts` (689 lines, 21 functions — most become dead code after this)
- Current types: `src/types/insights.ts` (HarnessData interface)
