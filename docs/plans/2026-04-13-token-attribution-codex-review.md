# Codex Review — Token Attribution Plan

Date: 2026-04-13
Reviewer: codex CLI (gpt-5-codex)

## Findings

1. **Wrong harness path/version in plan.** Plan says plugin marketplace path + bump to v2.2.0; actual editable skill is `~/Coding/insight-harness/skills/insight-harness/scripts/extract.py` and is already at `VERSION = "2.3.0"` (line 34). Fix path and version target before coding.

2. **"Models chart counts messages not tokens" fix is semantically dangerous.** Current extractor deliberately keeps `models` to input+output only (extract.py:500) because cache tokens "inflate the models dict by 100-1000x". App fallback cost path (api-cost.ts:270, :302) assumes simple model maps are input+output only. Do NOT overload `models` with cache tokens. Use `perModelTokens` for cache-aware charts.

3. **Token basis under-specified.** `stats.totalTokens` is input+output only (extract.py:1646) but `perModelTokens` includes cache (extract.py:910). Plan's reconciliation check needs to state which baseline per-X totals reconcile to. Add `tokenAttribution.tokenBasis` field.

4. **Wrong subagent tool name.** Plan says `Task` / `input.subagent_type`; extractor handles `tool_name == "Agent"` (extract.py:520). Support both observed shapes or pin schema with a fixture.

5. **Descendant subagent accounting not actionable.** Current JSONL scan has no `sidechain`, `parentUuid`, `cwd`, or message-id tracking around extract.py:455 / :489. Must name exact fields and define orphan-descendant fallback explicitly.

6. **Dominant-model cost shortcut too misleading for "spend" charts.** App already has exact per-model 4-way math (api-cost.ts:278). Pricing all repo/skill/tool buckets at one rate is materially wrong for subagents on smaller models and mixed Opus/Haiku flows. Reconciliation test (plan line 113) can fail even when token attribution is correct. **Recommendation:** emit `Record<bucket, Record<model, HarnessModelTokenBreakdown>>` for cost paths in v1; derive flat token maps for token-only display.

7. **Tool-less assistant turns under-specified.** Plan's loop only handles `tool_use` blocks. Planning/explanation turns with no tools can be a large cost center. Decide between `__assistant__` and `unattributed` bucket and surface the label.

8. **Privacy hole on cwd.** Repo basenames are often private client names. Adding hide keys is not enough — server stripping in `harness-section-visibility.ts:10/:33` and `filter-report-response.ts:51` must remove `perRepoTokens` from public responses when hidden. Add tests.

9. **Normalizer doesn't validate.** `normalizeHarnessData` casts JSON loosely (insights.ts:451). Phase 2 shape check needs concrete reusable validator for all five 4-way maps including existing `perModelTokens`.

10. **Top-N "other" bucket can leak hidden items.** Aggregation must happen AFTER privacy filtering, following the raw-record filter pattern used for `toolUsage` (harness-section-visibility.ts:216).

11. **JSONL time-window risk not mentioned.** Extractor filters sessions by file mtime (extract.py:460), not per-message timestamp. Long-lived sessions can drag old tokens into the 30-day window. Document or per-entry filter.

## Missing for v1

- `tokenAttribution.tokenBasis`, `generatedByVersion`, and exact cost-mode metadata (not just rule / subagentMode / cwdLabeling).
- Bucket-by-model emission for USD in v1, OR keep USD copy clearly marked approximate / hide $ on per-X charts.
- Parser/normalizer tests in `src/lib/__tests__/harness-parser.test.ts:517` covering new fields.
- Public-filtering tests for every new hide key.
- Synthetic JSONL fixtures: no-tool assistant turn, multi-tool turn, `Agent` vs `Task`, missing cwd, tmp cwd, same-basename collision, mixed-model buckets.
