---
date: 2026-05-25
topic: codex-extractor-multiagent
---

# Codex Extractor & Multi-Agent Harness Profile

## Problem Frame

Insightful's `insight-harness` skill today profiles exactly one tool: Claude Code. It reads `~/.claude/`, scrubs PII, and publishes a "harness profile" (skills, hooks, plugins, tool usage, tokens, workflow patterns) to insightharness.com. That artifact answers _"what does this person's Claude Code setup look like?"_

The product owner wants to expand the lens from **one tool** to **how a person works across tools** — starting with OpenAI Codex, which the author already uses heavily (267 Codex sessions in the trailing 30 days, 36 active days since 2026-04-01). The strategic bet: **"how this person works across agents" is more differentiating recruiting content than any single-tool profile.** The audience is public AI power-users we want to recruit to publish profiles; a multi-agent profile is a stronger flex and a harder thing to fake.

**This is a positioning shift, not just a parser.** Today the profile's implicit claim is "Claude Code mastery." A multi-agent profile claims "AI-native operator across the ecosystem." That reframes the page, the outreach pitch, and the agent-consumable payload (see `2026-04-28-agent-consumable-harness-report-requirements.md`).

### The honest limit: only LOCAL data is visible

This is the single most important constraint and it must be stated on the artifact itself (the 2026-04-09 prototype already did this for tokens — we extend the principle):

- **Codex CLI / `codex exec` — yes.** Writes to `~/.codex/` exactly like Claude Code writes to `~/.claude/`. Fully local, fully parseable.
- **Codex desktop app (Electron) — recency/presence only.** Storage lives in `~/Library/Application Support/Codex/` as Chromium SQLite/LevelDB blobs (Cookies, Session Storage, IndexedDB). It is actively used (1,406 files modified in the trailing 5 days; most-recent mtime is today). But the content is opaque Electron storage — we can detect _that_ the desktop app is in use and _how recently_, not _what_ was done. Parsing message content is out of scope and likely a moving target across app versions.
- **Codex mobile / web / Cowork — invisible.** Server-side; nothing lands locally. We cannot detect it at all.

The profile therefore measures **the locally-visible surface of a person's agent usage**, not their total agent usage. The artifact must say so plainly, or it over-claims. A user who does most Codex work on mobile would show a thin Codex profile that misrepresents them.

## Decisions (resolved in 2026-05-25 brainstorm)

- **D1 — Artifact shape: one profile, tool-partitioned (Option C).** Not separate reports. Both tools' data lives in one report at one URL, viewed through a tool selector/tabs. **Why:** same-tool-to-same-tool agent learning — a consumer's Claude agent learns from the author's Claude slice, a consumer's Codex agent from the Codex slice; the slices must never cross. This makes the agent-consumable payload a tool-keyed map from day one.
- **D2 — Scope: Claude Code + Codex only (not generic N-tool).** Build a clean two-tool shape; generalize to N tools later only if a third tool actually arrives (YAGNI). The `tools`-keyed structure stays forward-compatible without building generic multi-tool machinery now. (Note: coarse _presence detection_ of other tools — Gemini CLI, Cursor, Copilot, Factory — already ships via Work Surfaces; that is presence-pills only, not a full profile.)
- **D3 — Thin-tool handling: show + "local CLI only" caveat, with an activity floor.** Always label a tool's data honestly ("local CLI data only — may use Codex more elsewhere"); hide a tab only below a minimal activity floor so a near-empty profile is never presented as someone's whole Codex story. **Why:** credibility for the public-author audience while preserving the cross-tool signal.
- **D4 — Codex skills: inventory only, no usage count.** Codex loads skills into context (no discrete invocation event), so a per-skill "calls" count has no clean signal. Show which Codex skills the author has (name, description, install pointer); ship no fabricated count.
- **D5 — Safety: per-tool section.** Each tool renders its native mechanism under a "Safety & Automation" heading inside its own profile: Claude → hooks + fire frequencies; Codex → rules allowlist + `approval_policy` + `sandbox_policy`. No forced cross-tool unification.
- **D6 — Codex desktop app: presence + recency only.** Detect that the desktop app is in use and how recently; never parse Electron storage content.
- **D7 — Ship Codex token totals.** Use `payload.token_count.info.total_token_usage` (now reliable); retire the stale April "no tokens" disclaimer. Note in the publish disclosure that reasoning-spend (`reasoning_output_tokens`, `effort`) is now visible.

## Existing-Prototype Findings

