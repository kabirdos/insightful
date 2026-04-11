# Memory (selectively loaded)

## 2026-04-04

- NextAuth v5 beta: signin requires POST with CSRF token; GET returns "UnknownAction"
- NextAuth v5 middleware cannot import auth modules that use Prisma (edge runtime incompatible) — use edge-safe auth.config.ts
- User upsert must happen in `jwt` callback (not `signIn` event) so `token.sub` has DB user ID on first login
- Vercel env vars: use `printf` not `echo` — `echo` appends a trailing newline that breaks AUTH_SECRET, client IDs, etc.
- Supabase Prisma: use `aws-1` pooler (not aws-0), append `?pgbouncer=true` on the transaction pooler URL
- Prisma custom output path (`src/generated/prisma`) fails on Vercel — keep default `@prisma/client`
- Prisma needs `binaryTargets = ["native", "rhel-openssl-3.0.x"]` for Vercel deployment
- Add `prisma generate` to `package.json` build script for Vercel
- React error #310 = hooks called conditionally; early returns must come AFTER all hooks
- Codex CLI review: `codex review --base <sha> --title "..."` reviews against base commit
- Chrome headless mobile screenshots clip at 375px due to scrollbar width — may not reflect real devices

## 2026-04-05

- SnapshotCard still accepts `chartData` prop in its interface but never renders it — kept to avoid breaking callers. If chart visualization is added to SnapshotCard later, wire it up; otherwise remove the prop in a cleanup pass.

## 2026-04-06

- Lucide-react doesn't export Github/Linkedin icons — use custom SVGs instead
- `prisma db push` works when `prisma migrate dev` fails due to diverged migration history on Supabase
- JWT sessions created before username was added to token have undefined username — need DB fallback lookup in session callback
- Browser file pickers can't set default directory — use copy-path helper + Finder Cmd+Shift+G tip for user guidance
- The insight-harness skill (renamed from harness-profile) lives in claude-toolkit repo, installed via curl one-liner
- insight-harness now embeds /insights report as a third tab — true superset of /insights
- Integrity manifest: SHA-256 hash of key stats embedded in HTML for tamper detection
- f-string escaping in Python: pre-compute JSON strings before using in f-string templates to avoid {{}} issues
- All homepage copy extracted to src/content/homepage.ts for easy editing — single source of truth for marketing copy

## 2026-04-07

- Harness parser: detect insight-harness HTML via `#insight-harness-integrity` script tag; parse stats from `.stats-grid .stat`, autonomy from `.autonomy-box`, pills from `.pills .pill`, dashboard sections by finding `<section>` with matching `h2` text
- When parsing harness uploads, extract `#tab-insights` inner HTML first and parse _that_ with the insights parser — the top-level harness `.stat`/`.subtitle` selectors confuse the insights parser and produce wrong stats
- Auth username sync: the `update` clause in the JWT callback's user upsert must include `username` — omitting it means renamed GitHub accounts keep stale usernames forever
- Code review findings must be fixed before merge, not deferred as "follow-up" — especially for user-facing flows like upload preview. Both reviewers caught the missing harness preview but it was shipped anyway and failed QA
- Demo seed data: all demo users have `githubId` starting with `demo-`, report slugs ending in `-demo` or `-harness-demo`. Cleanup: `npx tsx prisma/seed-demos.ts --cleanup`
- `normalizeHarnessData()` validates JSON shape from Prisma `Json?` before rendering — prevents detail page crashes from malformed data. Cast to `Prisma.InputJsonValue` when storing back
- CollapsibleSection renders a blank 10x10 square when `icon=""` — conditionally hide the container when icon is falsy
- Codex CLI: use `codex review --uncommitted` (no positional prompt arg allowed with --uncommitted flag)

## 2026-04-08

- Harness report subtitle format differs from /insights — sessionCount wasn't being parsed; fixed in chart-parser.ts
- `claude install-skill` command doesn't exist — use `curl -sL | tar xz` one-liner instead
- harnessData must NOT be in PUT allowedFields due to dangerouslySetInnerHTML XSS vector
- Mermaid.js is ~2MB — use npm install + dynamic import, not CDN loading, for Next.js apps
- The /insights HTML contains 8 orphaned charts never being parsed (response time, tool errors, outcomes, satisfaction, friction types, time of day, what helped most, multi-clauding)
- stats-cache.json has all-time per-model token data (input/output/cache_read/cache_create) — sufficient for API cost estimation
- JSONL compact_boundary entries have preTokens for context window usage analysis
- Toggle switches (iOS-style) weren't well-received — user prefers simple flat eye/eye-off icons for visibility controls
- ROYGBIV/rainbow color schemes were rejected — use single-hue gradients per data type (blue for sessions, green for tokens)
- Version navigation in UX mockups should default to newest version, not v1
- Activity heatmap: can be built from aggregate hourCounts in report data, no per-session data needed
- 126 integration tests replacing hollow test stubs — covers parsers, filters, and API routes
- Codex CLI `tui.status_line` and `tui.terminal_title` are configurable in `~/.codex/config.toml`; valid status-line IDs include `current-dir`, `git-branch`, `model-with-reasoning`, `context-used`, `five-hour-limit`, `used-tokens`, and `codex-version`
- Codex terminal title items are a separate list from status-line items; useful title IDs include `project`, `spinner`, `status`, `thread`, `git-branch`, and `model`
- A Claude-style `/handoff` workflow can be ported into Codex as a local skill under `~/.codex/skills/handoff`, but it should run inline by default because subagent spawning in this harness requires explicit user permission

