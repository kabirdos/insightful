# Plan — B3: Auto-emit Signature Patterns (server-side derivation)

- **Date:** 2026-06-10
- **Status:** Ready to implement
- **Owner:** Craig
- **Brainstorm:** `docs/brainstorms/2026-06-04-share-how-you-work-generalization-requirements.md` (B3; D2 page spine)
- **Mockup:** `docs/mockups/show-how-you-work-profile.html` (Signature patterns section)

## Decision (owner, 2026-06-10)

**Server-side derivation.** A pure TS module derives 3–5 signature patterns from the already-persisted `harnessData` at render time. Chosen over skill-side emit because every input is already in `harnessData`, so this:

- lights up retroactively for **every existing published report** (no re-run/re-publish),
- makes **zero `harnessData` shape change** (honors the brainstorm's first-slice constraint),
- stays in **one repo** (insightful), ~one PR, with fast copy iteration.

Trade-off accepted: patterns aren't in the agent/learn-mode payload yet — a deliberate fast-follow (would duplicate derivation into `extract.py` for D1 parity).

## What ships

A new **Signature Patterns** section on the profile Dashboard tab, slotted right after `HeroStats` ("lead with the how", per D2 spine), wired into the existing hide/strip visibility pipeline like `workRhythm`.

## Pattern catalog (data-driven; emit only those that clear threshold; cap 5)

All derived from typed `HarnessData` fields. `autonomy` is the **lead** card (dark, `emphasis: "lead"`); the rest render in a 2-col grid. Order: autonomy → subagents → explore-first → dual-engine → authorship.

| id              | Source fields                                                                              | Threshold (else omit)                                        | Headline                                  | Proof line (▸ … · …)                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `autonomy`      | `autonomy.{label,userMessages,assistantMessages,errorRate}`, `permissionModes`             | `autonomy.label` non-empty AND `userMessages>0`              | `autonomy.label` (e.g. "Fire-and-Forget") | `1 : N human:agent turns` · `X sent · Y back` · `Z% bypassPermissions`\* · `E error rate` |
| `subagents`     | `agentDispatch.{totalAgents,backgroundPct,models,types}`                                   | `agentDispatch != null && totalAgents >= 5`                  | `Orchestrates N sub-agents`               | `N agents` · `B% background` · `sonnet x / opus y`\* · `top type: T (c)`                  |
| `explore-first` | `workflowData.phaseStats.{exploreBeforeImplPct,testBeforeShipPct,totalSessionsWithPhases}` | `totalSessionsWithPhases >= 5 && exploreBeforeImplPct >= 50` | `Explores before building — X%`           | `exploreBeforeImpl X%` · `testBeforeShip Y%` · `across N sessions`                        |
| `dual-engine`   | `cliTools.codex`, `gitPatterns.branchPrefixes.codex`                                       | `cliTools.codex > 0` (codex CLI invoked)                     | `Runs Claude + Codex`                     | `codex called N×` · `codex branch prefix M×`\*                                            |
| `authorship`    | `skillInventory[].{source,name}`                                                           | `>= 2` skills with `source` in {`custom`,`user`}             | `Builds the tools they use`               | `authored: a, b, c …` (cap 6 names)                                                       |

\* bracketed proof chips are conditional — only included when the underlying value is present/non-zero (reuses the no-silent-zero discipline from #29).

Characterization sentences (the one-liner under each headline) are short, fixed-per-pattern templates with the verified numbers interpolated; the explore-first card appends an honest-gap clause when `testBeforeShipPct < 20` (mirrors the mockup's "warts and all" copy). No prose essay (that's Bucket C).

## Files

**New**

- `src/lib/signature-patterns.ts` — `SignaturePattern` type + pure `deriveSignaturePatterns(harnessData: HarnessData | null): SignaturePattern[]`. No JSX, no I/O → trivially unit-testable.
- `src/components/SignaturePatterns.tsx` — presentational: lead card (dark gradient) for `emphasis: "lead"`, 2-col grid for the rest; each card = headline + "Verified" badge + characterization + mono proof line. Renders `null` when the derived list is empty.
- `src/lib/__tests__/signature-patterns.test.ts` — per-pattern threshold + proof-text assertions (omit-below-threshold, render-above, chip conditionality).
- `src/components/__tests__/SignaturePatterns.test.tsx` — `renderToStaticMarkup` smoke: empty → "", populated → headlines/badges present.

**Edit (visibility wiring — mirror `workRhythm` exactly, 3 sites)**

- `src/app/insights/[username]/[slug]/page.tsx` — render `<SignaturePatterns harnessData={claudeHarnessData} />` after `HeroStats`, gated on `!isSectionHidden(hiddenSet, "signaturePatterns")`.
- `src/app/insights/[username]/[slug]/edit/page.tsx` — add a toggle row keyed `"signaturePatterns"` (next to the `workRhythm` toggle ~L1021).
- `src/app/upload/page.tsx` — add the upload-time enable/disable toggle keyed `"signaturePatterns"` (next to `workRhythm` ~L2518).

## Invariants honored

- No `harnessData` JSON shape change (derived, not stored) — satisfies the CLAUDE.md `harnessData` invariant trivially.
- PII: derivation reads only already-scrubbed, already-persisted aggregate fields; emits no new raw strings (skill names in `authorship` are already public in `skillInventory`).
- Visibility: section is hideable/strippable via the same `hiddenHarnessSections` keying as every other section → authors can suppress it.

## Out of scope (fast-follows)

- Learn-mode/agent-payload parity (emit `signaturePatterns` from `extract.py`) — D1 follow-up.
- My Stack self-declared block (B6/D3) and per-card editable blurbs (D4).
- Cross-surface Claude+Codex unification (B5) — `dual-engine` here is single-surface ("uses Codex alongside Claude"), not the merged two-profile contrast.

## Test/verify

`npx vitest run` (new + full suite green), `npx tsc --noEmit`, `npm run lint`, then visual check that the section leads the Dashboard and hides when toggled off. CI (lint/typecheck/test/build) must pass before merge.
