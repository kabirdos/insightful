# Requirements — "Show how you work" generalization (Insight Harness vs. the long-form article)

- **Date:** 2026-06-04
- **Status:** Brainstorm — core product shape decided 2026-06-04; mockup built
- **Owner:** Craig
- **Trigger:** Matt Van Horn's "No IDE, Just plan.md and Voice" Claude Code workflow article ([source mirror](https://gu-log.vercel.app/en/posts/en-sp-126-20260322-mvanhorn-claude-code-hacks), [original post](https://x.com/mvanhorn/status/2061877533885473181)). The article is a strong example of someone sharing _how they work_ via a 7-rewrite long-form blog. Goal: make Insight Harness the **simple** way to do the same thing — one command, one page, no blog.

## The frame

Matt's article and an Insight Harness profile are two ways to answer "how do you work?" The article **asserts** (reader must trust); the profile **proves** (derived from real, PII-scrubbed JSONL). We should not try to _replicate_ a blog — unbounded prose will always beat a structured page on richness. We win on the axis the blog is weak on: **verification + zero authoring effort**.

> Positioning: Insight Harness is the _verified behavioral substrate a "how I work" post sits on — and the draft writes itself from your real data._

Design constraint that everything below must respect: **maximize auto-derived, minimize hand-written.** Where hand-writing is unavoidable (the "why," worked examples), the harness skill drafts it _from the captured evidence_ so sharing stays a one-edit action, not a seven-rewrite article.

## Decisions (brainstorm 2026-06-04)

Four product-shape decisions, made collaboratively, that anchor planning:

- **D1 — Primary job: teach & be copied.** The profile is a "here's how I work, take the good parts" artifact, not a dashboard. It pairs with the existing learn-mode. This raises the bar on _actionability_: surfaced items (hooks, skills, settings, MCP) should be copy/install-ready, not just listed.
- **D2 — Page spine: vanity-stats top → signature-pattern cards → copyable evidence.** Lead with the scannable credibility hit (tokens/sessions/PRs/commits/days), then 3–5 "signature pattern" cards that each expand to verified evidence, then the detailed copyable sections. Patterns-led hybrid, _not_ a blog-style prose essay and _not_ today's bare stats page.
- **D3 — Self-declared "My Stack" — included, clearly separated.** A visually distinct, explicitly-labeled "self-declared" section captures what the harness is blind to (voice/Monologue, editor/Zed, terminal/Ghostty, mic, remote infra). It must never blend into verified data — the verified-vs-declared boundary is load-bearing for credibility.
- **D4 — Narrative is chunked, not an essay.** The "how I work" story lives as one-line characterizations on each pattern card (auto-drafted from data, lightly editable), not a multi-paragraph auto-essay. Widening `writeupSections` feeds these card blurbs. The big prose essay (original Bucket C "unlock") is downgraded to per-card characterization.

**Signature patterns to feature** (verified ⊕ self-declared, drawn from the signal map): concurrency ("runs N sessions in parallel"), plan-first discipline, Claude+Codex split, skill authorship, voice-first input. Exact set is data-driven per user; these are the defaults the mockup demonstrates.

**Mockup:** `docs/mockups/show-how-you-work-profile.html` — illustrative profile built on Matt Van Horn's article-derived data, so the crossover is tangible.

**Recommended first shippable slice (smallest version that proves the bet):** D2's pattern cards powered by **Bucket A only** — concurrency + plan-first + dual-model + authorship, all computable from data `extract.py` already loads. No new data sources, no `harnessData` shape break, no self-declared storage yet. My Stack (D3) and card-blurb auto-drafting (D4) follow as slice 2.

## What the harness already emits (ground truth from `extract.py` `harness_json`)

Verified against `insight-harness/skills/insight-harness/scripts/extract.py` (v2.10.0). The emitted `harnessData` payload already carries:

