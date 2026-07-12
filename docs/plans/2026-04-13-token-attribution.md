# Token Attribution Plan — 2026-04-13

Add per-repo / per-skill / per-subagent / per-tool token-spend breakdowns to Insightful reports, plus dollar-cost translations of those breakdowns, while bundling the audit fixes that touch the same harness code paths.

## Open questions (decide before coding)

1. **Per-tool attribution rule.** An assistant message carries one `message.usage` block but can invoke multiple tools. Options:
   - **A. Proportional split** — divide usage evenly across the N tool_use blocks in the turn. Simple, defensible, slightly blurs single-tool turns.
   - **B. Primary tool** — the first (or largest-input) tool gets 100%. Clean attribution, biased toward the first invocation.
   - **C. "Shared" bucket** — any multi-tool turn goes to a `__shared__` key; single-tool turns attribute to that tool. Honest, harder to visualise.
   - **Recommended default: A (proportional).** Easy to explain, no hidden bucket, matches how users intuitively read "60% of tokens went to Edit." Document the rule in the harness output as a `tokenAttribution.rule` field so the app can label the chart ("tokens are split proportionally across tools in multi-tool turns").
2. **cwd labelling scheme.** Raw `cwd` is a full path (PII). Options:
   - `os.path.basename(cwd)` — `insightful`. Collides if the user has two repos named the same in different parents.
   - `<parent>/<basename>` — `Coding/insightful`. More unique, still leaks the intermediate directory.
   - Hash-suffix disambiguation — `insightful` or `insightful-a1b2` on collision.
   - **Recommended: basename with collision-suffix.** Normalize to basename; if two distinct cwd paths share a basename within the window, append a 4-char hash of the full path. Drop anything under `/tmp`, `/var`, or matching `^/$` into an `(other)` bucket.
3. **Subagent attribution scope.** `subagent_type` is only available on the `Task` tool_use input. Do we attribute (a) only the parent-turn usage for that Task call, or (b) all descendant messages that ran inside the subagent? Raw JSONL nests subagent traffic in the same session file — detectable by sidechain markers. **Recommended: (b) full descendant accounting** if sidechain ids are present, else fall back to (a) with a `subagentAttribution.mode` flag so the chart can tell the user.
4. **Display: per-repo chart — top N cutoff.** Long-tail users will have 30+ repos. Suggest top 8 + "other" bucket, matching existing donut idioms.

## Data model additions

New fields on `HarnessData` (all optional, nullable for back-compat):

```ts
perRepoTokens?: Record<string, HarnessModelTokenBreakdown> | null;
perSkillTokens?: Record<string, HarnessModelTokenBreakdown> | null;
perSubagentTokens?: Record<string, HarnessModelTokenBreakdown> | null;
perToolTokens?: Record<string, HarnessModelTokenBreakdown> | null;
tokenAttribution?: {
  rule: "proportional" | "primary" | "shared-bucket";
  subagentMode: "descendant" | "parent-only";
  cwdLabeling: "basename" | "basename-hash";
  // for UI: total tokens NOT attributable (sidechains w/o parent, etc.)
  unattributed: HarnessModelTokenBreakdown;
} | null;
```

Same 4-way breakdown shape as `perModelTokens` — keeps cost math uniform.

## Phase 1 — Harness skill (Python, extract.py)

Location: `~/.claude/plugins/marketplaces/kabirdos-insight-harness/scripts/extract.py`. Version bump to v2.2.0.

### 1a. Bundle audit fixes (same code paths)

