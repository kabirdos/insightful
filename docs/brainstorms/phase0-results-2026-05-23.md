---
date: 2026-05-23
topic: agent-consumable-harness-report
phase: 0
relates-to: 2026-04-28-agent-consumable-harness-report-requirements.md
---

# Phase 0 — Reference Consumer Results

## Method

Ran the reference-consumer experiment **in-session** (Claude Code) rather than via
a separate API-billed script. For each report we fetched
`https://insightharness.com/api/insights/<user>/<slug>` (which already serves the
full `harnessData` JSON — no SSR work needed), stripped `hero_base64` image blobs,
and asked: _"Tell user B what they could learn or copy from this person's harness."_
Each output is judged strictly from the payload — no outside knowledge of the author.

Corpus (3 non-author + 1 self-check, per Success Criteria):

| Author                    | Slug            | skillVersion   | Notes                         |
| ------------------------- | --------------- | -------------- | ----------------------------- |
| savraj                    | 20260422-5ayf16 | 2.7.0          | Craig-selected                |
| torgbuiedunyenyo (Jeremy) | 20260421-7oyb1z | 2.7.0          | Craig-selected                |
| kazad (Kalid)             | 20260421-65b6uw | 2.3.0          | richest workflow data         |
| kabirdos (Craig)          | 20260420-njn2v1 | newer/showcase | self-check, criteria a+b only |

---

## Consumer Output

### savraj — PASS (a, b, c)

**Highest-value learnings for user B:**

1. **Adopt the brainstorm→plan loop.** `ce-brainstorm` is the single most-used skill
   (9×), feeding `ce-plan` (3×); `workflowPatterns` confirms the `ce-brainstorm → ce-plan`
   sequence. _Action:_ install the `compound-engineering` plugin and run `/ce-brainstorm`
   before `/ce-plan` on your next feature.
2. **`document-review` for plan/spec QA.** README shows it dispatches parallel persona
   agents (coherence, feasibility, security, scope) and supports a `mode:headless`.
   _Action:_ run it on a `docs/plans/*.md` before implementing.
3. **`browsermcp` for UI verification** — 68 MCP calls, the dominant integration.
   _Action:_ install browsermcp if you do frontend work.
4. **Model tiering** — sub-agents run haiku (14×)/sonnet (3×) for worker tasks.

**Blocked:** `peon.sh` fires on all 5 lifecycle events (1,119×) but the payload ships
only the filename — can't tell B what it does or give a config snippet.

### torgbuiedunyenyo (Jeremy) — PASS (a, b, c)

1. **The `humanizer` skill** (6×) strips AI-writing tells — README documents 25
   concrete patterns (em-dash overuse, rule-of-three, "it's not just X, it's Y").
   _Action:_ the technique is fully copyable from the README. **But the install URL in
   the README is a literal placeholder (`github.com/<your-username>/humanizer`) — B
   cannot actually fetch it.**
2. **`playwright` plugin + MCP** (52 browser calls) for automated UI testing. _Action:_
   install from `claude-plugins-official`.
3. **`diataxis` plugin** (tribe-skills) for structured docs.
4. **31% of sub-agents run in background** — heavier parallel dispatch than savraj.

**Data bugs visible:** `durationHours: 0`, `avgSessionMinutes: 0`, `commitCount: 0`;
the writeup prose says "averaging about 0 minutes each."

### kazad (Kalid) — PASS (a, c; b partial)

1. **`ic-bugfix` is the most-used custom skill (16×)** — and the payload gives **no
   description and no README.** The single highest-signal item is opaque: B learns it
   exists but nothing about what it does or where to get it.
2. **`iterative-engineering` plugin** (tmc-marketplace) — many of its skills used
   (research, brainstorming, design-exploration, code-review). _Action:_ installable by name.
3. **`screenshot` skill** uses `shot-scraper` + `llm-toolbox` for visual UI checks.
   _Action:_ technique nameable; no install pointer.
4. **Disabled plugins as negative signal** — superpowers, ralph-wiggum, hookify, hzl-skills
   were "tried and turned off." Useful "don't bother" signal.