## 2026-04-09

- **.tmp/insight-harness-skill/ was a Codex fork masquerading as the Claude version** — it had been in the repo for months. Any "sync" from that directory to `~/.claude/skills/` silently overwrote the real Claude extractor with a Codex-targeted one that reads from `~/.codex/`. Deleted the .tmp directory; source of truth is now `/Users/craigdossantos/Coding/claude-toolkit/skills/insight-harness/scripts/extract.py`
- **Both `~/.claude/skills/insight-harness/` and `~/.codex/skills/insight-harness/` can exist simultaneously** — they are separate files targeting different harnesses. Verify content headers (`"Codex insight-harness extractor"` vs `"Harness Profile Extractor v2"`) before syncing between them
- **Skill invocations in JSONL use `plugin-name:skill-name` format** — e.g., `superpowers:writing-plans`, `compound-engineering:ce-brainstorm`. Custom user skills have no prefix. The `parseSkillSource()` helper in `src/components/WorkflowDiagram.tsx` splits on the colon
- **The WorkflowDiagram parser contract**: extract.py must emit a `<h2>Skill Workflow</h2>` section with `.footnote` sub-group headers (currently: "Skill invocations", "Common workflow patterns"). The parser at `src/lib/harness-parser.ts:495` iterates children and uses footnote text to switch groups
- **Agent.input.description must NEVER be read** — it's user-written task labels like "Fix review critical issues" that leak project context into a publicly shareable report. `agent_types` (curated `subagent_type` field) provides privacy-safe categorization. Codex CLI review caught this as a P1 finding
- **Node test runners are misclassified by default** — `extract_safe_command_name` only returns first token, so `npm test` becomes `npm` → "implementation" phase. Fix: strict allowlist of Node test subcommands (`test`, `jest`, `vitest`, `mocha`, `cypress`, `playwright`, `test:unit`, etc.) that triggers two-token name return like `npm test`
- **Codex CLI review is valuable as a second opinion** — `codex review --base <branch>` (no custom prompt allowed when --base is set). It independently caught a real privacy leak plus two correctness bugs that the main model shipped
- **OG image with Next.js ImageResponse / Satori**: flexbox-only (no CSS grid), inline styles, fonts must be loaded as ArrayBuffer. To add `generateMetadata` to a client page, create a server `layout.tsx` sibling that exports the metadata function
- **Heatmaps in OG cards must have scale** — legend with all gradation steps (e.g. 0 → 85K tokens) makes the heatmap interpretable. Without numbers a heatmap is just decorative
- **`git rm -rf` is blocked by a hook** — use `git rm -r` (no force flag) instead
- **API 529 overload errors during peak hours** — background subagents fail silently mid-work. Retry inline or wait a few minutes. Affects the regular Claude API, not the CLI locally
- **Prefer squash-merge and then rebase follow-up branches** — if you push a feature branch and then merge via squash, follow-up branches based on the feature branch need a rebase (`git rebase origin/main`) before the next PR will be mergeable. The squashed commit has different SHA than the raw feature commits

## 2026-04-10

- **Homepage cost metric must read `harnessData.models` at TOP LEVEL**, not `harnessData.stats.models` — the canonical HarnessData schema has `models` at top level. The original homepage bug read from stats.models and silently returned zero cost. `estimateTotalCostUsd()` helper mirrors the one in `ActivityHeatmap.tsx` and falls back to `DEFAULT_RATE_PER_M * totalTokens` when no models map
- **Privacy-safe workflow helpers live in `src/lib/privacy-safe-workflow.ts`** — always import `safeSkillKeyLabel` and `safeSequenceLabel` before rendering user-visible workflow skill names. Raw `workflowData.agentDispatches[].description` is user-written task labels that leak project context — NEVER render it. Only `agentDispatch.types` is curated/privacy-safe. Covered by 15 tests including all 4 leak vectors caught in codex review
- **Seed default helpers extracted to `prisma/seed-helpers.ts`** — `computeDefaultAgentDispatch`, `computeDefaultHookFrequency`, `computeDefaultBranchPrefixes` are now unit-testable without instantiating PrismaClient. Add any new default-computation logic there, not inline in `seed-demos.ts`
- **Demo seed data now has 6 harness reports** — all 6 demo users (Kabir, Jordan, Marcus, Sam, plus 2) have `-harness-demo` slugs. Re-seed with `npx tsx prisma/seed-demos.ts --cleanup && npx tsx prisma/seed-demos.ts`. Seed agentDispatch.models counts are scaled by `totalAgents` (dispatch counts), NOT by token counts
- **Playwright QA workflow is manual-only** — `.github/workflows/qa.yml` is now `workflow_dispatch` only because Claude CLI can't run in the CI environment (exits code 1 in ~30s). Don't debug the auto-trigger; run it manually with `gh workflow run "QA Testing on Mac Mini"` when needed
- **Homepage author dedupe is client-side** — featured user is filtered out of the grid in JS after fetching. Fetch limit is 30 so dedupe has headroom without under-filling the grid
- **HIW copy treats `/insight-harness` as THE command**, not a step after `/insights`. Three steps: install → run → upload. Don't re-add `/insights` as step 1 — the harness skill is a superset
- **Vitest config excludes `.worktrees/**`\*\* — prevents stale sibling-branch test files from producing false-positive failures in the main workspace
- **Mermaid npm package can be missing from `node_modules` despite being in `package.json`** — if detail pages start returning 500 with "Cannot resolve 'mermaid'", run `npm install` to restore it
- **Featured card heatmap layout**: tokens + api cost heatmaps must be SIDE-BY-SIDE (not stacked) — reduces card height from ~1100px to ~430px. Design rationale is in `docs/mockups/homepage-info-layouts.html` (4 stages, 16 iterations, debate chamber synthesis)
- **Codex CLI code review is reliably catching real issues** — P1 leaks, wrong-field reads, scale bugs. Run it before every merge: `codex review --base <branch>` (no custom prompt with --base)

