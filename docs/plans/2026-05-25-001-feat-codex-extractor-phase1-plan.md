---
title: "feat: Codex extractor (Phase 1 — standalone profile)"
type: feat
status: completed
date: 2026-05-25
deepened: 2026-05-26
origin: docs/brainstorms/2026-05-25-codex-extractor-multiagent-requirements.md
---

# feat: Codex Extractor — Phase 1 (Standalone Profile)

**Target repo:** `insight-harness` (`/Users/craigdossantos/Coding/insight-harness`). Code paths are relative to that repo; the mirrored file is `skills/insight-harness/scripts/extract.py`. This plan lives in the `insightful` repo per the planning-doc convention.

> **Revised 2026-05-26 after document-review.** Five reviewers inspected the real `~/.codex` tree and falsified several first-draft assumptions about Codex's data formats. The corrections below are grounded in that inspection, not the Claude analogy. Key reversals: token totals are **cumulative-per-session** (not per-line deltas); the token path is `payload.info.total_token_usage`; rollout logs come in **two Codex formats**; `config.toml` uses different safety keys; commands and rules are **structured lists**, not shell strings; and `pii_scrub.py` is identity-only (not a secret detector).

## Overview

Build a standalone OpenAI Codex harness extractor that reads `~/.codex/` and emits its own HTML profile plus a per-tool JSON island, mirroring the Claude extractor's structure and privacy posture **but grounded in Codex's real data shapes**. Phase 1 stops short of publishing or changing the insightharness.com schema — it de-risks the parser and the scrub against real data before any contract is committed (Phases 2/3 handle storage, the tool selector, and the agent payload).

## Problem Frame

`insight-harness` profiles one tool today. The product is shifting to a multi-agent profile where a consumer's Claude agent learns from an author's Claude slice and a consumer's Codex agent from the Codex slice — same-tool-to-same-tool (origin D1). Codex CLI writes local, parseable data to `~/.codex/`; this phase turns that into a profile. Only locally-visible Codex usage is captured (mobile/web/Cowork are server-side and invisible), which the artifact states plainly.

## Requirements Trace