- `mcpServers` (servers **used**, with invocation counts) + `approved_mcp_servers` (allowlisted) + `uses_mcp_pct`
- `plugins` (installed, **enabled/disabled**, marketplaces) + plugin-skill invocation counts
- `skillInventory` (frontmatter + README + hero showcase; authored-by-user skills are shareable)
- `hookDefinitions` (scrubbed, copyable) + `hookFrequency`
- `toolUsage`, `cliTools`, `fileOpStyle` (Edit vs Write), `languages`, `models`, `perModelTokens`
- `agentDispatch` (subagent types, models, background %), `permissionModes`
- `workSurfaces` (entrypoint cli/sdk-cli + presence of Codex/Cursor/Gemini/Copilot/Factory/Claude desktop)
- `workflowData` → `phaseDistribution`, `phaseTransitions`, `phaseStats.testBeforeShipPct`, `exploreBeforeImplPct`
- `stats` → `totalTokens`, `lifetimeTokens`, `sessionCount`, `avgSessionMinutes`, **`commitCount`**, **`prCount`**, `gitPatterns`
- `autonomy` (label + human:assistant turn ratio + error rate)
- **`writeupSections`** — already auto-generated prose characterizations of the above
- `enhancedStats` (linesAdded/linesRemoved, msgsPerDay), `featurePills`, `integrityHash`

The headline: **we already capture the scaffolding _and_ already auto-write prose about it.** The narrative layer is not greenfield — it's `writeupSections`, which just needs widening.

## The Generalizable Signal Map

For every distinct thing Matt shares, the generalizable signal and where it lands. Legend:
✅ shipped · 🟡 have data, presented as raw stat not characterization · 🔵 computable from data we already read (new compute, no new source) · 🟣 self-declared only (harness is blind) · ⚫ external source required (git/GitHub/editor)

| Matt's element                                 | Generalizable signal            | Status                                            | Notes                                                                |
| ---------------------------------------------- | ------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `/last30days` for research                     | Research-tool inventory + usage | ✅ `skillInventory` + invocation count            | He _authored_ it → showcase surfaces it                              |
| `/ce:plan`, `/ce:work`                         | Planning/build command usage    | ✅ plugin-skill invocations                       | Heavy counts = strong "planner" signal                               |
| Compound Engineering plugin                    | Installed plugins + state       | ✅ `plugins`                                      | enabled/disabled + marketplace                                       |
| Granola (MCP)                                  | MCP servers used/installed      | ✅ `mcpServers` + `approved_mcp_servers`          | **Answers "do we show MCP?" — yes**                                  |
| Bypass-permissions setting                     | Permission posture              | ✅ `permissionModes`                              |                                                                      |
| Sound-on-completion hook                       | Copyable hooks                  | ✅ `hookDefinitions` (scrubbed) + `hookFrequency` | Exactly the showcase use-case                                        |
| Token/credit burn, dual $200 plans             | Spend + per-model split         | ✅ `perModelTokens`, `totalTokens`                | Strategy framing missing (see narrative)                             |
| 263 commits                                    | Commit/PR volume                | ✅ `commitCount`, `prCount`, `gitPatterns`        | Plan-_file_ count specifically not captured                          |
| Research→Plan→Build loop                       | Phase discipline                | 🟡 `phaseStats`, `phaseTransitions`               | Have data; not framed as a named "how I work" loop                   |
| Claude+Codex split (`/ce:work --codex`)        | Multi-tool orchestration        | 🟡 `workSurfaces` + Codex profile                 | Two separate reports; not characterized as one split                 |
| Parallel 4–6 sessions ("assembly line")        | **Concurrency**                 | 🔵 from session timestamps                        | `avgSessionMinutes` proves we read start+end → overlap is computable |
| "Night-night mode," always-on                  | Temporal signature              | 🔵 from session timestamps                        | Time-of-day / cadence distribution                                   |
| Skills he built (`/last30days` 4.5K⭐)         | **Authorship**                  | 🔵 from skills dir + showcase flag                | Distinguish authored vs installed — credibility marker               |
| Voice (Monologue/WhisperFlow/mic)              | Input modality                  | 🟣 self-declared                                  | Dictation arrives as plain text we never read                        |
| Zed autosave @ 500ms, Ghostty                  | Editor/terminal stack           | 🟣 self-declared                                  | Outside the harness                                                  |
| Remote infra (Mac Mini/OpenClaw/tmux/Telegram) | Remote/headless orchestration   | 🟣 partial via `workSurfaces` mtime               | Presence only, not the orchestration                                 |
| 70 plan.md files                               | Plan-artifact count             | ⚫ repo scan                                      | Privacy-sensitive; out of current data boundary                      |
| OSS contributions / contributor rank           | External activity               | ⚫ GitHub                                         | Out of scope for v1                                                  |
| Disney/lunch worked examples                   | Worked example / case study     | ⚫ narrative                                      | The blog's whole punch; deliberately _not_ chased (see below)        |
| "No IDE, just plan.md + voice" identity        | Identity / philosophy           | 🟣 self-declared headline                         | One-line, optional                                                   |
| 7 rewrites, "sorry sweetie," humor             | Personality                     | —                                                 | Not a product goal                                                   |