## 2026-04-11

- **`feat/insightful-mvp` was renamed to `main`** — `main` is now GitHub default AND Vercel production branch. Branch protection on `main` blocks force-push and deletion; PR reviews NOT required (solo iteration stays fast for pre-launch sprint)
- **Vercel production branch lives under Settings → Environments → Production → Branch Tracking** (NOT Settings → Git, which is where Vercel's own docs wrongly point). Burned ~20 min finding this
- **Vercel public API cannot change productionBranch** — tested `PATCH /v9/projects/{id}` with every plausible field (`link`, `link.productionBranch`, `productionBranch`, `gitRepository`, `defaultBranch`, `gitBranch`, `git`) on v1/v2/v9/v10. All rejected. Must be done manually in dashboard. Vercel also validates target branch exists before accepting the change
- **Branch-rename sequence for a Vercel-deployed repo**: (1) create new branch on GitHub via `gh api -X POST .../git/refs` as copy of old HEAD, (2) ask user to flip Vercel dashboard setting, (3) `gh api -X PATCH repos/{owner}/{repo} -f default_branch=main`, (4) `gh api -X DELETE .../git/refs/heads/<old>`, (5) locally: `git fetch --prune origin && git branch -m <old> main && git branch -u origin/main main`
- **Stale worktree cleanup pattern**: `git worktree remove <path> && git branch -D <branch> && gh api -X DELETE repos/{owner}/{repo}/git/refs/heads/<branch>`
- **PR & Branch Hygiene rules added to `~/.claude/CLAUDE.md`** — one atomic change per PR, legitimate bundling exceptions, short-lived branches, squash-merge to main, avoid "release PR" anti-pattern, bug sprint workflow uses per-bug branches cut from main (not a shared "bucket branch")
- **PR #20 merged** — persistent user-owned Projects + rich OG link previews. 8 units, all codex-reviewed. Codex caught real P1 bugs (IPv6-mapped IPv4 SSRF bypass, untrusted OG image URLs rendering client-side as SSRF vector, race conditions in library PATCH) — all fixed inline via commit amends before merge
- **unfurl.js integration pattern** — when using `opts.fetch` to inject a safe-fetch wrapper, also read the library's `getRemoteMetadata` path — it fetches oEmbed URLs through the same fetch hook. Disable oembed via `{ oembed: false }` if you don't want that second fetch. Pass raw bytes (not decoded text) to preserve non-UTF-8 charset sniffing
- **Route-handler test harness pattern** — `vi.mock("@/lib/db")` + `vi.mock("@/lib/auth")` at the top of the test file, then import the exported handler functions directly and invoke them as functions. No HTTP layer needed. Return typed mock of `prisma` so `.mockResolvedValue(...)` works per method. See `src/app/api/projects/__tests__/route.test.ts` as reference
- **Race-safe metadata refill pattern** — when a slow outbound fetch's result will be written back to a row whose URL might have changed in between, use `prisma.updateMany({ where: { id, liveUrl: fetchedUrl }, data: {...} })` instead of `update({ where: { id }, data: {...} })`. If the URL changed, 0 rows match and the stale result is silently discarded. Regression tested in the project library PATCH route
- **9 open issues filed from user feedback (#21–#29)** — sensitive-items button redesign, activity card heat map fixes (no scroll, keep squares, big vanity numbers above), restore lines-of-code metric in 3 places, mermaid workflow diagram redesign, fix API cost calculation (off by ~1000x), project tiles clickable/smaller/repositioned, per-item eye toggle granularity, OG sharing card fixes. Next session's triage list — each becomes its own `fix/<slug>` branch cut from main under new hygiene rules
