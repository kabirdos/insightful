# Insight Harness Skill Audit — 2026-04-11

Read-only audit of `~/.claude/skills/insight-harness/scripts/extract.py` (v2.1.0, 2467 lines).
Report inspected: `/Users/craigdossantos/.claude/usage-data/insight-harness.html` regenerated 2026-04-11 20:42.
Window: `datetime.now(timezone.utc) - timedelta(days=30)` → cutoff `2026-03-13T03:43Z`.

## Summary

Top findings, severity-ordered:

1. **CRITICAL — Total Tokens stat is ~2700× too low.** Reported `1.5M`, real value `4.12B`. Confirms issue #43 plus an extra wrinkle: even the _cache fields_ in `stats-cache.json` are not being read because of a misnamed key (next bullet).
2. **CRITICAL — `extract_stats_cache` reads the wrong key for cache tokens.** Lines 876–877 look for `cacheReadTokens` / `cache_read_input_tokens`. The actual stats-cache.json key is `cacheReadInputTokens` (camelCase, no underscore). Both the primary and the snake_case fallback miss it. Result: cache_read_ratio in the "Usage Intensity" panel is **always 0:1** even though Craig's true cache:input ratio is ≈ 11,700:1 (3.95B cache_read / 337K input).
3. **CRITICAL — Models bar chart shows message counts.** Confirms #42. Reported `claude-opus-4-6: 21.5K` (= 21,479 assistant messages). Should be `4.11B tokens`. Root cause: `models[model] += 1` at line 489 instead of `+= sum_of_4_token_categories`.
4. **CRITICAL — Autonomy classification is wrong.** Reported "Collaborative" with 15,597 user msgs / 21,652 assistant msgs (ratio 0.72). The "user" envelope count includes 13,268 `tool_result` envelopes. Real user prompts: **2,329**. True ratio (2329/21652) = 0.108 → should be **"Fire-and-Forget"**. The flagship label on the report is the opposite of reality.
5. **HIGH — Tool Usage chart undercounts every tool by ~3×.** Merge logic prefers session-meta `tool_counts` over JSONL when both have a key. session-meta is sparsely populated (4,242 calls vs 13,272 in JSONL). E.g. Bash reported 1.4K, real 5.4K. Read 858 → 2,374. Edit 402 → 1,436. This also poisons the File Operation Style donut percentages.
6. **HIGH — PR count double-counts re-references.** Reported 118, only 96 unique PR URLs. `pr-link` envelopes fire on every `gh pr view`/check, not just creation.
7. **HIGH — Agent count is internally inconsistent.** Tool Usage chart says `Agent: 239`, Agent Dispatch section says `768 spawned`, embedded /insights writeup says `494`. Three numbers, same metric, same report.
8. **MEDIUM — Duration / Avg Session metrics are physically impossible.** Reported `1305h` and `1135m` (18.9h average). Caused by a single session's `duration_minutes = 14500` (241 hours). session-meta records wall-clock idle time. Harness aggregates blindly with no cap or sanity filter.
9. **MEDIUM — "Sessions: 92" uses JSONL mtime, but "Tokens"/"Duration"/"Commits" use session-meta start_time.** Two cutoff semantics across one stats grid → "92 sessions" actually summarizes only the 78 that fall in the start_time window for some panels and 92 for others.
10. **MEDIUM — Phase classification dumps 27% of calls into "other"** (the documented 30% noise threshold). 27% is mostly common shell commands not in any list: `cd`, `ls`, `sleep`, `grep`, `cat`, `vercel`, `python3`, `codex`. Misleading "Phase Distribution" pie that suggests Craig spends 27% of his time in unclassifiable activity.
11. **LOW — Grep:Glob donut omits everything else.** Just shows raw integers (`227:106`) with no normalization or context.

## Part 1: Field correctness

### Stats grid (top 8 KPIs)