**Tally:** of ~21 shareable elements — ~9 ✅ shipped, ~2 🟡 (data exists, under-presented), ~3 🔵 (cheap new compute), ~4 🟣 (self-declared), ~3 ⚫ (external/out-of-scope). The harness already covers the _verifiable mechanics_; the gaps are concurrency, characterization framing, the un-seeable stack, and narrative.

## Expansion buckets (priority order)

### Bucket A — surface data we already have as _characterizations_ (highest ROI)

The blog's value is the _characterization_ ("I run 5 sessions and always plan first"), not raw counts. We have the counts; we under-present them.

- **A1 — Concurrency** 🔵: compute max/typical concurrent sessions from session start/end overlap. Headline: "Runs N Claude Code sessions in parallel." This is Matt's entire identity and we already load the timestamps.
- **A2 — Plan-first / discipline framing** 🟡→characterization: promote `phaseStats` into a one-liner ("Plans before building 90% of the time; tests before shipping 85%").
- **A3 — Dual-model orchestration** 🟡: characterize the Claude-orchestrates / Codex-implements split across the two profiles instead of leaving them as separate reports.
- **A4 — Authorship** 🔵: flag skills the user _built_ vs installed. "Author of 3 published skills."
- **A5 — Temporal signature** 🔵 (optional): cadence / always-on pattern.

### Bucket B — thin self-declared "My Stack" section (cheap, fills visible gaps)

The harness genuinely cannot see voice tools, editor, mic, or remote setup. A small optional self-declared block (voice tool, editor, terminal, mic, remote infra, one-line identity) closes the most-cited blog gaps for near-zero engineering. Must be clearly labeled self-declared so it never dilutes the "verified" promise.

### Bucket C — widen the existing auto-writeup into a "How I Work" narrative (the unlock)