- R1. Produce a standalone Codex profile (HTML) + a per-tool JSON island shaped `{tool: "codex", ...}`. Ship only `tool` as the committed envelope key; `schema_version`/`generated_at` are **provisional** and owned by Phase 2 (origin D1/D2; review: forward-contract is overstated while the Claude island + DB column are deferred).
- R2. Reuse the existing PII-scrub, skill-frontmatter parser, command-name normalizer, and showcase pipeline where the data shapes match; reimplement only the path-coupled / Codex-shaped parts. Emit Codex skills as **inventory only** — name, description, install pointer; no usage count (origin D3, D4).
- R3. **Token totals (corrected):** read `payload.info.total_token_usage.total_tokens` on records where `payload.type == "token_count"`. This value is **cumulative within a session** — take the last (max) value per session and **sum across sessions**; do NOT sum per-record (that inflates ~9×). Skip records where `payload.info` is `null` (rate-limit-only records). (origin D7; review ADV-1/ADV-3, feasibility.)
- R4. **Per-tool safety (corrected):** derive from the real `config.toml` keys — top-level `approvals_reviewer`, per-app `approval_mode` (nested under `[apps...tools.*]`), and per-project `trust_level`. Emit **enum values only**; never emit the `[projects."<absolute-path>"]` section keys (home-dir/project-name leaks) and **never read or emit the `[apps.connector_*]` section key** (the connector UUID — read only the `approval_mode` value beneath it, not the key). Rules: parse the `prefix_rule(pattern=[...])` DSL and emit `pattern[0]` (the binary) **only**; assert no path-like element (`/`, `~`, `/Users/`) ever reaches output. (origin D5; review ADV-4/ADV-5, SEC-2, SEC-6 re-review.)
- R5. **Positive read-allowlist (corrected from a deny-list):** the parser reads ONLY: `payload.type`, `timestamp`, `payload.info.total_token_usage`, the extracted inner command binary (R6), and whitelisted skill/plugin metadata. Every other field — including all content carriers — is never read. (review SEC-4/SEC-9.)
- R6. **Command extraction (corrected):** Codex `shell`/`exec` commands live in `function_call.arguments` as a JSON string whose `command` is a **list** like `["bash","-lc","<full cmd>"]`. Parse the JSON, strip the shell-runner wrapper (`bash`/`sh`/`zsh` + `-lc`/`-c`), then run the inner command string through `extract_safe_command_name` to get the first token. Never emit the full command. (review SEC-1.)
- R7. **Emit-time secret gate (two-tier, to avoid a footgun):** before writing the island or HTML, scan the serialized output. **(a) Known token prefixes** (`sk-`, `Bearer `, `AKIA`, `ghp_`) → **fail loud** (these are unambiguous). **(b) High-entropy heuristic** → **redact-the-offending-field-and-warn**, not abort, AND scope it to the post-allowlist _text_ fields only — explicitly exclude already-budgeted high-entropy content the plan intends to emit (hero-image data URIs from the showcase pipeline, skill IDs, and any hash/UUID values). This is defense-in-depth because `pii_scrub.py` is identity-only and the read-allowlist is otherwise the sole control. **Why two-tier:** a single fail-loud entropy gate would block a benign harness from ever generating a profile (false-positive on legitimate base64/hashes) or get its threshold loosened until it misses real tokens. (review SEC-3; SEC/ADV re-review both flagged the false-positive risk.)
- R8. **Identity scrubbing:** never emit `session_meta.git.repository_url`, `commit_hash`, `branch`, or `cwd`; never emit MCP/connector identities — normalize `mcp__<server>__<tool>` tool names to a generic bucket (don't reveal connected Gmail/Slack/etc. or connector UUIDs); derive any work-surface signal from path **shape** only. (review SEC-5/SEC-6/SEC-7.)
- R9. **Dual rollout format:** detect format per file (presence of the `payload` envelope). Count **every** session toward session/timespan totals; extract token/tool detail only from the current `payload`-envelope format; the honest-limit caveat states that detail is available for recent sessions only. (review ADV-2.)
- R10. **Plugins (corrected):** source the plugin inventory from `config.toml` `[plugins.*]` (name + enabled), not a `~/.codex/plugins` directory walk. (review ADV-6.)
- R11. **Island ⊆ rendered:** the JSON island must be a subset of fields the HTML renders (no hidden fields); the privacy test scans the **serialized island string**, not the parsed object. (review SEC-8; Phase-0 F1.)
- R12. Thin local data is shown with a "local CLI only" caveat + an activity floor (threshold chosen at Unit 5 from real session-count distributions) that hides a near-empty profile; the local-only limit is always stated. (origin D3.)
- R13. Codex desktop app: presence + recency only via the existing `detect_agent_tools` (already covers it); never parse Electron storage. (origin D6.)

## Scope Boundaries

- **No publish/upload, no `harnessData` schema change, no tool selector, no combined page** → Phase 2.
- **No cross-tool stats** (`_cross_tool`) → Phase 3.
- **No Electron storage parsing, no `~/.codex/*.sqlite` parsing, no Codex skill usage counts.**
- **No refactor of the working Claude `extract.py`** beyond importing already-pure helpers (`extract_skill_inventory` and `generate_html` are _reimplemented_ for Codex, not edited in place — see Key Decisions).
- **No `schema_version`/`generated_at` envelope commitment** (provisional only; Phase 2 owns the real cross-tool contract once it touches the Claude island + DB column).

## Context & Research

### Relevant Code and Patterns (insight-harness repo)

Reusable **as-is** (verified pure, no module-level side effects — import is safe): `pii_scrub.py` (`detect_pii`, `scrub`, `SanitizeError` — **identity-only, NOT a secret detector**), `parse_skill_frontmatter`, `build_skill_meta`, `derive_description_from_body`/`_skill_md_body`, showcase pipeline (`_read_raw_readme`, `_finalize_showcase`, `_read_hero_image`, `_truncate_to_bytes`, `_enforce_showcase_budget`), `extract_safe_command_name` (operates on a bash **string** — only valid after R6 unwrapping), `detect_agent_tools` (already includes Codex CLI + Codex desktop).

Reimplement (path/shape-coupled): `extract_skill_inventory` (Codex roots), `generate_html`/`generate_writeup` (Codex section set + Codex-appropriate prose — **Phase-0 F6: no hardcoded author-specific claims**).

Section map: **map** — Tool Usage, Tool Transitions, Workflow Phases, File Ops, CLI Commands (after R6 unwrapping), Tokens, Work Surfaces. **Inventory-only** — Skills. **Reshape** — Safety. **Skip** — Hooks, Agent Dispatch/Teams, Memory Architecture, Permission Accumulation, /insights tab.

### Institutional Learnings

`docs/solutions/` exists in neither repo. Load-bearing: origin brainstorm + `insightful/docs/brainstorms/phase0-results-2026-05-23.md` — F1 (island can hide leaks the HTML doesn't show → R11), F6 (no hardcoded author prose).

## Key Technical Decisions

- **Reuse via direct import, no shared-module refactor** (verified: helpers are pure, `extract.py` has no import side effects). Keeps the Claude pipeline untouched (Phase 1 low risk). `harness_common.py` extraction deferred (YAGNI).
- **Tokens are cumulative-per-session:** last-per-session, summed across sessions; correct path `payload.info.total_token_usage`; guard `null` info (R3).
- **Commands and rules are structured lists, not strings** — dedicated parsing (R4, R6); `extract_safe_command_name` only runs on the unwrapped inner command string.
- **`pii_scrub` is identity-only** — the positive read-allowlist (R5) is the primary control; the emit-time secret gate (R7) is the backstop.
- **Plugins from `config.toml`, safety from real config keys** (R10, R4).
- **Envelope: `tool` only**, rest provisional (R1).
- **Dual rollout format handled by detection + count-all / detail-from-current** (R9).

## Open Questions

### Resolved During Planning

- Standalone vs integrated? Standalone `codex_extract.py` (origin phasing; low risk).
- Refactor `extract.py`? No — import pure helpers; reimplement coupled parts.
- Publish in Phase 1? No — local generation only.
- Old-format sessions? Count toward totals; detail from current format only; caveat (R9).
- Output path? `~/.codex/usage-data/` (the 2026-04-09 prototype precedent; keeps Codex artifacts under the Codex root).
- Secret gate? Yes (R7). Envelope? `tool` only (R1).

### Deferred to Implementation

- The activity-floor threshold value (R12) — pick from real session-count distributions.
- Exact high-entropy threshold + prefix list for the secret gate (R7) — tune to minimize false positives without missing known token shapes.
- Whether any current-format token detail is recoverable from old-format sessions (likely none) — confirm during Unit 2.

## High-Level Technical Design

> _Directional guidance for review, not implementation specification._

```
~/.codex/                              reused (imported) helpers
  sessions/**/rollout-*.jsonl ──┐       pii_scrub.scrub (identity-only)
   (two formats: payload-env /  │       parse_skill_frontmatter / build_skill_meta
    flat legacy)                │       derive_description_from_body
  skills/*/SKILL.md ────────────┤       _finalize_showcase / _read_hero_image
  config.toml ([plugins.*],     │       extract_safe_command_name (on unwrapped cmd only)
   approvals_reviewer,          │       detect_agent_tools (desktop presence)
   approval_mode, trust_level) ─┤
  rules/*.rules                 │
   (prefix_rule(pattern=[...])) ┘
            │
            ▼  codex_extract.py
            │   - per-file format detect; count all sessions
            │   - positive read-allowlist; cumulative-per-session tokens
            │   - command-list unwrap → inner binary; rules pattern[0] only
            │   - identity/MCP scrubbing
            │
            ├── two-tier secret gate (prefix→fail-loud, entropy→redact+warn)  ◀── R7
            │
            ├── standalone HTML profile (honest-limit + thin-tool caveat)
            └── JSON island (⊆ rendered):  <script id="harness-data">
                  { "tool": "codex", "stats": {tokens...}, "toolUsage": {...},
                    "cliTools": {...}, "skillInventory": [{name,description,installPointer}],
                    "safety": { rulesAllowlist:[binaries], approvalsReviewer, approvalMode, trustLevels:[enums] },
                    "workflowData": {...}, "workSurfaces": {desktopPresence}, "localOnly": true }
```

## Implementation Units

- [ ] **Unit 1: Scaffold — paths, helper imports, fixtures, CLI skeleton**

**Goal:** Stand up `codex_extract.py` with `~/.codex` roots, reused-helper imports, a test fixtures directory, and an argparse skeleton emitting the output contract (final stdout line = report path, written to `~/.codex/usage-data/`).

**Requirements:** R2

**Dependencies:** None

**Files:**

- Create: `skills/insight-harness/scripts/codex_extract.py`
- Create: `skills/insight-harness/scripts/tests/fixtures/` (template rollout files — payload-format + legacy-format + null-info + secret-bearing — for Units 2/4)
- Test: `skills/insight-harness/scripts/test_codex_extract.py`

**Approach:** `CODEX_DIR = Path.home()/".codex"` + derived roots as module globals (patchable in tests, mirror `extract.py`). Import pure helpers; confirm no import side effects. argparse: `--include-skills`/`--no-include-skills`; output dir `~/.codex/usage-data/`.

**Patterns to follow:** `extract.py` constants + `main` output contract; `test_skill_description_fallback.py` global-patching.

**Test scenarios:**

- Happy path: CLI on a fixture `CODEX_DIR` writes HTML to `usage-data/` and prints its absolute path as the final line.
- Edge case: absent `~/.codex` → clean "no Codex data" exit, no crash.

**Verification:** Runs against tmp `CODEX_DIR`, produces a file + parseable final-line path.

- [ ] **Unit 2: Dual-format rollout parser + tokens + command extraction**

**Goal:** Parse rollout files (both formats), reading only the positive allowlist; count all sessions; compute cumulative-per-session token totals; tally CLI commands via the list-unwrap rule.

**Requirements:** R3, R5, R6, R9

**Dependencies:** Unit 1

**Files:** Modify `codex_extract.py`; Test `test_codex_extract.py`

**Approach:**

- Per file, detect format by presence of the `payload` envelope. Count every session toward session count + timespan regardless of format.
- Positive allowlist: read only `payload.type`, `timestamp`, `payload.info.total_token_usage`, command binary, whitelisted markers. Never read content carriers (`*_output.output`, `apply_patch.*`, `message.content`, `reasoning.*`, `agent_message.message`, `update_plan`, `spawn_agent.message`, `web_search_call.action`, `session_meta` instruction/nickname fields, etc.).
- Tokens: on `payload.type=="token_count"` with non-null `info`, read `info.total_token_usage.total_tokens`; keep the **max per session**; sum maxes across sessions.
- Commands: `json.loads(function_call.arguments)`, take `command` list, strip `bash/sh/zsh` + `-lc/-c` wrapper, run the inner string through `extract_safe_command_name`; emit first token only.

**Execution note:** Start with failing tests that (a) plant a cumulative token series and assert the total equals the per-session max summed (NOT the per-record sum), and (b) plant a `["bash","-lc","curl -H 'Authorization: Bearer sk-SECRET' ..."]` command and assert only `curl` is emitted and the token never appears.

**Patterns to follow:** `extract_safe_command_name`; `extract.py` session iteration.

**Test scenarios:**

- Happy path: cumulative series `28887,67874,107911` in one session → total = `107911` (max), not `204672` (sum).
- Edge case: `payload.info == null` record → skipped, no NoneType crash.
- Edge case: legacy-format file (no `payload`) → counted as a session/timespan, contributes no token detail.
- Error path (security): secret in a `["bash","-lc","..."]` command → only inner binary emitted; secret absent from output.
- Integration (privacy guard): monkeypatch `open`/parse to assert no content-carrier value is ever materialized.

**Verification:** Token total uses max-per-session; legacy sessions counted; privacy + secret guards pass.

- [ ] **Unit 3: Codex skill inventory + plugins from config**

**Goal:** Build inventory-only Codex skills (reuse frontmatter/showcase) and source plugins from `config.toml` `[plugins.*]`.

**Requirements:** R2, R10

**Dependencies:** Unit 1

**Files:** Modify `codex_extract.py`; Test `test_codex_extract.py`

**Approach:** Walk `~/.codex/skills/*/SKILL.md`; reuse `parse_skill_frontmatter`, `derive_description_from_body`, `_finalize_showcase`/`_read_hero_image` (owner-aware scrub). Emit `{name, description, installPointer}` with **no** `calls`. Honor `repo: private/none`. Plugins from `config.toml` `[plugins.*]` (name + enabled), not a dir walk.

**Patterns to follow:** `extract_skill_inventory` (reimplemented), `build_skill_meta`.

**Test scenarios:**

- Happy path: 3 fixture skills → listed with descriptions, no counts; plugins read from a fixture `config.toml` `[plugins.*]`.
- Edge case: blank frontmatter description → body-derived.
- Error path: `repo: private` skill excluded entirely.
- Integration (concrete pass/fail): a **third-party-owned** README whose `github.com/<upstream-owner>/...` URL differs from the local git identity → assert (1) the local user's identity is NOT injected in place of the upstream owner (no mis-attribution rewrite), and (2) the emitted README excerpt contains neither the local OS-username nor any `sk-`/`Bearer ` token. (SEC-10 re-review: criterion made concrete.)

**Verification:** Inventory has no counts; private excluded; plugins from config; third-party README handled.

- [ ] **Unit 4: Codex safety posture (real config keys + rules parser)**

**Goal:** Produce the per-tool "Safety & Automation" data from the real `config.toml` keys and the `prefix_rule(pattern=[...])` DSL, emitting enums + binaries only.

**Requirements:** R4, R8

**Dependencies:** Unit 1

**Files:** Modify `codex_extract.py`; Test `test_codex_extract.py`

**Approach:** Read `approvals_reviewer`, per-app `approval_mode`, per-project `trust_level` **values** (enums); never emit the `[projects."<path>"]` section keys. Parse rules with a dedicated `prefix_rule(pattern=[...])` parser; emit `pattern[0]` only; discard the rest.

**Execution note:** Start with a failing test planting a rule whose `pattern` embeds an absolute path to a credentials file (`/Users/.../com.vercel.cli/auth.json`) and a bearer token in a later element; assert neither the path nor the token appears.

**Test scenarios:**

- Happy path: fixture `config.toml` with `approvals_reviewer`/`approval_mode`/`trust_level` → enums surfaced; rules list shows binaries only.
- Error path (security/PII): rule `prefix_rule(pattern=["git","add","/Users/.../auth.json"])` → output contains `git` only; the path never appears.
- Edge case: no `rules/`, empty `config.toml` → "none configured", no crash; project-path section keys never emitted.

**Verification:** Enums-only safety; rules emit binaries only; no path/secret leak.

- [ ] **Unit 5: Profile assembly — HTML + tool-only JSON island**

**Goal:** Assemble the Codex HTML profile + `{tool:"codex", ...}` island from Units 2–4, including tokens, desktop presence, identity/MCP scrubbing, thin-tool caveat, honest-limit. Island ⊆ rendered.

**Requirements:** R1, R8, R11, R12, R13

**Dependencies:** Units 2, 3, 4

**Files:** Modify `codex_extract.py`; Test `test_codex_extract.py`

**Approach:** Render Codex sections (no Claude-only sections); Codex-appropriate prose (no hardcoded author claims, F6). Normalize `mcp__<server>__<tool>` to a generic bucket; never emit `repository_url`/`cwd`/`commit_hash`/`branch`. Reuse `detect_agent_tools` for desktop presence. Activity floor → "local CLI only" caveat; always render the local-only limit. Island carries only fields the HTML renders.

**Test scenarios:**

- Happy path: rich fixture → island parses, `tool=="codex"`, token total present, `skillInventory` has no `calls`.
- Edge case (thin tool): below-threshold session count → caveat present; not shown as a full profile.
- Integration: an `mcp__gmail__send` tool name → bucketed, not emitted verbatim; a planted `repository_url`/`cwd` → absent from island + HTML.
- Integration: island field set ⊆ rendered field set (assert no island-only fields).

**Verification:** Island ⊆ rendered; identity/MCP scrubbed; caveat + honest-limit present; no Claude-only sections; no author-hardcoded prose.

- [ ] **Unit 6: Secret-scan emit gate + real-data scrub validation gate**

**Goal:** Add the emit-time secret-scan backstop and run the load-bearing real-`~/.codex` scrub validation — the security gate before any Phase 2 work.

**Requirements:** R7

**Dependencies:** Unit 5

**Files:** Modify `codex_extract.py`; Test `test_codex_extract.py`

**Approach:** Two-tier gate (R7) over the **serialized** output. Tier (a): known prefixes (`sk-`, `Bearer `, `AKIA`, `ghp_`) → fail loud (raise + non-zero exit, no file written). Tier (b): high-entropy heuristic over post-allowlist text fields only, **excluding** hero-image data URIs, skill IDs, and hash/UUID values → redact the offending field + warn, do not abort. Then run against the real `~/.codex` and verify.

**Execution note:** This is the security gate — adversarial, not confirmatory.

**Test scenarios:**

- Happy path: clean output → gate passes, file written.
- Error path (tier a): planted `Bearer sk-...` in any assembled field → gate raises, no file written.
- Edge case (tier b, the footgun guard): a legitimate hero-image data URI + a long base64 skill ID present → run completes, file written, no false-positive abort.
- Edge case (tier b): a non-prefixed high-entropy secret in a text field → field redacted + warning emitted, run continues.
- Real-data gate: run on the real `~/.codex`; grep emitted HTML + island for the known bearer-token prefix → zero hits; confirm no `cwd`/`repository_url`/connector-UUID strings; confirm the token total is within a sane ratio of the true per-session-max sum (catches the ADV-1 inflation class); confirm legacy sessions are counted; **confirm the run was not falsely blocked.**

**Verification:** Gate blocks secret-bearing output; real-data run is clean and the headline number is sane.

- [ ] **Unit 7: SKILL.md wiring**

**Goal:** Document how to run `codex_extract.py` (background-Bash pattern, output contract, local-only limit, Phase-1-is-local-only).

**Requirements:** R1

**Dependencies:** Unit 6

**Files:** Modify `skills/insight-harness/SKILL.md`

**Test scenarios:** `Test expectation: none` — docs only. Verification is the full suite passing + the Unit 6 real-data gate.

**Verification:** Suite green; SKILL.md documents the Codex invocation accurately.

## System-Wide Impact

- **Interaction graph:** New standalone script; imports pure helpers; does not call/modify `extract.py`'s flow.
- **Error propagation:** Missing `~/.codex` subdirs / null token info / legacy-format files degrade gracefully (count-only / "none"), never abort.
- **API surface parity:** The `tool`-discriminated island is the seam Phase 2's `tools` map + agent payload inherit; `schema_version`/`generated_at` deferred to Phase 2 alongside the Claude-island retrofit.
- **Unchanged invariants:** Claude `extract.py` behavior, its `harness-data` shape, and the insightharness.com schema are untouched.

## Risks & Dependencies

| Risk                                                     | Mitigation                                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token inflation from summing a cumulative field (ADV-1)  | Max-per-session, sum across sessions; Unit 2 + Unit 6 ratio assertion.                                                                                               |
| Live secret leak to a public page (SEC-1/2/3, ADV-5)     | Positive read-allowlist + list/rules structured parsers (binary/`pattern[0]` only) + emit-time secret gate (R7) + serialized-island scan (R11); failing-first tests. |
| Silently dropping legacy-format Codex history (ADV-2)    | Per-file format detect; count all sessions; caveat detail is recent-only (R9).                                                                                       |
| Identity leak via repo URL / cwd / MCP names (SEC-5/6/7) | Never emit; MCP bucketed; work-surface from path shape only (R8).                                                                                                    |
| Wrong config keys → empty safety section (ADV-4)         | Use real keys (`approvals_reviewer`/`approval_mode`/`trust_level`); enums only (R4).                                                                                 |
| Island leaks fields HTML doesn't show (F1, SEC-8)        | Island ⊆ rendered; scan serialized island (R11).                                                                                                                     |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-25-codex-extractor-multiagent-requirements.md](docs/brainstorms/2026-05-25-codex-extractor-multiagent-requirements.md)
- Review corrections: document-review 2026-05-26 (coherence, feasibility, security-lens, scope-guardian, adversarial) — verified against the real `~/.codex` tree.
- Related findings: docs/brainstorms/phase0-results-2026-05-23.md (F1, F6)
- Pattern source (insight-harness repo): `skills/insight-harness/scripts/extract.py`, `pii_scrub.py`, `SKILL.md`; tests `test_skill_description_fallback.py`, `test_work_surfaces.py`