| Field       | Source                                                                  | Reported      | Ground truth                            | Delta         | Severity          | Notes                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------- | ------------- | --------------------------------------- | ------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions    | `max(meta.session_count, jsonl.sessions_with_data)` (line 1276)         | 92            | 92 (jsonl mtime) / 78 (meta start_time) | 0 / +14       | medium            | Uses JSONL mtime which includes sessions started before window but written within. Inconsistent with the panels that drive off session-meta. |
| Tokens      | `meta.total_tokens` = sum(input + output) over session-meta (line 1230) | 1.5M          | 4.12B                                   | **−2700×**    | **critical**      | #43. Misses cache_creation (157M) + cache_read (3.95B). Also limited to 78 sessions.                                                         |
| Duration    | `meta.total_duration_hours` (line 1231)                                 | 1305.0h       | unrecoverable from existing data        | n/a           | medium            | source data inflated by user idle time (one session = 241h). No cap.                                                                         |
| Avg Session | `meta.avg_duration_minutes` (line 1232)                                 | 1135m (18.9h) | n/a                                     | n/a           | medium            | divides bad-data sum by 69. 1135 minutes "average" in 30 days is impossible.                                                                 |
| Skills Used | `len(jsonl.skill_invocations)` distinct (line 1935)                     | 45            | 45                                      | 0             | high confidence ✓ |                                                                                                                                              |
| Hooks       | `len(settings.hooks)` (line 1936)                                       | 9             | 9                                       | 0             | high confidence ✓ |                                                                                                                                              |
| Commits     | `meta.total_git_commits` (line 1937)                                    | 69            | 69 from session-meta sum                | 0             | high confidence ✓ | But session-meta covers only 78/92 sessions; if any ignored sessions had commits they're missed.                                             |
| PRs         | `jsonl.pr_count` (`pr-link` event count) (line 1938)                    | 118           | 96 unique URLs                          | **+22 (23%)** | high              | Should `len(set(prUrl))` not `count of envelopes`.                                                                                           |

### Models bar chart

| Model             | Reported (msgs) | Ground truth (tokens, 4-way) |
| ----------------- | --------------- | ---------------------------- |
| claude-opus-4-6   | 21.5K           | **4.11B**                    |
| claude-sonnet-4-6 | 156             | 8.4M                         |
| `<synthetic>`     | 17              | 0                            |

Source: extract.py line 489 `models[model] += 1`. Should accumulate token counts from `message.usage` (4 categories). **Severity: critical, confirms #42.**

### Autonomy box

| Field                        | Source                                          | Reported          | Ground truth                                                    | Severity     |
| ---------------------------- | ----------------------------------------------- | ----------------- | --------------------------------------------------------------- | ------------ |
| Style label                  | branches on `autonomy_ratio` (line 1641)        | **Collaborative** | **Fire-and-Forget**                                             | **critical** |
| Ratio "1 per N Claude turns" | `round(1 / autonomy_ratio)`                     | 1 per 1           | 1 per 9 (real prompts vs assistant envelopes)                   | critical     |
| user msgs                    | count of `entry.type == 'user'` (line 560)      | 15,597            | 2,329 real prompts; 13,268 are tool_result envelopes            | critical     |
| assistant msgs               | count of `entry.type == 'assistant'` (line 485) | 21,652            | 21,652 (envelopes); 6,868 contain text; 13,264 contain tool_use | as-is        |
| turns measured               | `len(turn_durations)`                           | 902               | 902                                                             | ✓            |
| Median turn                  | `turn_duration` system events                   | 109s              | 108.8s                                                          | ✓            |
| Longest run                  | max(turn_durations)                             | 62.6m             | 62.6m                                                           | ✓            |
| Error rate                   | tool_errors / total_tool_calls                  | 4.5% (600/13272)  | 4.52% (600/13272)                                               | ✓            |

**Root cause:** lines 559–568 increment `user_messages` for every envelope of `type=="user"`, but in Claude Code's JSONL format, _every tool_use response from the assistant lands as a user envelope containing tool_result blocks_. Counting envelopes inflates user msgs ≈ 6.7×. Fix: only increment when `message.content` is a string OR when none of the items in `content` are `tool_result`. With the corrected count of 2,329, the ratio is 0.108 → **Fire-and-Forget**.

### Tool Usage bar chart

Merge logic at lines 1606–1609 prefers session-meta values. session-meta `tool_counts` summed across the 78 in-window meta files = 4,242 calls. JSONL across the 92 in-window session files = 13,272 calls (3.13× more).