5. **`chrome-devtools` MCP used 1,605×** + 79% explore-before-implement discipline.

### kabirdos (Craig, self-check) — PASS (a, b)

1. **`research-orchestrator → html-report` pipeline** (4×): fan-out research, render an
   HTML report. Both skills have READMEs. _Action:_ copyable.
2. **`writing-plans → subagent-driven-development`** (7×, the top pattern): plan, then
   one sub-agent per task. _Action:_ superpowers plugin.
3. **`qa-checklist → manual-qa-collab`** (3×): generate a QA checklist, then walk it via
   Playwright.
4. **9 hooks with descriptive script names** (`dcg`, `validate_file_write.py`,
   `format_and_lint.py`, `auto_approve.py`, `save_session.py`) — purpose inferable from
   names, unlike savraj's `peon.sh` / Jeremy's `node`.
5. **61% background sub-agents** (803 total) — the strongest parallel-dispatch signal
   in the corpus.

**Success Criteria met:** 3 of 3 non-author reports pass concreteness + actionability +
forward-test. (Required: ≥3 of 5.)

---

## Findings — what shapes Phase 1

The "passes" are carried by **plugin skills** and **workflow patterns**, which are
identified consistently. The **custom skills** — the genuinely unique, most interesting
part of a harness — are exactly where the data fails. The most valuable quadrant is the
weakest.

**F1 — Image blobs must be excluded.** `hero_base64` is ~400 KB/skill (Kabir's payload
was 1.35 MB, 96% images). Useless to a consumer; would wreck its context. Agent payload
must drop it. (Brainstorm didn't call this out.)

**F2 — Schema is inconsistent across reports.** Per-skill fields vary by `skillVersion`
(2.3.0 vs 2.7.0 vs showcase). Some skills carry `readme_markdown` + `category`; others
just `name/calls/source/description`. A consumer **cannot assume any descriptive text
exists.** → Phase 1 needs a `schema_version` gate (brainstorm R2) AND a minimum
guaranteed field set, or the consumer degrades unpredictably per report.

**F3 — Descriptions are routinely empty or garbage.** Plugin skills almost always have
`description: ""`. Jeremy's humanizer had `description: "|"` (YAML parse artifact). The
most-used custom skills (`ic-bugfix`, `ce-brainstorm`) frequently have neither
description nor README. **The highest-`calls` items are the most opaque.**

> **Root cause confirmed (2026-05-23).** For _plugin_ skills this is a merge bug, not
> missing data. `extract.py:470` parses plugin-skill frontmatter from the local plugin
> cache, so descriptions exist on disk. But the inventory lookup is keyed by the bare
> frontmatter name (`skill_meta[s["name"]]` → `"ce-brainstorm"`, `extract.py:2117`) while
> runtime invocations are recorded namespaced (`"compound-engineering:ce-brainstorm"`).
> The lookup misses (`extract.py:2127`), leaving `description=""` and falling through to
> the "infer source from name" branch — which is why `ce-brainstorm` is mis-tagged
> `custom`. **Fixing this one key mismatch recovers descriptions for every plugin skill
> across every report, with no new data source.** Genuinely custom skills (`source:
custom/user`, e.g. `ic-bugfix`) are the exception: their description must come from the
> user's own SKILL.md frontmatter, and if it's blank there's nothing to recover.

**F4 — No reliable install pointer (brainstorm R4 is the critical gap).** `source` takes
5+ shapes: `custom`, `user`, `command`, bare `plugin`, and occasionally
`plugin:owner/repo`. README install instructions, when present, contain placeholders
(`<your-username>`). "Where do I get this skill?" — the #1 thing B needs for diff-shaped
advice — is **frequently unanswerable.**

> **Partly the same root cause as F3.** The correct `plugin:owner/repo` _is_ derivable
> at parse time (`extract.py:475`); it's lost in the same bare-name merge mismatch that
> mis-tags `ce-brainstorm` as `custom`. Fix the merge and plugin skills gain a correct
> source **and** an install pointer for free. The residual R4 gap is real only for
> genuinely custom skills (no public install location exists) — there the honest answer
> is to mark them "private/custom, not shareable" rather than fabricate a pointer.

**F5 — Hooks are opaque (affects R5).** `hookDefinitions` ships event + matcher + script
_filename_ only — no body. Descriptive names (`dcg`, `validate_file_write.py`) let a
consumer guess; opaque ones (`peon.sh`, `node`, `rtk-rewrite.sh`) reveal nothing. R5
wants the hook "command"; the data has a filename. B can never get a copyable hook
config from the current payload.

**F6 — `writeupSections` are templated from the author's own harness.** Every report's
"Hooks & Safety" section claims _"destructive command guarding + file write validation +
auto-formatting… these four hooks"_ regardless of reality (Jeremy: 3 generic `node`
hooks; Kalid: 1 `rtk-rewrite.sh` hook). **A consumer that trusts `writeupSections` will
propagate hallucinations.**

