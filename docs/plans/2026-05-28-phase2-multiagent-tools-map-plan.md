---
title: "feat: Phase 2 multi-agent tools map + tool selector"
type: feat
status: in_progress
date: 2026-05-28
origin: docs/brainstorms/2026-05-25-codex-extractor-multiagent-requirements.md
---

# feat: Phase 2 Multi-Agent Tools Map + Tool Selector

## Overview

Phase 1 shipped a standalone Codex extractor in `insight-harness`. Phase 2 brings that output into `insightful` without migrating the database: `InsightReport.harnessData` remains a JSON column, but the app learns a backward-compatible envelope shape:

```json
{
  "tools": {
    "claude-code": { "...legacy HarnessData..." },
    "codex": { "tool": "codex", "...Codex island fields..." }
  },
  "primaryTool": "claude-code"
}
```

Existing rows remain valid. A current top-level Claude `HarnessData` normalizes as `tools["claude-code"]`. A Phase 1 Codex standalone island normalizes as `tools.codex`. A future combined upload can provide the `tools` map directly.

## Requirements

- R1. Preserve every existing Claude-only report without DB migration or data backfill.
- R2. Accept three upload shapes at `script#harness-data`: legacy Claude `HarnessData`, Codex Phase 1 `{ tool: "codex", ... }`, and combined `{ tools: { "claude-code"?, codex? } }`.
- R3. Store normalized multi-tool envelopes in `harnessData`, while exposing a Claude-compatible `harnessData` slice to old render surfaces until they are migrated.
- R4. Add a public report tool selector only when more than one valid tool profile exists.
- R5. Render Codex profiles honestly: local CLI caveat, no fake skill usage counts, no Claude-only hooks/agent-dispatch claims.
- R6. Keep hidden-section privacy filtering for legacy keys and apply equivalent stripping inside each tool in an envelope.
- R7. Keep `harnessData` excluded from PUT updates. Phase 2 storage changes are upload-only.
- R8. Keep scalar denorms (`totalTokens`, `durationHours`, `prCount`, etc.) Claude-compatible for legacy behavior; for Codex-only reports, populate scalar fields from Codex stats only where the scalar meaning is clear.

## Key Decisions

- **No Prisma migration.** `harnessData Json?` already supports the envelope. Backfills add risk and do not improve runtime behavior.
- **Compatibility helpers, not ad hoc checks.** Add one normalization module in `src/types/insights.ts` so upload, filtering, detail UI, edit UI, OG/list routes, and tests share the same shape decisions.
- **Legacy top-level Claude stays accepted.** Treat it as an implicit `tools["claude-code"]`, but do not rewrite old rows until they are re-uploaded.
- **Codex renders through a separate dashboard path.** Reusing the Claude dashboard wholesale would over-claim; Codex lacks hooks, agent dispatch, Claude writeups, and skill invocation counts.
- **Tool selector is separate from section tabs.** `ProfileTabs` remains Dashboard/Skills/Write-up/Claude Insights; a new `ToolSelector` chooses Claude Code vs Codex above those tabs.

## Implementation Units

### Unit 1: Multi-tool type and normalization helpers

**Status:** completed 2026-05-28

**Goal:** Add typed helpers that classify legacy Claude data, Codex islands, and tools-map envelopes.

**Files:**
- Modify: `src/types/insights.ts`
- Create/modify tests: `src/lib/__tests__/harness-tools.test.ts`

**Depends on:** none

**Approach:**
- Add `HarnessToolKey = "claude-code" | "codex"`.
- Add minimal `CodexHarnessData` type matching Phase 1 island fields.
- Add `HarnessToolsEnvelope`.
- Add helpers:
  - `normalizeHarnessEnvelope(raw)`
  - `normalizeHarnessData(raw)` remains Claude-slice compatible for existing callers.
  - `getClaudeHarnessData(raw)`
  - `getCodexHarnessData(raw)`
  - `listHarnessTools(raw)`
  - `toStoredHarnessData(raw)` for upload persistence.

**Test scenarios:**
- Legacy top-level Claude `HarnessData` normalizes and lists only `claude-code`.
- Codex `{ tool: "codex" }` island normalizes and lists only `codex`.
- Combined `{ tools: { "claude-code": legacy, codex } }` normalizes both.
- Malformed tools are ignored; empty envelope returns null.
- `normalizeHarnessData` still returns the Claude slice for old and new shapes.

**Verification:** `npx vitest run src/lib/__tests__/harness-tools.test.ts`

### Unit 2: Parser and upload storage

**Status:** completed 2026-05-28

**Goal:** Parse all three supported `harness-data` shapes and persist the normalized stored shape.