- **Cache key name fix (audit #2).** Fix `extract_stats_cache` (lines 876–877) to read `cacheReadInputTokens` (camelCase) first, then the snake_case fallback.
- **Models chart counts messages not tokens (audit #3).** Replace `models[model] += 1` (line 489) with `models[model] += input + output + cache_read + cache_create` drawn from the same `message.usage` block we are about to reuse for attribution.
- **Sparse-source preference (audit #5).** Stop preferring session-meta `tool_counts` — prefer JSONL counts. Same scan pass feeds per-tool token attribution below.

Verification: regenerate Craig's report and confirm (a) models chart shows ~4B not ~21K, (b) cache ratio ≈ 11,700:1, (c) Bash count ≈ 5.4K.

### 1b. Attribution scan

Single pass over JSONL messages. For each assistant envelope:

1. Read `cwd` → normalize via cwd-labelling rule → accumulate `usage` into `perRepoTokens[label]`.
2. For each `tool_use` block in `message.content`:
   - If `name == "Task"` and `input.subagent_type` present: stash the subagent name against this message id for descendant accounting.
   - If `input.skill` present (Skill tool): accumulate into `perSkillTokens[skill]`.
   - Accumulate into `perToolTokens[name]` using the chosen attribution rule (proportional default: `usage / len(tool_uses)`).
3. If the envelope is a descendant of a known subagent task (sidechain marker): attribute full `usage` to `perSubagentTokens[subagent_name]`.
4. Anything unattributable → `tokenAttribution.unattributed`.

### 1c. Emit

Add new keys to the `<script id="harness-data">` JSON blob alongside `perModelTokens`. Include `tokenAttribution` metadata block so the app can label charts honestly.

### Verification

- Unit test with a synthetic JSONL fixture (single message, multi-tool turn, Task dispatch, cross-repo).
- Regenerate Craig's 30-day report. Sanity: `sum(perRepoTokens[*]) ≈ sum(perModelTokens[*])` within 1% (unattributed absorbs the rest).
- Diff vs previous report to confirm no regression in existing fields.

## Phase 2 — Insightful type + normalization

**File:** `/Users/craigdossantos/Coding/insightful/src/types/insights.ts`

- Add optional fields to `HarnessData` (see shape above).
- In `normalizeHarnessData`, default all four new maps to `null` (not `{}`) so UI can distinguish "old report, no data" from "new report, zero attribution." Default `tokenAttribution` to `null`.
- Do a minimal shape check on each entry (object with numeric `input`/`output`/`cache_read`/`cache_create`) to avoid poisoning cost math with malformed DB rows.

**Verification:** `pnpm typecheck`. Run the existing `filter-report-response.test.ts` suite — no changes expected, just confirm old reports still round-trip. Add one new test asserting an old (pre-v2.2) HarnessData blob normalizes with the four new fields as `null`.

## Phase 3 — Cost translation

**File:** `/Users/craigdossantos/Coding/insightful/src/lib/api-cost.ts`

Extract the Path-1 math (lines 279–300) into a small exported helper:

```ts
export function breakdownToUsd(
  breakdown: HarnessModelTokenBreakdown,
  modelHint?: string,
): number;
```

Problem: per-repo / per-skill / per-tool breakdowns are not keyed by model, but cost depends on the model. Two options:

- **A. Use the dominant model from `perModelTokens`** to pick a rate. Simple; wrong if a subagent used a different model than the parent.
- **B. Have the harness emit two-level maps** keyed by `[bucket][model]`. Accurate but doubles the payload.

**Recommended: A for v1,** with a TODO to upgrade to B if users ask. Document it in the chart tooltip: "estimated using your dominant model; subagents on smaller models may cost less."

Add a new export:

```ts
export function estimateBreakdownCosts(
  perX: Record<string, HarnessModelTokenBreakdown> | null | undefined,
  perModelTokens: Record<string, HarnessModelTokenBreakdown> | null | undefined,
): Record<string, number>;
```

**Verification:** extend the existing cost tests with a fixture covering a two-bucket breakdown; assert sum-of-buckets-cost ≈ total-cost within rounding.

## Phase 4 — Display components

Four new donuts (top-N + "other" to match existing idioms). Each should show tokens on the slice and USD on hover/legend — reuse Phase 3 helper.

**New files:**

- `/Users/craigdossantos/Coding/insightful/src/components/RepoTokensDonut.tsx`
- `/Users/craigdossantos/Coding/insightful/src/components/SkillTokensDonut.tsx`
- `/Users/craigdossantos/Coding/insightful/src/components/SubagentTokensDonut.tsx`
- `/Users/craigdossantos/Coding/insightful/src/components/ToolTokensDonut.tsx`

These are thin wrappers around a new shared component `TokenBreakdownDonut.tsx` that takes `(map, perModelTokens, title, topN, emptyFallback)`. Follows the `ModelDonutChart` / `CliToolsDonut` pattern (~80 lines each, same SVG approach).

**Priority / placement order** (most user-value first):

1. **RepoTokensDonut** — "where did my spend go" is the #1 question users ask about token totals.
2. **SkillTokensDonut** — directly validates/invalidates custom skills.
3. **ToolTokensDonut** — answers "is Bash really costing me that much."
4. **SubagentTokensDonut** — most specialised, smallest audience.

**Render sites** (each site adds all four, rendered conditionally on presence of new field, falling through gracefully for old reports):

- `src/app/upload/page.tsx` (preview) — near line 1573 (next to `ModelDonutChart`) and line 1678 (next to `CliToolsDonut`). Group the four under a new "Where tokens went" section.
- `src/app/insights/[username]/[slug]/page.tsx` — near line 406 / 506, same grouping.
- `src/app/insights/[username]/[slug]/edit/page.tsx` — line 520 / 646, with eye-toggle visibility wrapping (follow `HideableItem` pattern for hiding individual donuts from public views).

Add four new section keys to `harness-section-visibility.ts` for the eye-toggle system (per-repo / per-skill / per-subagent / per-tool tokens) so users can hide them individually — repo breakdown in particular may be sensitive.

**Verification:**

- `pnpm build` (Next.js build catches prop-type drift).
- Manual upload of (a) a pre-v2.2 report — confirm new section is hidden / absent without layout break, (b) a fresh v2.2 report — confirm all four donuts render with sensible slices.

## Phase 5 — Backwards compatibility

Already covered by `null` defaults in Phase 2. Explicit guards:

- Every new donut wrapper returns `null` when its input map is `null` or empty.
- The parent "Where tokens went" section header only renders if at least one of the four maps is non-empty.
- `filter-report-response.ts` — audit it to confirm it doesn't strip fields by key; if it uses an allowlist, add the four keys. (It passes raw `harnessData` JSON today — verify.)
- `allowed-fields.ts` — no change; `harnessData` is intentionally not editable via PUT.
- OG image route (`src/app/api/og/[username]/[slug]/route.tsx`) — no change; uses `perModelTokens` only.

**Verification:** `pnpm test filter-report-response`. Manually load the oldest report in the dev DB and confirm unchanged rendering.

## Phase 6 — Rollout

1. **Ship harness v2.2.0 first.** Independent package, no app dependency. Users can upgrade at their own pace.
2. **Merge app changes behind presence-checks** — safe to deploy before anyone has regenerated a report. Old reports keep working, new reports get the new donuts automatically.
3. **Document the migration** — add a one-paragraph note to the upload page copy: "regenerate your insight-harness report to see per-repo and per-skill token spend."
4. No DB migration needed — `harnessData` is a JSON blob.

## Verification checklist (end-to-end)

- [ ] `pnpm typecheck` clean
- [ ] `pnpm build` clean
- [ ] `pnpm test` — new unit tests for `normalizeHarnessData` defaults + `breakdownToUsd`
- [ ] Manual upload of pre-v2.2 HTML report — no visual regression, no console errors
- [ ] Manual upload of v2.2 HTML report — all four donuts render, USD totals reconcile against the existing total-cost figure within ~5%
- [ ] Audit bugs verified fixed in same report (models chart in tokens, cache ratio non-zero, tool counts match JSONL)

## Critical Files for Implementation

- `~/.claude/plugins/marketplaces/kabirdos-insight-harness/scripts/extract.py` (harness emitter + audit fixes)
- `/Users/craigdossantos/Coding/insightful/src/types/insights.ts` (type + normalizer)
- `/Users/craigdossantos/Coding/insightful/src/lib/api-cost.ts` (cost translation helper)
- `/Users/craigdossantos/Coding/insightful/src/components/HarnessSections.tsx` (or nearby — placement of the new donut group)
- `/Users/craigdossantos/Coding/insightful/src/app/insights/[username]/[slug]/page.tsx` (primary render site; mirrors to upload + edit pages)