| Tool       | Reported | session-meta | JSONL (truth) |
| ---------- | -------- | ------------ | ------------- |
| Bash       | 1.4K     | 1,435        | **5,373**     |
| Read       | 858      | 858          | **2,374**     |
| Edit       | 402      | 402          | **1,436**     |
| TaskUpdate | 218      | 218          | **778**       |
| Agent      | 239      | 239          | **768**       |
| Grep       | 227      | 227          | **595**       |
| Write      | 141      | 141          | **480**       |
| TaskCreate | 134      | 134          | **396**       |
| Glob       | 106      | 106          | **208**       |
| Skill      | 70       | 70           | **188**       |

**Severity: high.** Every bar is wrong. session-meta is the wrong primary source — it's a sparse, sometimes-empty pre-aggregate. JSONL counts (which the Autonomy box already trusts via `total_tool_calls`) are the only ground truth.

### File Operation Style donut

Reads/Edits/Writes feed off `tool_counts`, so they inherit the merge bug.

|                 | Reported          | Real                                       |
| --------------- | ----------------- | ------------------------------------------ |
| Read:Edit:Write | 61:29:10          | 55:33:11                                   |
| Grep:Glob       | 227:106           | 595:208                                    |
| Label           | "Surgical Editor" | "Surgical Editor" (still true: 1436 > 720) |

Label happens to be correct, percentages wrong by ~6 points each. **Severity: medium.**

### Cache read ratio (Usage Intensity panel)

| Field             | Source                             | Reported | Truth     |
| ----------------- | ---------------------------------- | -------- | --------- |
| Cache:Input ratio | `extract_stats_cache` line 876–877 | **0:1**  | ≈11,727:1 |

`stats-cache.json` actual key: `cacheReadInputTokens` (one word, camelCase). Code reads `cacheReadTokens` then falls back to `cache_read_input_tokens` (snake_case). Both wrong. **Severity: critical.**

### Git Patterns / Lines

| Field       | Reported | Truth                  | Delta |
| ----------- | -------- | ---------------------- | ----- |
| PRs         | 118      | 96 unique              | +22   |
| Commits     | 69       | 69 (from meta sum)     | 0     |
| Lines added | 38.9K    | 38,872 (from meta sum) | 0 ✓   |

Branch prefixes are computed from JSONL `gitBranch` envelopes — looks correct, no concerns.

### Languages bar chart

Source: `meta.languages` only, no JSONL fallback. Inherits the 78-session subset bias. Reported counts (TS 672, MD 342, HTML 233...) are sums over `session_meta.languages` which records per-file modifications. Probably correct but undercounts by ~14 sessions worth of work.

### Skills section

`skill_invocations` (count per skill name), distinct count of 45 — verified ✓. The Skill source badges (custom/plugin/command) appear to be correct based on inspection of `skill_inventory`.

### Hook Definitions / Hook Execution Frequency

Hook definitions from settings.json: 9 entries — ✓.
Hook fires (5,831 total) computed correctly from `progress` events with `data.type=='hook_progress'`. Verified end-to-end.

### Agent Dispatch

| Field           | Reported | Truth            |
| --------------- | -------- | ---------------- |
| Agents spawned  | 768      | 768 ✓            |
| Background %    | 58       | 449/768 = 58.5 ✓ |
| general-purpose | 570      | 570 ✓            |
| Explore         | 91       | 91 ✓             |
| sonnet          | 211      | 211 ✓            |
| opus            | 17       | 17 ✓             |
| haiku           | 12       | 12 ✓             |

This panel is **correct** — but it disagrees with the Tool Usage chart's `Agent: 239` and the embedded /insights writeup's "494 Agent calls". Three values for the same metric in one document.

### MCP Servers

Verified ✓: playwright 223, Claude_Preview 103, Claude_in_Chrome 61, stitch 21.

### Permission Modes / Plugins / Skill Inventory

Verified ✓ from spot check.

### Workflow Phases / Phase Transitions

Phase distribution: exploration 27%, **other 27%**, implementation 18%, orchestration 16%, shipping 11%, testing 1%. Verified ground truth identical. Concerns:

- "other" tied with the top phase. Comment in code (line 343) literally says "if other phase exceeds 30% of total calls, consider filtering" — we're at 27%, just under threshold. But the failure mode is _also_ that legitimate exploration commands (`grep`, `find`, `cat`, `which`) and infra tooling (`vercel`, `railway`, `python3`, `codex`) aren't in the bucket lists, so they pollute "other".
- "testing 1%" is misleading — Craig doesn't run `pytest`/`jest` directly very often; tests likely run via npm/pre-commit hooks which are bucketed elsewhere. The 1% claim implies bad TDD discipline when the truth is "test runner is hidden behind hook".
- `Bash:None` shows up 196 times in "other" — that's bash commands where `extract_safe_command_name` returned None (env-only or empty lines). Should not silently fall to "other".

## Part 2: /usage parity gaps

### Have

Correctly surfaced in current report:

- Per-skill invocation counts (45 skills, custom vs plugin badges)
- Hook definitions and execution frequency
- Plugin inventory with enabled/disabled status
- Agent dispatch (counts, types, model tiers, background %)
- MCP server call counts
- Permission modes
- Workflow phases and phase transitions
- Skill workflow patterns (sequence n-grams)
- Branch prefixes
- Tool transitions
- File operation ratio
- Hour-of-day NOT shown (in stats-cache as `hourCounts`)
- Settings snapshot covering only: `enabledPlugins`, `permissions.defaultMode`, `env` keys, `statusLine` boolean, `skipDangerousModePermissionPrompt`, hooks list.

### Missing — Stats Overview

Critical Stats-tab fields the harness does not surface:

| Stat                                     | Where it lives                                                                                                                                                                                                          | Notes                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active days (X / Y window)**           | derive from `stats-cache.dailyActivity` (count entries with messageCount > 0)                                                                                                                                           | Currently 71/116 for Craig (first session date 2025-12-17 → today). Trivial to compute.                                                     |
| **Longest active streak**                | derive from `dailyActivity` consecutive dates                                                                                                                                                                           | Craig's truth: 34 days. Matches the screenshot.                                                                                             |
| **Current streak**                       | tail of `dailyActivity`                                                                                                                                                                                                 | Craig's truth: 5 days (last active 2026-04-10, today 2026-04-12, broken). The /usage screenshot showed 6 — likely computed at 04-10 itself. |
| **Favorite model**                       | top of `stats-cache.modelUsage` by total tokens                                                                                                                                                                         | Craig: opus-4-6 by a 489× margin. Already kind of in models bar chart but not as a single "favorite" stat.                                  |
| **Longest session (corrected)**          | `stats-cache.longestSession.duration` says 668h (2.4B ms) — same Claude Code bug as the /usage view. Better: scan JSONL for max consecutive turn_durations within a session, OR cap session length at first 3-hour gap. | The harness can do better than /usage by computing a sane "longest active session".                                                         |
| **Activity calendar heatmap**            | `dailyActivity` is exactly the data needed                                                                                                                                                                              | Visual win — draw an SVG heatmap.                                                                                                           |
| **All-time totals (sessions, messages)** | `stats-cache.totalSessions` (593), `totalMessages` (178,283)                                                                                                                                                            | Could be in a "since first session" subheader.                                                                                              |
| **First session date**                   | `stats-cache.firstSessionDate` (2025-12-17)                                                                                                                                                                             | One-line addition.                                                                                                                          |
| **Hour-of-day usage**                    | `stats-cache.hourCounts` already loaded                                                                                                                                                                                 | Could draw a bar chart of 24 hours. Privacy note: Craig wants to skip "most active day" — but hour distribution is less identifying.        |
| **Most active day**                      | `stats-cache.dailyActivity` peak                                                                                                                                                                                        | **Skip per Craig's privacy concern.**                                                                                                       |

### Missing — Stats Models

| Stat                                  | Where it lives                                                                           | Notes                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Tokens-per-day timeseries**         | `stats-cache.dailyModelTokens` (88 entries)                                              | Per-day per-model token counts (in+out only, no cache). Already loaded. Trivial chart. |
| **Per-model In/Out token split**      | `stats-cache.modelUsage[*].inputTokens`/`outputTokens`                                   | Currently buried — not surfaced.                                                       |
| **Per-model cache split**             | `stats-cache.modelUsage[*].cacheReadInputTokens`/`cacheCreationInputTokens`              | Currently broken (wrong key).                                                          |
| **Per-model % share of total tokens** | derive from above                                                                        | One-line aggregation.                                                                  |
| **All-time / 7d / 30d toggle**        | requires re-aggregating from `dailyModelTokens` and `dailyActivity` for windowed rollups | Possible, modest work.                                                                 |