**There is no dedicated Codex-extractor script anywhere.** Searched the `insight-harness` repo, `~/Coding/claude-toolkit` (skills source-of-truth), `~/.codex`, and `~/Coding` broadly. What exists:

1. **The 2026-04-09 HTML artifact** (`~/.codex/usage-data/insight-harness-codex-20260409-000327.html`, 33 KB). A complete, polished Codex profile page covering: Tool Usage, CLI Commands, Skills, Plugins, Agent Dispatch, Environment, Session Shape, MCP and Runtime, Project Ecosystem, Workflow Phases, Skill Workflow. Subtitle: _"79 sessions across 11 active days | 2026-03-12 to 2026-04-09."_ It carries a disclaimer: _"Codex session logs currently do not expose reliable token totals, so this report intentionally omits token usage claims."_ This is **a one-off output, not committed code** — the generator that produced it was not saved (or was discarded). So the work is **building on a design spike, not greenfield**: the section taxonomy and the honest-limit framing are already proven; the parser is not.

2. **Coarse tool presence-detection already ships** in the Claude extractor (`skills/insight-harness/scripts/extract.py`). As of the Work Surfaces change (PR #22), this is `detect_agent_tools()` — directory presence + mtime for Codex CLI, Codex desktop, Cursor, Claude desktop, Gemini CLI, Copilot, and Factory (it superseded the older text-scanning `extract_hybrid_tools()`). This is the seam the multi-agent work plugs into — presence-detection already ships; the depth is what's missing.

**Material change since April:** the 2026-04-09 disclaimer is now **stale**. Codex session logs _do_ expose reliable token totals today — `payload.token_count.info.total_token_usage` carries `{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens, total_tokens}` as a cumulative-per-session counter. A new extractor should ship token stats (and must not blindly copy the old disclaimer). Confirmed on a real session: cumulative `total_tokens` of 433,312 across 14 `token_count` records in one rollout file.

## Codex Data Inventory

Verified against real data in `~/.codex`. Structural mirror of `~/.claude` confirmed.

### Directory layout (mirrors `~/.claude`)

- `sessions/YYYY/MM/DD/rollout-*.jsonl` — per-session event logs (545 total; 267 in trailing 30d). **The richest source.**
- `skills/` — 21 skill directories, each with `SKILL.md` using **the same `name:`/`description:` frontmatter** as Claude skills. Same `parse_skill_frontmatter()` works unchanged.
- `plugins/` — plugin cache (config lists `github`, `gmail`, `slack`, `computer-use`, `google-calendar`, `google-drive`, `granola`, `documents`, `spreadsheets`, `presentations`, `browser` from `openai-curated`/`openai-bundled`/`openai-primary-runtime` marketplaces).
- `rules/default.rules` — Codex's permission-allowlist equivalent: `prefix_rule(pattern=[...], decision="allow")` lines. **Contains absolute OS-username paths and full shell commands — a scrub surface** (e.g. `pattern=["open", "/Users/craigdossantos/..."]`, and one rule embeds a Vercel bearer-token curl).
- `memories/` — present but empty in this install.
- `config.toml` — model, reasoning effort, per-project `trust_level` (keyed by **absolute project paths** → scrub surface), enabled plugins, marketplaces, feature flags (`multi_agent`, `js_repl`).
- `history.jsonl` — keys `{session_id, text, ts}`. `text` is raw prompt content → **do not read `text`** (PII/content).
- `session_index.jsonl` — keys `{id, thread_name, updated_at}`. `thread_name` may leak project/feature names → treat as content.
- `version.json` — `{latest_version, last_checked_at, dismissed_version}`.
- `sqlite/`, `logs_2.sqlite`, `state_5.sqlite`, `goals_*.sqlite` — Codex internal DBs; not yet characterized, likely lower-value and higher-risk than the JSONL. Out of scope for v1.

### Rollout JSONL schema (the core)

Each line: `{timestamp, type, payload}`. `type` ∈ `{session_meta, event_msg, response_item, turn_context}`. `payload.type` breakdown (one session): `function_call`, `function_call_output`, `token_count`, `reasoning`, `message`, `agent_message`, `task_started`, `task_complete`, `user_message`, plus the `session_meta` header.

High-value, **safe-to-read** fields:

- **`session_meta`** → `id`, `timestamp`, `cli_version`, `originator` (`codex_exec`), `model_provider`, `model`, `personality`, `effort`, `approval_policy`, `sandbox_policy`, `collaboration_mode`, `source.subagent` (e.g. `"review"`). **`cwd` and `git.{commit_hash, branch, repository_url}` are present but are scrub surfaces** — `repository_url` populated 5/5 in the sample (carries GitHub owner/repo).
- **`function_call.name`** → the tool taxonomy. Real distribution (May sessions): `exec_command` (1,727), `write_stdin` (49), `shell_command` (97 in wider sample), `update_plan` (6–27), `spawn_agent`/`wait_agent`/`close_agent` (sub-agent lifecycle), `view_image`, `press_key`/`click`/`set_value`/`get_app_state`/`list_apps` (computer-use), plus MCP-style `_list_meetings`/`_get_meetings` (Granola). **Tool _name_ is safe; `arguments` is not** (carries `cmd`, `workdir` → content + paths).
- **`token_count.info.total_token_usage`** → `{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens, total_tokens}`. Cumulative per session. **Strategy: take the last record per rollout file, sum across files for the 30d total.**
- **`function_call.arguments.cmd`** → for the CLI-command breakdown, the _first token only_ via the existing `extract_safe_command_name()` normalizer (never the full command). This is the Codex analog of the Bash-first-token rule.

### Mapping to the existing Claude `harnessData` shape

| Claude profile field                        | Codex source                                                                                                                                                                                                                                                                                                | Maps cleanly?                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `skillInventory` (name/desc/README/hero)    | `~/.codex/skills/*/SKILL.md` (21) — same frontmatter                                                                                                                                                                                                                                                        | **Yes** — `parse_skill_frontmatter()` + showcase pipeline reusable as-is                        |
| `skillInvocations` (counts)                 | **Hard.** Codex has no `Skill` tool-call; skills load into context, not via a discrete invocation event. Best proxy: skill-dir references in exec/session content (noisy — a directory-listing inflates every skill to a flat baseline; `code-review` 25 / `codex-primary-runtime` 18 stood out as genuine) | **Partial / divergent**                                                                         |
| `toolUsage`                                 | `function_call.name` counts                                                                                                                                                                                                                                                                                 | **Yes**, but a _different tool universe_ (exec/shell/plan/agent-lifecycle, not Read/Edit/Write) |
| `cliTools` (Bash first-token)               | `exec_command`/`shell_command` `arguments.cmd` first-token                                                                                                                                                                                                                                                  | **Yes** — reuse `extract_safe_command_name()`                                                   |
| token totals (`perModelTokens`, throughput) | `token_count.info` (now available!)                                                                                                                                                                                                                                                                         | **Yes** — richer than April thought; adds `reasoning_output_tokens` (Codex-specific)            |
| `agentDispatch` (sub-agents)                | `spawn_agent`/`wait_agent`/`close_agent` + `session_meta.source.subagent`                                                                                                                                                                                                                                   | **Yes**, different mechanism (no `subagent_type`/`model` the way Claude's Agent tool carries)   |
| `hookDefinitions`                           | **No Codex equivalent.** Codex has `rules/default.rules` (prefix allowlist), not lifecycle hooks                                                                                                                                                                                                            | **Diverges** — map to a "permission rules" concept instead                                      |
| `plugins`, `mcpServers`                     | `config.toml` `[plugins.*]` + MCP-style `_`-prefixed function calls                                                                                                                                                                                                                                         | **Yes**                                                                                         |
| `permissionModes`                           | `session_meta.approval_policy` + `sandbox_policy` + `rules/default.rules`                                                                                                                                                                                                                                   | **Diverges** — Codex model is approval-policy + sandbox, not Claude's permission modes          |
| `workflowData` (phases, transitions)        | Derivable from `function_call.name` sequences via the same phase classifier (re-mapped: `exec_command`→needs sub-classification by cmd token)                                                                                                                                                               | **Partial** — phase classifier needs Codex-aware tool→phase mapping                             |
| `versions`, `models`, `entrypoints`         | `session_meta.cli_version`/`model`/`originator`                                                                                                                                                                                                                                                             | **Yes**                                                                                         |
| session count / active days / duration      | rollout file timestamps + `session_meta`                                                                                                                                                                                                                                                                    | **Yes**                                                                                         |

**Codex-specific fields with no Claude analog** (net-new, and part of the differentiation): `reasoning_output_tokens`, `effort` (reasoning-effort setting), `personality`, `collaboration_mode`, `sandbox_policy`, the `spawn_agent`/`wait_agent` parallel-agent lifecycle, and computer-use tool calls (`click`/`press_key`/`get_app_state`).

## Product / Architecture Options

Three shapes for how Codex data reaches insightharness.com. They differ in scope, schema risk, and how much they touch the existing upload/publish flow (`src/app/api/upload/route.ts` → `harnessData` JSON → `/insights/[username]/[slug]`).

### Option A — Separate Codex report (parallel artifact)

A standalone `insight-harness-codex` extractor emits its own HTML + JSON island; uploads as a _distinct_ `InsightReport` with a `tool: "codex"` discriminator. Two reports per user, two URLs.

- **Pros:** lowest coupling; ships fast; the 2026-04-09 artifact already proves the standalone page design; no risk to the working Claude pipeline; per-tool schema can diverge freely.
- **Cons:** doesn't deliver the "how they work across tools" story in one glance — a reviewer must visit two pages; duplicated nav/upload UX; the cross-tool _comparison_ (the actual differentiator) lives in neither report.

### Option B — Combined multi-tool profile (one artifact, both tools)

One extractor run produces a single profile with a `tools: ["claude-code", "codex"]` array; the page renders side-by-side or unified sections. One `InsightReport`, one URL.

- **Pros:** delivers the strategic story directly ("here's me across both tools"); enables cross-tool stats ("60% of shipping happens in Codex, 80% of brainstorming in Claude"); one publish flow.
- **Cons:** biggest schema change to `harnessData` (must stay backward-compatible — CLAUDE.md invariant: preserve the existing JSON shape); the extractor must run on machines where one tool may be absent; harder to reason about "thin Codex, rich Claude" asymmetry without misleading the reader.

### Option C — Tool-selector on one page (combined storage, tabbed view)

Store both tools' data in one report (as Option B) but render a tool **selector/tab** so each tool's profile is viewed independently, with an optional "Combined" tab for cross-tool stats. One URL, progressive disclosure.

- **Pros:** gets Option B's single-artifact + cross-tool upside while sidestepping the "how do I lay out two tools at once" design problem; degrades gracefully when a tool is thin/absent (hide its tab); matches how the agent-consumable payload would want it (a `tools` map keyed by tool name).
- **Cons:** still the Option B schema lift; tabbed UI is more front-end work than a second static page.

### Relationship to the agent-consumable payload work

The `2026-04-28` brainstorm freezes a `harness-agent-payload` JSON contract with `schema_version`. **A multi-agent profile must shape that contract from day one**, or we freeze a Claude-only schema and re-break it. The clean shape is a top-level `tools` map: `{ "claude-code": {...}, "codex": {...}, "_cross_tool": {...} }`, each tool's object reusing the per-skill/per-tool sub-schemas. Phase 0 findings (`phase0-results-2026-05-23.md`) apply to Codex too: F1 (drop hero blobs from the agent payload), F2 (guarantee a minimum field set per tool), F4 (structured install pointers) — and Codex's skill-invocation gap is a _new_ instance of F3 (the highest-signal item is the most opaque).

## Privacy / Threat Model (mirror the existing scrub posture)

The existing Claude extractor's posture (`SKILL.md`, `extract.py`): **strict field whitelist; never read tool arguments, message text, tool results, or project file paths; scrub git name/email, OS-username paths, GitHub URLs, and `@you` mentions; exclude `repo: private`/`none` skills entirely.** Codex inherits this verbatim, plus Codex-specific surfaces:

| Codex surface                                                                                                   | Risk                                                        | Posture                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_meta.git.repository_url` (5/5 populated)                                                               | GitHub owner/repo → identity                                | Scrub via the existing GitHub-URL rule; do not emit raw                                                                                                               |
| `session_meta.cwd`, `config.toml` per-project paths, `rules/*.rules` paths                                      | OS-username + project names                                 | Reuse OS-username path scrub; never emit raw absolute paths                                                                                                           |
| `rules/default.rules` command bodies                                                                            | One sampled rule embeds a **Vercel bearer token** in a curl | **Never read rule command bodies.** Extract only the prefix's first token (the binary name), same as Bash. Treat rule files as a secret-bearing surface — over-redact |
| `function_call.arguments.cmd` / `.workdir`                                                                      | Full shell commands + paths                                 | Never read except first-token via `extract_safe_command_name()`                                                                                                       |
| `history.jsonl.text`, `session_index.jsonl.thread_name`, `user_message`, `message.content`, `reasoning.content` | Raw prompt/response content                                 | **Never read.** Not whitelisted                                                                                                                                       |
| Codex `skills/*/README.md` + heroes                                                                             | Same as Claude showcase                                     | Same two-pass owner-aware scrub + PNG/JPEG magic-byte check + per-skill caps; honor `repo: private/none`                                                              |
| Codex desktop Electron storage                                                                                  | Opaque, version-volatile                                    | Read **presence + mtime only**; never parse blobs                                                                                                                     |

**Threat carryover from `2026-04-28`:** combinatorial fingerprinting gets _stronger_ with a second tool's data union (accept + disclose at publish time); prompt-injection-as-data now has a second author-controlled corpus (Codex READMEs/descriptions) — namespace free-text the same way. **New:** the `reasoning_output_tokens` and `effort` fields reveal model-tier/reasoning-spend patterns; harmless but note in the disclosure that reasoning-spend is now visible.

## Scope Boundaries

**In scope (v1 candidate):**

- A Codex extractor (`extract.py` analog) reading `~/.codex/{sessions,skills,plugins,rules,config.toml,version.json}`, reusing the existing PII-scrub, field-whitelist, skill-frontmatter parser, command-name normalizer, and showcase pipeline.
- Codex token totals (correcting the stale April disclaimer).
- Codex-aware tool→phase classification.
- Presence + recency detection for the Codex desktop app (no content).
- A clear on-artifact "local-data-only" limit statement.

**Not in scope (v1):**

- Parsing Codex desktop Electron storage content.
- Parsing `~/.codex/*.sqlite` internal DBs.
- Mobile/web/Cowork detection (impossible locally).
- Reading any content field (`text`, `thread_name`, `cmd`, `message.content`, `reasoning`).
- A full combined-page redesign (depends on the option chosen below).

**Explicitly deferred:** cross-tool comparison stats (the `_cross_tool` payload block) — high value but should follow once single-tool Codex data is validated.

## Recommended Phased Approach

**Phase 1 — Codex extractor, standalone output (Option A as the parser foundation).** Build the Codex extractor mirroring `extract.py`'s structure and privacy posture. Emit a standalone Codex profile (the 2026-04-09 artifact is the design reference) _and_ a `harness-data`-style JSON island shaped as a per-tool object so it's forward-compatible with a `tools` map. Validate the data is accurate and the scrub holds before touching the publish schema. Low risk to the working Claude pipeline.

**Phase 2 — Combined storage + tool selector (Option C).** Extend `harnessData` to a `tools` map (backward-compatible — Claude data stays at its current keys or moves behind `tools["claude-code"]` with a compatibility shim), add a tool selector to `/insights/[username]/[slug]`, and gate each tab on data presence so "thin Codex" hides rather than misleads. This is the artifact that delivers the strategic "across tools" story.

**Phase 3 — Cross-tool stats + agent payload.** Add the `_cross_tool` block (which tool owns which workflow phase, relative token spend, skill overlap) and fold the whole `tools` map into the `harness-agent-payload` contract from the `2026-04-28` brainstorm, applying the Phase 0 F1–F8 fixes per tool.

**Rationale for A→C→cross-tool rather than straight to B:** Option C is the right _end_ shape, but jumping there before the Codex parser is proven means designing a combined UI around data we haven't validated. Phase 1 de-risks the parser and the scrub; Phase 2 commits the schema once; Phase 3 adds the differentiating layer. Each phase ships independently and is revertible — matching the repo's one-atomic-change-per-PR norm.

## Outstanding Questions

The strategic and product questions are resolved in **Decisions (D1–D7)** above. What remains is technical and belongs in planning.

### Deferred to Planning

- **[Affects D4][Needs research]** Is there a reliable Codex skill-usage signal in `~/.codex/sqlite` or the logs? If found, D4's inventory-only view can add counts later; if not, inventory-only stands. Investigate during planning rather than blocking the brainstorm.
- **[Affects D1/D2][Technical]** Backward-compatibility shim for the existing `harnessData` JSON shape when introducing the `tools` map. CLAUDE.md invariant requires preserving the current column shape — decide whether Claude data stays at its current top-level keys with a `tools["claude-code"]` alias, or moves with a compatibility read-shim. Migration approach → planning.
- **[Affects schema][Technical]** Where the per-tool sub-schema lives relative to the `2026-04-28` `harness-agent-payload` contract, and how the Claude and Codex per-tool schemas stay aligned (shared `schema_version`, F2 minimum-field-set guarantee per tool). Resolve when the agent-payload contract is implemented.