> **Root cause confirmed (2026-05-23).** Not random lying — the template is frozen from
> the insight-harness author's own setup. `extract.py:1779` hardcodes a dictionary mapping
> the author's five hook scripts (`dcg`, `validate_file_write.py`, `format_and_lint.py`,
> `auto_approve.py`, `save_session.py`) to descriptions, and `extract.py:1796` appends a
> static sentence ("…these four hooks…") to every report with ≥1 hook. On the author's own
> report it's accurate; on Kalid's it co-occurs with the computed "1 hooks configured
> across 1 lifecycle events," so the hardcoded "four" directly contradicts the data on the
> same page. Fix: gate `1796` on actually-detected hook capabilities, and derive per-hook
> descriptions from each script (or omit the claim for unrecognized scripts) rather than
> matching against a hardcoded author-specific allowlist.

→ Phase 1 must either (a) mark `writeupSections` as non-authoritative narrative and
require the consumer to derive all claims from structured fields, or (b) fix the templating
to be data-grounded. Given prompt-injection-as-data (brainstorm threat row 3), (a) is
safer — but (b) is cheap and independently worth doing because the false prose is a
credibility landmine for the public-author outreach audience.

**F7 — Broken stats propagate silently.** Jeremy `durationHours/avgSessionMinutes/
commitCount = 0`; Kalid `perModelTokens = null`. The consumer (and the writeup) should
suppress zero/null stats rather than assert "0 minutes."

**F8 — Skill double-counting.** Same skill appears under multiple keys (`frontend-design`
vs `frontend-design:frontend-design`; `systematic-debugging` twice with different
`source`). Counts may double-attribute; dedup needed before publishing.

### The pattern-vs-diff question (brainstorm Outstanding Question, resolved)

The brainstorm asked whether B's prompts are **pattern-shaped** ("what's their daily
flow?") or **diff-shaped** ("what do they have that I don't?"), and said to optimize the
schema for whichever wins. Phase 0 answer:

- **Pattern-shaped advice is well-supported today.** `workflowPatterns` + `skillInvocations`
  - tool/file-op stats consistently yield concrete, forwardable workflow descriptions.
- **Diff-shaped advice is blocked** by F4 (no install pointers) and F5 (no hook bodies).
  We can tell B "you don't have `ic-bugfix`" but not "what it does" or "how to install it."

**Recommendation for Phase 1:** if diff-shaped peer-learning is the product bet, the
single highest-leverage upstream change is **F4 (structured install pointers in
`extract.py`)**, followed by F3 (guarantee a description per skill) and F5 (hook bodies,
scrubbed). If we instead lean into pattern-shaped advice, Phase 1 is mostly about
exposing the already-good `workflowPatterns`/`skillInvocations` and fixing F6/F7 so the
narrative doesn't lie.

---

## Next step

→ `/ce:plan` for Phase 1, anchored on the F4/F3/F5 upstream gaps (extract.py) and the
F6 writeup-trust decision. The brainstorm's deferred questions Q3 (SSR vs route handler)
and Q4 (two-id transition) remain — but Phase 0 shows the **data-shape work upstream of
the renderer is the bigger lift than the renderer change itself.**
