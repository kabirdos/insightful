---
title: "feat: Codex direct --publish (port publish flags to codex_extract.py)"
type: feat
status: completed
date: 2026-06-02
deepened: 2026-06-02
target_repo: insight-harness
review: "Codex CLI reviewed plan + diff 2026-06-02..04 — SHIP-WITH-FIXES (fixes applied)"
outcome: "U1–U6 shipped in insight-harness PR #28 (codex_extract 0.2.0); U7 deferred"
---

# feat: Codex Direct `--publish`

**Target repo:** `insight-harness`. All repo-relative paths below are relative to
that repo **except** the one server-side test in U7, explicitly prefixed
`insightful:`.

> **Outcome (2026-06-04):** U1, U2, U4, U5, U6 shipped in `insight-harness` PR #28
> (`feat(codex): direct --publish`, `codex_extract` 0.2.0); reviewed by Codex CLI at
> both plan and diff stages. **U7 deferred** — its literal form (unmocked
> `publishReport` in `route.test.ts`) is infeasible because the upload-route tests
> mock both Prisma and `publishReport` (no test DB), and the existing route test
> already covers the Codex parse→handoff. Revisit as a standalone `publish-report.ts`
> unit test + manual prod QA.

---

## Summary

Give `codex_extract.py` the same `--publish` / `--token` / `--confirm` flags that
`extract.py` already has, POSTing the generated Codex HTML to
`https://insightharness.com/api/upload` via the existing bearer-auth direct-POST
path. Today Codex is local-generation-only; publishing requires a manual upload at
`/upload`.

