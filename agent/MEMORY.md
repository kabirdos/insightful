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
