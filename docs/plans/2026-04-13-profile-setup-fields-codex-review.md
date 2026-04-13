# Codex Review — Profile Setup Fields Plan

Date: 2026-04-13
Reviewer: codex CLI (gpt-5-codex)

## Findings

### Architecture & validation

1. **Plan not in implementation branch.** Plan lives in main checkout only — copy/commit into the worktree before implementation so the branch contains the source of truth.

2. **JSON blob on `User` is sound for v1.** Existing `User` model is profile scalars + relations with no setup table pressure (schema.prisma:12). Public profile fetch is already a single `User` query (route.ts:11). Normalized table would be premature.

3. **Validation is too write-only.** `normalizeSetup(raw)` must run on BOTH the PUT path AND when reading from public/private endpoints. Otherwise malformed JSON from manual DB edits, old shape, or bad migration leaks raw unknown keys through the public endpoint once `setup: true` is added at `src/app/api/users/[username]/route.ts:13`.

4. **Type missing recommended metadata.** Plan's `ProfileSetup` shape only includes user fields (plan:90). Bake in `version: 1` and `setupUpdatedAt` now if we agreed to them — but make BOTH server-owned. Do NOT accept client-provided `setupUpdatedAt`.

5. **Prisma JSON null handling needs a note.** Plan says empty setup → NULL (plan:203). For Prisma `Json?`, plain `null` is ambiguous — use the generated Prisma null sentinel (`Prisma.JsonNull` / `Prisma.DbNull`) and cover with TS.

6. **PUT accumulator type needs widening.** Current `updateData` in `src/app/api/users/me/route.ts:67` is typed `Record<string, string | null>`. Adding `setup` requires a wider type. The "no valid fields" check at line 97 must still allow "clear setup to null" as a valid update.

### Auto-derivation

7. **Source keys are real.** `models`, `mcpServers`, `harnessFiles`, `versions` all exist on `HarnessData` (insights.ts:225). `normalizeHarnessData` defaults `models` and `mcpServers` to `{}` (insights.ts:435).

8. **Prefer `perModelTokens` for primaryModel.** `perModelTokens` already exists (insights.ts:249). If "primary model" means actual usage, **token share is a better signal than message count**.

9. **OS heuristic privacy.** Project classifies local file paths as high-risk private data (review-step-design.md:18, :31). Helper must return ONLY `{ os: "macOS" }` — never the matched path, no logging, no serialization of evidence.

10. **Derive from privacy-filtered harness data, not raw `harnessData`.** Public report responses already filter hidden harness fields server-side (filter-report-response.ts:50). The new `setup-suggestions` endpoint must select `hiddenHarnessSections` and run `stripHiddenHarnessData` BEFORE deriving — `harnessFiles` and `mcpServers` are both hideable (harness-section-visibility.ts:10).

11. **MCP privacy understated.** Plan implies surfacing only key names = no PII (plan:287). Project research marks MCP server names as potentially project-specific (review-step-design.md:24, :87 — medium risk). Keep per-field confirmation; add UI copy: "Review names before publishing."

12. **`packageManager` is a cheap missed derivation.** `HarnessData.cliTools` (insights.ts:237). If `pnpm`/`npm`/`yarn`/`bun`/`uv`/`pip`/`cargo`/`go` appears, suggest with same opt-in flow.

### UI

13. **In-page edit form is right for v1.** `ProfileEditForm` already in `src/app/[username]/page.tsx:139`, toggled inline at line 417. A separate /settings page only justified once non-public settings or much larger form.

14. **Place `SetupCard` below header/bio, full-width.** Header is flex layout around avatar (page.tsx:401). Long machine/model/MCP values wrap more predictably in a full-width block before "Shared Reports" (page.tsx:480).

15. **Public API filtering not needed if all setup fields are intentionally public** — but API normalization still required (see #3).

16. **Add explicit UI states for suggestions.** Plan describes happy path only (plan:265). Missing: no harness reports, suggestions unavailable, loading, failed fetch, "already applied."

### Migration & verification

17. **Migration low-risk.** Model already uses several nullable `Json?` columns (schema.prisma:53). Use a full timestamped migration directory matching the existing `20260413003102_slug_per_user_unique` style — NOT the shorter `20260413_add_user_setup` shown in the plan (plan:123).

18. **Verification commands wrong.** No `typecheck` or `test` scripts in `package.json:5`. Use `npx tsc --noEmit` and `npx vitest run` (or add scripts).

## Defaults — Codex agrees with

- JSON column on User
- New `src/types/profile.ts`
- Under-bio / full-width layout
- Comma-separated MCP input for v1
- `version: 1` baked into blob
- No separate /settings page for v1

## Conditional agreement

- `setupUpdatedAt` in the blob: fine for display-only, but server-owned and updated only when normalized setup actually changes. If sorting/filtering by freshness becomes likely later, make it a real column instead.