### Missing — Config settings (Settings snapshot)

Craig's `settings.json` currently has these top-level keys: `env`, `permissions`, `hooks`, `statusLine`, `enabledPlugins`, `skipDangerousModePermissionPrompt` (6 keys).

The Claude Code settings schema (from `~/.vscode/extensions/anthropic.claude-code-2.1.101-darwin-arm64/claude-code-settings.schema.json`) lists **80+ supported keys**. Of these, the user-facing ones the /usage Config tab probably surfaces:

- `autoCompactWindow` — auto-compact threshold
- `spinnerTipsEnabled` — show tips
- `prefersReducedMotion` — reduce motion
- `alwaysThinkingEnabled` — thinking mode
- `fastMode` / `fastModePerSessionOptIn` — fast mode
- `permissions.defaultMode` — default permission mode (currently captured)
- `respectGitignore`
- `autoUpdatesChannel` — release channel
- `model` — default model override
- `availableModels` — model allowlist
- `outputStyle` — output style
- `language` — preferred language
- `viewMode` — transcript view mode
- `agent` — main thread agent override
- `disableAllHooks`
- `disableSkillShellExecution`
- `enableAllProjectMcpServers`
- `cleanupPeriodDays` — chat retention
- `claudeMdExcludes` — excluded CLAUDE.md files
- `effortLevel`
- `feedbackSurveyRate`
- `fileSuggestion` — @ mention config
- `forceLoginMethod`
- `includeGitInstructions` / `attribution` — commit/PR co-author
- `pluginConfigs`
- `proactive` — autonomous background ops
- `remote` — remote session
- `sandbox`
- `showThinkingSummaries`
- `showClearContextOnPlanAccept`
- `spinnerVerbs` / `spinnerTipsOverride`
- `syntaxHighlightingDisabled`
- `terminalTitleFromRename`
- `voice`
- `worktree`

**Recommendation:** add a "Settings Snapshot" section that walks every key in `settings.json` and renders `key: value` (with truncation for objects/arrays). For boolean keys missing from settings.json, render the default ("auto") so the report shows a complete config picture. The schema file at `~/.vscode/extensions/anthropic.claude-code-*/claude-code-settings.schema.json` is a complete enumeration; you can hardcode the user-facing list.

**Note:** Craig's settings.json only sets 6 keys, so most of the schema list will be "default". That's _itself_ signal — "this user runs a near-stock config".

## Part 3: Other suspected issues

1. **Line 480: branch_prefixes counted per-distinct-branch-per-session.** A session that switches branches 3 times counts each prefix once. Probably intended, but worth noting.

2. **Line 624: phase_pcts uses `total_phase_calls or 1` to dodge divide-by-zero.** Fine but masks empty data — empty report would show "0%" for everything instead of "no data".

3. **Lines 631–635: phase order check uses `seq.index(...)` which finds the FIRST occurrence.** "test before ship" only counts when the first test happens before the first ship. A session that ships, fixes, then tests, then ships again would not count, even though it does test before its later ships. Edge case.

4. **Line 642: `autonomy_ratio = user_messages / assistant_messages`.** Numerator inflated by tool_results (see Part 1). Denominator includes assistant envelopes that are pure tool_use with no text. So both sides are wrong, in the same direction → ratio is artificially close to 1.0 → always lands in "Collaborative". The fix has to recompute both: numerator = real prompts (string content or content list with no tool_result), denominator = assistant envelopes containing text OR tool_use (drop pure synthetic).

5. **Line 1276: `total_sessions = max(meta.session_count, jsonl.sessions_with_data)`.** Two different cutoff semantics. `jsonl.sessions_with_data` uses mtime; `meta.session_count` uses start_time. Should pick one and stick with it everywhere — recommended: JSONL mtime, since that's the broader and more consistent set.