This is the small remaining slice of the multi-tool work. Phase 1 (insight-harness
#23) deliberately shipped Codex as local-only and deferred publish. The Phase 2
server work has since landed (multi-tool profiles, insightful #148; agent payload,
#151/#152), so **the server already accepts a Codex-only report** — the only gap is
the missing client flags. The publish helpers in `extract.py` were written
path-injectable and test-first, so this is an import-and-wire job, not a
re-implementation.

---

## Problem Frame

- **Who:** Codex CLI users who want to publish their harness profile to
  insightharness.com, and the agent driving the `insight-harness` skill on their
  behalf.
- **Pain today:** The Claude extractor publishes in one command (`--publish`); the
  Codex extractor stops at a local HTML file and forces a manual browser upload at
  `/upload`. The asymmetry is purely client-side plumbing.
- **Why now:** The server-side multi-tool support that a Codex publish depends on is
  already live and verified (see "Server round-trip is already supported").
- **Definition of done:** `python3 ~/.codex/skills/insight-harness/scripts/codex_extract.py --publish`
  uploads the Codex report and prints a `RESULT: <edit-url>`, with the same
  failure/output contract as the Claude path, and zero server changes.

---

## Server round-trip is already supported (no server change)

Traced in `insightful` and confirmed by the Codex CLI review (2026-06-02):

1. `handleBearer` (`insightful: src/app/api/upload/route.ts`) accepts
   `application/octet-stream` or `text/html`, authenticates by `ih_` token, and runs
   `parseUploadHtml(html)`.
2. `isHarnessReport(html)` returns **true** for a Codex report because the extractor
   emits `<script id="harness-data" type="application/json">`
   (`insightful: src/lib/harness-parser.ts:10`).
3. `parseHarnessHtml` + `getCodexHarnessData` populate Codex stats; the
   `codexHarnessData` branch (`route.ts:260`) derives `sessionCount` from the Codex
   slice.
4. `publishReport` stores normalized Codex `harnessData` + `reportType`
   (`insightful: src/lib/publish-report.ts:153,219`); the edit preview derives
   Codex-only data without Claude (`edit/page.tsx:97,1454`); the public view renders
   `CodexHarnessDashboard` when selected (`page.tsx:319,405`).

> **Correction carried from review (must not be mis-stated in tests):** the gate that
> keeps junk out of _harness_ uploads is **not** `hasParsedContent` — that runs only
> on the non-harness branch (`route.ts:293`). For harness uploads the real gate is
> `parseHarnessHtml` + `normalizeCodexHarnessData` (`harness-parser.ts:24`,
> `insights.ts:684,585`), which require only `tool:"codex"` + a `stats` object — NOT
> positive sessions/tokens. A malformed `{"tool":"codex","stats":{}}` could persist
> as a thin draft. Real `codex_extract.py` output always has positive stats, so this
> is not a product blocker, but U7 proves the round-trip with a real fixture rather
> than relying on the empty-report check.

---

## Requirements

| ID  | Requirement                                                                                                                                                                                                                         | Advanced by |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| R1  | `--publish` (opt-in) uploads the generated Codex HTML to `/api/upload` via bearer token and emits the result contract. Absent `--publish`, behavior is unchanged (local-only).                                                      | U1, U4      |
| R2  | `--token=ih_…` persists a validated token to a Codex-local config at `~/.codex/insight-harness/config.json` (mode 0600). `--token` alone (no `--publish`) is fast/foreground and must work even when `~/.codex` does not yet exist. | U2, U4      |
| R3  | `--confirm` adds an interactive `[y/N]` gate; in a non-TTY it short-circuits, saves locally, prints `LOCAL: <path>`, and exits **0** (no POST).                                                                                     | U4          |
| R4  | Output contract: the final stdout line is one of bare path (no publish) / `RESULT: <url>` (ok) / `LOCAL: <path>` (saved locally). Success is determined by the line prefix, never by exit code.                                     | U4, U6      |
| R5  | **Self-contained token (security):** Codex only ever reads/writes its own config path; it never falls back to the Claude token path.                                                                                                | U2, U4      |
| R6  | No server change. A real Codex-only report round-trips through the bearer path and renders as a Codex profile.                                                                                                                      | U7          |
| R7  | Reuse `extract.py`'s publish helpers via direct import — no duplication, no shared-module refactor.                                                                                                                                 | U2          |
| R8  | Docs + version reflect the new capability.                                                                                                                                                                                          | U5          |

---

## Key Technical Decisions

### KTD-1 — Direct-import the publish helpers (R7)

`codex_extract.py` already imports from `extract.py` (`codex_extract.py:45`), and
`extract.py` has no import-time side effects (pure module-level constants/regexes).
Every publish helper accepts injected paths (`save_token_to_config(token,
config_path=None)` `extract.py:3288`; `load_token_from_config(config_path=None)`
`:3343`; `publish_report(html_bytes, token, confirm=False, report_path=None,
opener=None)` `:3554`). So the Codex port supplies Codex-namespaced defaults via the
existing parameters and never touches `extract.py`'s `~/.claude` constants. Codex
review confirmed no circular-import or side-effect risk (NIT 7). A future
`harness_common.py` extraction stays deferred (YAGNI, per Phase 1 decision).

### KTD-2 — Strictly self-contained token (R5)

Codex reads/writes only `~/.codex/insight-harness/config.json`; **no** fallback to
`~/.claude/insight-harness/config.json`. Rationale (Codex review #4): the server
publishes under whatever account the bearer token belongs to and the returned
`editUrl` carries that username (`route.ts:405,416,640`); a silent cross-namespace
fallback could publish a Codex report under the "Claude" account for a user with
multiple tokens. Self-contained removes the footgun and drops the resolution helper.
Cost: a user already authed via the Claude skill pastes the token once for Codex —
accepted by the product owner 2026-06-02.

### KTD-3 — Token handling runs before the no-`~/.codex` early return (R2)

`codex_extract.main()` currently `return 0`s before generation when `CODEX_DIR` is
absent (`codex_extract.py:1683`). Token persistence does not require `~/.codex` to
exist, so the `--token` / `--publish` token-resolution block must be inserted
**above** that early return (Codex review #5). Otherwise `--token` alone silently
no-ops on a fresh Codex machine, contradicting R2.

### KTD-4 — Local-save-on-failure points at a Codex path (R4)

`main()` writes the dated report under `~/.codex/usage-data/<date>-codex-harness.html`
before any publish. On publish failure, pass
`report_path = ~/.codex/usage-data/report.html` (a stable copy mirroring
`extract.py`'s `report.html`) so `_save_html_locally` writes inside the Codex
namespace and the "saved at" message is truthful.

### KTD-5 — `rc == 0` does not imply publish success (R4)

`publish_report(confirm=True)` in a non-TTY saves locally, prints `LOCAL:`, and
returns **0** (`extract.py:3560`). The contract is therefore: consumers parse the
final stdout-line prefix; they never infer success from the exit code. SKILL.md's
generic "Output contract" section already states this and applies to Codex unchanged.

---

## High-Level Technical Design — `main()` dispatch

The only non-trivial shape is the dispatch ordering in `main()`. Directional (the
implementer owns exact structure); the load-bearing constraint is that token work
precedes the no-`~/.codex` early return (KTD-3).

```mermaid
flowchart TD
    A[parse args] --> B{--token set?}
    B -- yes --> C[save_token_to_config\nconfig_path=CODEX_PUBLISH_CONFIG_PATH]
    C --> D{--publish set?}
    B -- no --> D
    D -- yes, token just saved --> H[resolve token = saved]
    D -- yes, no --token --> E[load_token_from_config\nCODEX path only]
    E --> F{token found?}
    F -- no --> G[stderr: get a token; exit 2]
    F -- yes --> H
    D -- no --> I{CODEX_DIR exists?}
    H --> I
    B -- "no, token-only path done" --> Z0([exit 0])
    I -- no --> Z0b([stderr: no Codex data; exit 0])
    I -- yes --> J[generate_profile → write dated HTML]
    J --> K{--publish?}
    K -- no --> L[print bare path; exit 0]
    K -- yes --> M[publish_report\nreport_path=CODEX_PUBLISH_REPORT_PATH]
    M --> N[RESULT: / LOCAL: printed by helper]
    N --> O([exit rc])
```

Note: the `--token`-only-and-done branch (`B → C → exit 0` when `--publish` is unset)
must resolve **before** the `CODEX_DIR` check — that is the KTD-3 ordering. The
diagram collapses it for readability; the implementer threads it so a token-only run
on a machine with no `~/.codex` still persists and exits 0.

---

## Implementation Units

### U1. Add `--publish` / `--token` / `--confirm` to the arg parser

**Goal:** Expose the three flags; correct the now-stale description.
**Requirements:** R1, R2, R3.
**Dependencies:** none.
**Files:** `skills/insight-harness/scripts/codex_extract.py` (`build_arg_parser`,
`:714`).
**Approach:** Add `--publish` (`store_true`), `--token` (`str`, default `None`),
`--confirm` (`store_true`), mirroring `extract.py`'s `build_arg_parser`. Drop
"Phase 1: local generation only, no publish" from the parser description and the
docstring at `:718,724`.
**Patterns to follow:** `extract.py:build_arg_parser` flag definitions.
**Test scenarios:**

- Parsing `--publish --token=ih_… --confirm` yields the three attrs set; defaults
  (no flags) yield `publish=False`, `token=None`, `confirm=False`.
- `--no-include-skills` still flips `include_skills` (no regression).
  **Verification:** `parse_args` exposes the flags; existing arg-parser tests pass.

### U2. Import publish helpers + define Codex path constants

**Goal:** Make the reused helpers available with Codex-namespaced defaults.
**Requirements:** R5, R7.
**Dependencies:** none.
**Files:** `skills/insight-harness/scripts/codex_extract.py` (import block `:45`;
constants near `CODEX_USAGE_DATA_DIR` `:69`).
**Approach:** Extend the existing `from extract import (...)` with `is_valid_token,
publish_base_url, save_token_to_config, load_token_from_config, copy_to_clipboard,
_save_html_locally, post_report, handle_publish_response, _decode_error_message,
publish_report, TOKEN_RE`. Define `CODEX_PUBLISH_CONFIG_PATH =
CODEX_DIR / "insight-harness" / "config.json"` and `CODEX_PUBLISH_REPORT_PATH =
CODEX_USAGE_DATA_DIR / "report.html"` as module globals (so tests can
`patch.object`). **No** `resolve_codex_token` helper — self-contained means a direct
`load_token_from_config(config_path=CODEX_PUBLISH_CONFIG_PATH)` call (KTD-2).
**Patterns to follow:** existing `from extract import (...)` block; the
`CODEX_DIR`-derived module-global convention (`codex_extract.py:60-72`).
**Test scenarios:** `Test expectation: none` — pure import/constant wiring; behavior
is covered by U4/U5 tests. (Sanity: importing `codex_extract` does not raise and the
two new constants resolve under `CODEX_DIR`.)
**Verification:** module imports cleanly; constants derive from `CODEX_DIR`.

### U3. (removed)

Self-contained token (KTD-2) needs no resolution helper; folded into U4's direct
`load_token_from_config(config_path=…)` call. U-ID retired to preserve numbering.

### U4. Wire publish dispatch into `main()`

**Goal:** Token persistence + publish flow with correct ordering and exit handling.
**Requirements:** R1, R2, R3, R4, R5.
**Dependencies:** U1, U2.
**Files:** `skills/insight-harness/scripts/codex_extract.py` (`main`, `:1670`).
**Approach:** Insert, **above** the `if not CODEX_DIR.exists(): return 0` early
return (KTD-3):

- `--token` without `--publish` → `save_token_to_config(args.token,
config_path=CODEX_PUBLISH_CONFIG_PATH)`; on `ValueError` print message + `return 2`;
  else print "saved" to stderr + `return 0`.
- `--publish` → if `--token` given, save it (same validation) and use it; else
  `token = load_token_from_config(config_path=CODEX_PUBLISH_CONFIG_PATH)` and, if
  `None`, print the "get a token" message + `return 2`. **Never** read the Claude
  path (KTD-2).
  Then keep the existing no-`~/.codex` return and generation. After the dated HTML is
  written, if `args.publish`: read the bytes back and
  `return publish_report(html_bytes, token, confirm=args.confirm,
report_path=CODEX_PUBLISH_REPORT_PATH)`. The existing `SecretLeakError → return 2`
  path is unaffected (it raises before any write; Codex review #6).
  **Patterns to follow:** `extract.py:main` dispatch (`:3677-3922`) — the token-only
  branch, the publish-token resolution, and the post-write `publish_report` call.
  **Test scenarios:**
- `--token=<valid>` alone → persists to `CODEX_PUBLISH_CONFIG_PATH` (0600), exits 0,
  no HTML generated.
- `--token=<malformed>` alone → exits 2, nothing written.
- **(ordering, KTD-3)** `--token=<valid>` alone with `CODEX_DIR` absent → still
  persists and exits 0 (does NOT hit the no-Codex early return).
- `--publish` with a saved Codex token → calls `publish_report` with
  `report_path=CODEX_PUBLISH_REPORT_PATH`; final line is `RESULT:` (200 via injected
  `opener`).
- **(self-contained, KTD-2)** `--publish` with NO Codex token but a Claude token
  present at the Claude path → exits 2 and does NOT read/use the Claude token.
  (Assert the Claude path is never opened — e.g., point `load_token_from_config` at
  the Codex path only and verify the 2-exit.)
- `--publish --confirm` in a non-TTY → no POST, prints `LOCAL:`, exits **0** (KTD-5).
- No `--publish` → unchanged bare-path final line; exit 0.
  **Verification:** all five branches behave per the dispatch diagram; secret-gate path
  still exits 2 without writing.

### U5. Update SKILL.md + bump version

**Goal:** Docs match the new capability.
**Requirements:** R8.
**Dependencies:** U4.
**Files:** `skills/insight-harness/SKILL.md` ("Codex publishing" section, ~`:197-202`;
"Codex profile" invocation block); `skills/insight-harness/scripts/codex_extract.py`
(`VERSION`, `:73`).
**Approach:** Replace the "Direct `--publish` is currently Claude-only … upload
manually" paragraph with the `--publish` / `--token` invocation (same background-Bash
pattern as the Claude path; note the self-contained token and that `--token` alone is
foreground-fast). Confirm the generic "Output contract" section already covers the
three Codex final-line shapes (it does — no rewrite needed). Bump `codex_extract`
`VERSION` from `0.1.0`.
**Patterns to follow:** the "Direct publish (`--publish`)" section for the Claude
extractor in SKILL.md.
**Test scenarios:** `Test expectation: none` — docs/version only.
**Verification:** SKILL.md no longer claims Codex is upload-only; version bumped.

### U6. Codex publish unit tests

**Goal:** Lock the client behavior with fast, network-free tests.
**Requirements:** R1, R2, R3, R4, R5.
**Dependencies:** U4.
**Files:** `skills/insight-harness/scripts/test_codex_publish.py` (new).
**Approach:** Mirror `test_publish.py`'s structure — `sys.path.insert` + `import
codex_extract`, the `_fake_response` opener, and `patch.object` on
`CODEX_PUBLISH_CONFIG_PATH` / `CODEX_PUBLISH_REPORT_PATH` against a `TemporaryDirectory`
(same idiom as `test_codex_extract.py:_patch_codex_dir`). Inject `opener` into the
`main`/`publish_report` path to exercise 200/401/429/5xx/network without real I/O.
**Patterns to follow:** `test_publish.py` (`_fake_response`, the
`Token/Save/Load/Response/Confirm` test classes); `test_codex_extract.py`
`patch.object` pattern.
**Test scenarios:**

- `--token`-only persists to the Codex path with 0600 and exits 0; works with
  `CODEX_DIR` absent (KTD-3).
- `--publish` 200 → `RESULT:` line; clipboard copy attempted; exit 0.
- `--publish` 401/429/5xx/network → `LOCAL:` line under `CODEX_PUBLISH_REPORT_PATH`,
  exit 2.
- `--publish --confirm` non-TTY → `LOCAL:`, exit 0, no POST (KTD-5).
- `--publish` with no Codex token (Claude token present elsewhere) → exit 2, Claude
  path never read (KTD-2).
  **Verification:** `python3 -m pytest test_codex_publish.py` green; no network calls.

### U7. Server round-trip integration test + prod QA

**Goal:** Prove R6 — a real Codex-only report persists and renders, without mocking
the persistence layer.
**Requirements:** R6.
**Dependencies:** U4 (so a real `--publish` artifact exists for QA).
**Files:** `insightful: src/app/api/upload/__tests__/route.test.ts` (extend).
**Approach:** The existing bearer Codex test **mocks `publishReport`**
(`insightful: route.test.ts:591`), so it doesn't prove the round-trip. Add a bearer
test that POSTs a real `codex_extract.py`-shaped Codex HTML fixture (positive stats,
`<script id="harness-data">{tool:"codex",…}`) **without** mocking `publishReport`,
asserting the stored `reportType` and normalized `harnessData.tool === "codex"` and a
non-empty `editUrl`. Then one manual prod round-trip: run `--publish` against prod,
confirm the `RESULT:` URL renders `CodexHarnessDashboard`.
**Execution note:** Start from the unmocked-`publishReport` assertion — it is the gap
the mocked test leaves open.
**Test scenarios:**

- Real Codex fixture (positive stats) → 200, persisted `reportType` = harness,
  `harnessData.tool === "codex"`, `editUrl` non-empty.
- (Optional negative) `{"tool":"codex","stats":{}}` → documents current thin-draft
  behavior (review #2); assert-and-annotate, do not "fix" server-side here.
  **Verification:** integration test green; manual prod `RESULT:` URL renders a Codex
  profile.

---

## Scope Boundaries

**In scope:** one atomic PR in `insight-harness` — the three client flags, `main()`
dispatch, Codex-local token config, unit tests, SKILL.md + version. One integration
test added in `insightful` (U7) to close the round-trip proof gap.

**Non-goals (this product's identity):**

- No cross-tool / combined-page work, no `_cross_tool` block, no `schema_version`
  envelope commitment (those are the deferred Phase 3 contract).

### Deferred to Follow-Up Work

- **`stats.timespan` data loss (review #8, NIT):** `codex_extract.py:842` emits
  `stats.timespan`, but `normalizeCodexHarnessData` (`insightful: insights.ts:590`)
  drops it and `CodexHarnessDashboard.tsx:124` doesn't render it. Server-side +
  dashboard change; out of scope for this client PR.
- **Thin-draft hardening (review #2):** if we want the server to reject
  `{"tool":"codex","stats":{}}`, that's a `normalizeCodexHarnessData` change — a
  separate server PR, not gated on this work.

---

## Risks & Dependencies

| ID  | Risk                                                            | Mitigation                                                                                                    |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| R-1 | Token namespace footgun (publish under wrong account).          | RESOLVED by KTD-2: self-contained, never reads the Claude token.                                              |
| R-2 | Direct-import coupling to more of `extract.py`'s surface.       | Established pattern; `extract.py` pure at import (Codex review NIT 7).                                        |
| R-3 | "No server change" assumption wrong.                            | Traced in code + Codex review; U7 proves it with an unmocked integration test before merge.                   |
| R-4 | Background-Bash makes `--confirm` non-TTY → `LOCAL:` with rc 0. | Documented: `--publish` without `--confirm` is the agent-driven path; consumers parse the final line (KTD-5). |
| R-5 | Ordering regression: `--token` no-ops on fresh `~/.codex`.      | KTD-3 + explicit U4/U6 ordering test.                                                                         |

---

## Sources & Research

- **Codex CLI plan review (2026-06-02):** SHIP-WITH-FIXES; verdict + findings folded
  into KTD-2/3/5, U7, and the Deferred section. Validated the full render chain
  (`publish-report.ts`, `edit/page.tsx`, `page.tsx`, `insights.ts`) and the
  direct-import approach.
- **Local code read:** `extract.py` Direct-Publish block (`:3260-3585`, `main` `:3673`);
  `codex_extract.py` (`build_arg_parser` `:714`, `main` `:1670`, imports `:45`);
  `test_publish.py`, `test_codex_extract.py` (test idioms).
- **Server:** `insightful: src/app/api/upload/route.ts`, `src/lib/harness-parser.ts`,
  `src/lib/publish-report.ts`, `src/types/insights.ts`.
- **Prior phase docs:** `insightful: docs/brainstorms/2026-05-25-codex-extractor-multiagent-requirements.md`,
  `docs/plans/2026-05-25-001-feat-codex-extractor-phase1-plan.md` (Phase 1 deferred
  publish; this plan is the deferred slice).