**Files:**
- Modify: `src/lib/harness-parser.ts`
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/api/insights/route.ts`
- Modify: `src/lib/publish-report.ts`
- Tests: `src/lib/__tests__/harness-parser.test.ts`, `src/app/api/upload/__tests__/route.test.ts`, `src/app/api/insights/__tests__/route.test.ts`

**Depends on:** Unit 1

**Approach:**
- Keep `parseHarnessHtml` as the parser boundary, but have it return normalized stored harness data.
- Sanitize Claude `writeupSections.contentHtml` wherever the Claude slice appears.
- Store envelopes via `toStoredHarnessData`.
- Derive scalar denorms from the Claude slice if present; otherwise from Codex stats for Codex-only reports.

**Test scenarios:**
- Legacy Claude fixture still parses unchanged.
- Codex Phase 1 fixture with `tool:"codex"` parses and is accepted by `/api/upload`.
- Combined envelope parses, sanitizes Claude writeup HTML, and preserves Codex data.
- `/api/insights` stores normalized envelope, not `null`, for Codex-only input.

**Verification:** targeted parser/upload/insights Vitest files.

### Unit 3: Hidden-section filtering for tools map

**Status:** completed 2026-05-28

**Goal:** Preserve privacy filtering for both legacy and envelope-shaped `harnessData`.

**Files:**
- Modify: `src/lib/harness-section-visibility.ts`
- Modify: `src/lib/filter-report-response.ts`
- Tests: `src/lib/__tests__/filter-report-response.test.ts`

**Depends on:** Unit 1

**Approach:**
- Legacy hide keys (`skillInventory`, `plugins`, etc.) continue applying to Claude slice.
- Namespaced keys (`tools.codex.skillInventory`, `tools.claude-code.plugins`) apply to specific tools.
- List-feed filtering drops showcase bytes from Claude skills and any compatible Codex skill showcase fields.

**Test scenarios:**
- Non-owner hidden `skillInventory` strips legacy Claude skill inventory.
- Non-owner hidden `tools.codex.skillInventory` strips only Codex skills.
- Owner with `includeHidden=true` receives full envelope.
- List feed strips heavy showcase fields inside envelope.

**Verification:** `npx vitest run src/lib/__tests__/filter-report-response.test.ts`

### Unit 4: Public report tool selector and Codex dashboard

**Status:** completed 2026-05-28

**Goal:** Render multi-tool reports on `/insights/[username]/[slug]`.

**Files:**
- Create: `src/components/ToolSelector.tsx`
- Create: `src/components/CodexHarnessDashboard.tsx`
- Modify: `src/app/insights/[username]/[slug]/page.tsx`
- Tests: component tests for `ToolSelector` and Codex dashboard where practical.

**Depends on:** Units 1 and 3

**Approach:**
- Derive available tools with `listHarnessTools`.
- Show no selector for a single-tool report.
- For Claude Code, keep the current report tabs and dashboard behavior using the Claude slice.
- For Codex, render a Codex-specific dashboard:
  - local CLI caveat
  - token/session stats
  - tool usage
  - CLI commands
  - inventory-only skills
  - plugins
  - safety/rules
  - work surfaces
  - workflow empty state when no phase signal exists
- Do not show Claude-only Write-up or Claude Insights tabs for Codex-only reports.

**Test scenarios:**
- Legacy Claude report renders without a tool selector.
- Combined report renders a selector and changing tools swaps displayed data.
- Codex-only report does not show Claude-only hooks/writeup claims.
- Codex skills with no `calls` render as inventory items.

**Verification:** targeted component tests plus browser smoke test on a fixture report if local data is available.

### Unit 5: Edit page compatibility

**Status:** completed 2026-05-28

**Goal:** Keep the author edit page functional for legacy and envelope reports.

**Files:**
- Modify: `src/app/insights/[username]/[slug]/edit/page.tsx`
- Tests: existing edit-flow tests plus targeted render-safe tests if practical.

**Depends on:** Units 1 and 3

**Approach:**
- Continue editing visibility only; never submit `harnessData`.
- Use Claude slice for the existing visibility preview.
- If a report is Codex-only, show a concise visibility preview for Codex sections and allow section-level hides via namespaced keys.

**Test scenarios:**
- PUT allowlist still excludes `harnessData`.
- Legacy edit page still normalizes Claude slice.
- Codex-only edit page does not crash.

**Verification:** `npx vitest run src/app/insights/__tests__/edit-flow.test.ts`

### Unit 6: Full verification and PR

**Goal:** Prove the feature works without regressing legacy flows.

**Files:** no feature files unless fixes are needed.

**Depends on:** Units 1-5

**Verification:**
- `npm run lint`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`
- Manual browser smoke if a dev server is started for UI verification.

## Open Risks

- The current `ProfileTabs` and report page are large and Claude-shaped. The first implementation should avoid broad redesign; isolate Codex UI in a new component.
- Existing list/OG routes may still use scalar denorms. Phase 2 should not promise cross-tool aggregate cards until Phase 3.
- Codex standalone HTML currently lacks the `insight-harness-integrity` marker. `isHarnessReport` may need to recognize `script#harness-data` with `tool:"codex"` as a harness report.