6. **Line 1281–1284: `tool_counts` merge.** `Counter(meta.tool_counts)` then iterates JSONL and only writes keys not already present. Wrong direction. Should be: trust JSONL (which is the actual ground truth from raw transcripts) and use session-meta only as fallback for sessions not present in JSONL (which shouldn't happen in practice).

7. **Lines 1486 and 1489: surgical-editor classifier divides edits by max(writes, 1).** Not a bug per se, but the threshold `edits > writes * 1.5` is binary and arbitrary. With Edit:Write = 3.06 (real), the classification is robust; with reported 2.85 it's also fine. Just noting the heuristic is fragile around 1.5.

8. **Line 661 / 665: `pr_count` is raw `pr-link` envelope count, not unique PRs.** Same envelope fires multiple times when the same PR is viewed/checked. Real fix: `len({entry["prUrl"] for entry in pr_link_entries})`. Spot check found 6× duplicates on `kabirdos/insightful#18`.

9. **Lines 668: `agent_background_pct = round(agent_background / agent_count * 100)`.** Rounds before display — fine, but Tool Usage merge means the Agent count Tool Usage chart shows (239) is unrelated to the 768 used here. Internally inconsistent presentation.

10. **Lines 845–895 `extract_stats_cache`: wrong key names.** Reads `cacheReadTokens` / `cacheCreationTokens`. Real keys: `cacheReadInputTokens` / `cacheCreationInputTokens`. Snake_case fallbacks (`cache_read_input_tokens`) also do not match because the file uses pure camelCase. **Always returns 0 → cache_read_ratio always 0:1.** Trivial 2-line fix.

11. **Lines 856–858 `peak_day_messages`.** Uses `messageCount` from dailyActivity. Craig flagged "most active day" as a privacy concern — currently surfaced as "Usage Intensity" panel. Should hide or generalize.

12. **Line 870–878 model_tokens dictionary.** Even after fixing the cache key, this is _all-time_ not 30-day. Mixing all-time stats from stats-cache with 30-day stats from JSONL/session-meta in the same report is currently happening invisibly: "Usage Intensity" panel (peak_day_messages, total_sessions_all_time) shows numbers that span the entire history of Claude Code use, while everything else is 30 days. Confusing.

13. **Privacy whitelist verification:** Audited every `.input.get(...)` and `inp.get(...)` call. Only the following input fields are read:
    - `Skill.input.skill` (line 498) — the skill name (public, comes from skill registry)
    - `Agent.input.subagent_type` / `model` / `run_in_background` (lines 504–509)
    - `Bash.input.command` (lines 516, 540) — passed through `extract_safe_command_name` which only returns the first token after env-stripping, with absolute paths reduced to basename, and Node-runner second tokens whitelisted to a strict test-runner set.

    No reads of `description`, file paths, message content, tool_result content, or any other field. **Privacy claim in SKILL.md and the script header is accurate.**

14. **Line 257: `harness_files["global_claude_md_lines"]` reads `~/.claude/CLAUDE.md`.** Privacy: this file may contain personal/business preferences. Reading just the line count is fine; the script does NOT read the content.

15. **Lines 906–914: `extract_instruction_maturity` reads `~/.claude/CLAUDE.md` headings.** Headings like `# Project: Acme Corp` would leak project names. Spot check on Craig's actual file: headings are generic ("Global Claude Code Instructions", "Git Workflow", etc.) so it's fine for him, but the design is brittle for other users.

16. **Lines 938–944: `extract_instruction_maturity` reads project CLAUDE.md headings under `~/Coding/`.** Same risk: headings often include project names. Outputs are surfaced in the "Instruction Maturity" → "Global CLAUDE.md Structure" tags. This crosses the project-specific-content line that the script promises to avoid. **Recommend: only count projects, do not surface heading text.**

17. **Lines 1009–1041: `extract_agent_details` reads agent definition descriptions** from `~/.claude/agents/*.md` (first 100 chars). Descriptions can include project context. Currently NOT surfaced in HTML, but `agent_details["agents"]` carries it forward unused — harmless but a tripwire if a future change starts rendering it.

18. **Line 257 + various: `coding_dir = Path.home() / "Coding"` is hardcoded.** Won't work for users whose projects live elsewhere (e.g. `~/dev`, `~/src`). Counts will be 0, harness_files will undercount, and instruction_maturity will be empty. Should walk a configurable list or use git config to find common project locations.

19. **Lines 706–732: `extract_permissions_profile` uses `Path.home().rglob(".claude/settings.local.json")`.** rglob from $HOME is slow and may walk directories the user doesn't want scanned (e.g. `~/Documents`). Restricted by depth check `len(sf.parts) > 10`, but still scans the whole home tree on every run. Should only walk known coding roots.

20. **`extract_safe_command_name` line 64–66: when first non-blank line is empty after splitting, returns None. But `cmd_name` for the workflow phase classifier then falls into "other" with name "None".** The Bash:None counts (196 in this report) are actually just Bash calls where the command was env-only or unparseable. They get incorrectly attributed to "other" phase. Better: skip these from phase counting entirely.

## Recommended fix sequence

Cheapest / highest-impact first. Each is a self-contained PR.

1. **Fix the cache-key typo (lines 876–877).** 2 lines. Unblocks cache_read_ratio in the Usage Intensity panel and gives every other downstream a true cache:input number.

2. **Fix the Models bar chart (#42).** Replace `models[model] += 1` (line 489) with accumulation of `usage.input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens`. Also rename the chart axis label to "Tokens (with cache)" so readers know what they're seeing.

3. **Fix Total Tokens (#43).** Compute totals from JSONL `message.usage` instead of session-meta. Add 4-way breakdown to integrity manifest. While here, add a "Tokens (excluding cache)" breakdown for users who want the smaller number to compare to /usage.

4. **Fix tool_counts merge (lines 1281–1284, 1606–1609).** Trust JSONL `tool_usage` first; use session-meta only as a fallback for tools not seen in JSONL. This single change fixes Tool Usage bar, File Op donut percentages, and the Agent count inconsistency.

5. **Fix autonomy ratio.** Recompute `user_messages` to exclude tool_result envelopes. Recompute `assistant_messages` to exclude pure-tool_use envelopes if comparing to "real turns". This fixes the Fire-and-Forget vs Collaborative misclassification — the most visible single label on the report.

6. **Fix PR count.** `pr_count = len({e["prUrl"] for e in pr_links})` instead of envelope count. Reduces 118 → 96 for Craig.

7. **Cap or filter session durations.** Add a sanity filter: drop sessions where `duration_minutes > 480` (8 hours), or compute duration from `(max(user_message_timestamps) - start_time)` capped to 8h. Mention "X sessions excluded as outliers" in the footer for transparency.

8. **Unify session count semantics.** Pick JSONL mtime as the canonical "in window" filter. Re-compute session-meta totals over the same set, or stop using session-meta for tokens entirely (point 3).

9. **Add Stats Overview parity:** active days, longest streak, current streak, first session date, activity calendar heatmap. All from `stats-cache.dailyActivity` (already loaded).

10. **Add Tokens-per-day timeseries.** From `stats-cache.dailyModelTokens` (already loaded). Stacked bars by model.

11. **Add Settings Snapshot section.** Walk every key in `settings.json` and render. Optionally enrich with defaults from the schema file for keys that aren't set. Hardcoded ordering for the most important ~25 user-facing keys.

12. **Improve phase classification.** Add `grep`, `find`, `cat`, `which`, `head`, `tail`, `awk`, `sed`, `tree`, `ag`, `rg` to EXPLORE_COMMANDS. Add `vercel`, `railway`, `supabase`, `gh`, `wrangler`, `stripe` to either implementation or shipping. Drop `Bash:None` from phase counting. Goal: get "other" under 10%.

13. **Strip project-specific content from instruction_maturity.** Only count projects, do not surface CLAUDE.md heading text.

14. **Make `~/Coding` configurable.** Read from an env var or settings file, default to a list of common dirs.

15. **Cache invalidation: add a `_data_freshness` block** in the integrity manifest that lists data source mtimes (stats-cache, session-meta, JSONL latest) so consumers can see how stale the report is.

## Appendix: Ground-truth numbers (for regression tests)

Snapshot taken 2026-04-12 03:43Z, 30-day window cutoff 2026-03-13 03:43Z. Compute these in CI to assert no regressions.

```
# Token totals (from JSONL message.usage in 30d window)
input_tokens:           337,031
output_tokens:          8,612,414
cache_read_tokens:      3,954,056,144
cache_creation_tokens:  156,791,634
GRAND_TOTAL_TOKENS:     4,119,797,223     # ≈ 4.12B

# Per-model tokens (4-way sum, 30d window)
claude-opus-4-6:        4,111,393,422     # 21,479 messages
claude-sonnet-4-6:      8,403,801         # 156 messages
<synthetic>:            0                 # 17 messages

# Sessions
session-meta in window (start_time>=cutoff):  78
JSONL files in window (mtime>=cutoff):       101
JSONL with tool_use:                          92
sessions with assistant.usage data:           96

# Tool calls (JSONL ground truth)
total_tool_calls:       13,272
total_tool_errors:      600
error_rate_pct:         4.52
Bash:                   5,373
Read:                   2,374
Edit:                   1,436
TaskUpdate:             778
Agent:                  768
Grep:                   595
Write:                  480
TaskCreate:             396
Glob:                   208
Skill:                  188
ToolSearch:             133
mcp__playwright__browser_click:    55
mcp__playwright__browser_navigate: 36
mcp__Claude_Preview__preview_eval: 32
WebSearch:              31

# Agents
agent_count:            768
agent_background:       449  (58.5%)
agent_types_top:
  general-purpose:      570
  Explore:               91
  search-specialist:     27
  superpowers:code-reviewer: 11
agent_models:
  sonnet:               211
  opus:                  17
  haiku:                 12

# MCP servers (in window, JSONL)
playwright:             223
Claude_Preview:         103
Claude_in_Chrome:        61
stitch:                  21

# Skills
distinct_skills:        45
total_skill_invocations: 188
top_skills:
  superpowers:brainstorming:               22
  superpowers:writing-plans:               19
  ux-mockup:                               15
  superpowers:subagent-driven-development: 10
  html-report:                             10
  research-orchestrator:                   10
  qa-checklist:                            10

# User messages (corrected)
total_user_envelopes:   15,597
real_user_prompts:      2,329       # NOT 15,597 — strip tool_result envelopes
tool_result_envelopes:  13,268

# Assistant envelopes
total_assistant_envelopes: 21,652
with_text:                  6,868
with_tool_use:             13,264
synthetic:                     17

# True autonomy ratio
real_user_prompts / assistant_envelopes:    0.108  → Fire-and-Forget
real_user_prompts / assistant_with_text:    0.339  → Directive

# Turn durations
turn_duration_events:   902
median_turn_s:          108.8
avg_turn_s:             235.4
max_turn_min:            62.6

# Hooks
hook_definitions_count: 9
hook_fires_total:       5,831
hook_fires_top:
  PreToolUse:Bash:      2,202
  PostToolUse:Edit:     1,082
  PostToolUse:Read:       971
  PreToolUse:Edit:        544

# Git (from session-meta — only 78 sessions)
total_commits:          69
total_lines_added:      38,872
total_lines_removed:    1,710

# PRs
pr_link_envelopes:      118     # current (wrong)
unique_pr_urls:          96     # corrected

# stats-cache.json all-time (verify these don't drift)
totalSessions:          593
totalMessages:          178,283
firstSessionDate:       2025-12-17T02:59:20.396Z
active_days_total:       71
longest_streak:          34
current_streak:           5     # as of 2026-04-12; was 6 in screenshot taken 2026-04-10

# stats-cache.json modelUsage (all-time, 4-way)
claude-opus-4-6:
  inputTokens:           1,324,031
  outputTokens:         15,714,822
  cacheReadInputTokens: 6,535,059,101    # NB: NOT cacheReadTokens
  cacheCreationInputTokens: 309,181,096  # NB: NOT cacheCreationTokens
claude-opus-4-5-20251101:
  inputTokens:           2,989,949
  outputTokens:          2,916,705
  cacheReadInputTokens:  3,480,873,619
  cacheCreationInputTokens: 261,481,657
claude-haiku-4-5-20251001:
  inputTokens:           1,321,907
  outputTokens:          1,001,733
  cacheReadInputTokens:    334,223,690
  cacheCreationInputTokens:  48,606,714
claude-sonnet-4-5-20250929:
  inputTokens:              44,770
  outputTokens:            193,921
  cacheReadInputTokens:    127,076,289
  cacheCreationInputTokens: 11,599,266

# Cache:Input ratio (corrected)
sum(cacheReadInputTokens) / sum(inputTokens) ≈  10,477,232,699 / 5,680,657 ≈ 1844:1 (all-time)
30d window:                                       3,954,056,144 / 337,031     ≈ 11,727:1
```