`writeupSections` already drafts prose. Extend it (and feed it the agent-consumable payload from #151) to produce a short, characterization-forward "How I Work" narrative the user lightly edits — turning a 7-rewrite article into a 1-edit page. This is the core differentiator: the evidence writes its own story.

### Bucket D — external enrichment (defer)

git plan-file counts, GitHub contributions, editor config. More plumbing, privacy-sensitive, lower marginal value. Explicitly **not** v1.

### Explicit non-goal

Worked examples (Disney, lunch→proposal→hire). This is where the blog's labor lives and where "simple" breaks. Let the data tell the _how_; offer at most one optional linked case-study URL for the _what-I-shipped_.

## Skill improvement backlog (from running it on real Claude + Codex data, 2026-06-04)

Running `/insight-harness` on the owner's own machine (Claude: 11.3B lifetime / 6.6B 30d tokens, 106 sessions, "Fire-and-Forget" autonomy; Codex: 1.55B tokens, 806 sessions, email/workspace-automation profile) surfaced both bugs and feature gaps. Ranked by what this initiative needs.

**Credibility fixes (the product breaks if verified data is silently wrong):**

- **B1 — Stop shipping silent zeros. ✅ duration MERGED (insight-harness #30).** `durationHours`, `commitCount`, `linesAdded` come _only_ from `~/.claude/usage-data/session-meta/` — a legacy dir current Claude Code no longer writes (consolidated into `stats-cache.json`, which has no per-session duration). On the owner's machine all three rendered `0`/`null` while everything else was rich. A `0h` reads as a _false claim_. Tracked: **insight-harness#29**. Duration fallback reconstructs wall-clock duration from per-session JSONL `timestamp` (capped at `MAX_SESSION_MINUTES`; verified 0 → 642.7h). **Still open in #29:** commits/lines fallback + a "never render a missing metric as 0" rule.
- **B2 — Ship the _real_ activity series, not a synthetic one. ✅ MERGED end-to-end (insight-harness #31 data + insightful #155 render).** The `ActivityHeatmap` used to _fabricate_ daily distribution via a seeded PRNG. Now joins `stats-cache.json` `dailyActivity.sessionCount` + summed `dailyModelTokens` into `harnessData.dailyActivity` `[{date, sessions, tokens}]`, threaded through the type/parser into the heatmap's `dailyData` prop. Falls back to synthetic when absent. **Caveat (tracked in #29):** `stats-cache.json` freshness is Claude Code's; a stale cache yields real-but-older days.

**"Show how you work" features (the mockup's pitch):**

- **B3 — Auto-emit Signature Patterns.** Everything the pattern cards need is already computed — `autonomy.label`, `phaseStats` (74% explore / 3% test), `agentDispatch` (304 agents, sonnet/opus tiering), skill `source` (authorship). Extend `writeupSections` to emit 3–5 characterization headlines + proof lines so the page leads with the _how_, not raw bars.
- **B4 — Two cheap signals from data already on disk. ✅ DONE end-to-end.** Data: concurrency `{maxConcurrent, medianConcurrent, sessionsCounted}` (insight-harness #32, sweep over the `(start,end)` intervals #30 collects) + temporal `{hourCounts, peakHour, label}` from `stats-cache.json` `hourCounts` (#33). Render: **Work Rhythm** card (insightful #156) — parallel-session stats + a 24-hour activity histogram, with hide/strip visibility wired (workRhythm is strippable since the fields are card-only). Verified live: **maxConcurrent 13, medianConcurrent 9** (107 sessions), **"Afternoon peak" (3pm)**.
- **B5 — Unify Claude + Codex into one profile.** Today they're two separate HTML files/payloads. The mockup's tab toggle + "Claude codes, Codex runs ops" contrast is the single most compelling artifact here — and only exists when unified. Emit a combined payload or merge server-side by user.
- **B6 — Self-declared "My Stack" input.** The skill structurally can't see voice/editor/mic/remote. A small `~/.claude/insight-harness/stack.json` the user fills, shipped in a clearly-separated payload field (never blended with verified data). Same as Bucket B above.
- **B7 — Ship the cost estimate.** `perModelTokens` is present; emit est. API cost so the "$X at API rates vs flat plan" flex is real and consistent across pages.

B1–B2 are credibility; B3–B7 are the feature surface this brainstorm is pitching. Mockup demonstrating all of it: `docs/mockups/show-how-you-work-profile.html` (real owner data, both surfaces).

## Open questions for pressure-testing

1. For A1 concurrency — what's the right threshold for "parallel"? Overlapping wall-clock, or overlap > N minutes to exclude incidental tab-switching?
2. Does surfacing concurrency/authorship change the PII/fingerprinting surface we already disclose? (likely no — it's aggregate counts.)
3. Bucket B self-declared data: store on `InsightReport` (new column) or keep client-side only? Must not break the `harnessData` JSON shape invariant.
4. Bucket C: generate the narrative skill-side (in `extract.py`/`learn.py`, ships in payload) or server-side from the agent payload? Skill-side keeps it local-first and matches current architecture.
5. How do we visually separate ✅ verified from 🟣 self-declared so the credibility promise holds?

## Next step

Run `ce-brainstorm` / `ce-doc-review` to pressure-test the buckets, then `ce-plan` Bucket A (concurrency + characterization framing) as the first shippable slice — it's pure extraction work on data we already load.
