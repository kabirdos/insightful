# Session Handoff

## Date

2026-04-06

## Branch

feat/insightful-mvp

## Git Status

Clean working tree on feat/insightful-mvp. Untracked: docs/mockups/ (15 HTML mockup files), docs/research/.

## Summary

Massive session covering PR #2 through PR #7. Executed mockup review fixes, built profile edit page with social links, fixed JWT username resolution, added upload path helper, redesigned homepage with Gallery Light layout, renamed project to "Insight Harness", built upgrade path UX with comparison table, renamed skill from harness-profile to insight-harness, made insight-harness a superset of /insights by embedding the report, added integrity hash, and extracted all homepage copy to src/content/homepage.ts.

## What Was Done

### PR #2 — UX Fixes (MERGED)

- Per-week stats, date ranges, styled upload previews, mockup review fixes

### PR #3 — Profile Edit Page (MERGED)

- Profile page with inline edit and social links (GitHub, LinkedIn, X)
- Custom SVGs for social icons (Lucide-react doesn't export Github/Linkedin)

### PR #4 — JWT Username Fix (MERGED)

- Resolved username from DB for existing JWT sessions that predate the username token field

### PR #5 — Upload Path Helper (MERGED)

- Copy-path helper and Finder Cmd+Shift+G tip on upload drop zone
- Browser file pickers can't set default directory — guided UX workaround

### PR #6 — Homepage Redesign (MERGED)

- Gallery Light layout, renamed to "Insight Harness"
- Full homepage redesign with new branding

### PR #7 — Upgrade Path UX (MERGED)

- Comparison table showing /insights vs /insight-harness capabilities
- Copy prompts for installing the skill, dual upload paths

### Skill Rename & Enhancement

- Renamed /harness-profile to /insight-harness across codebase
- insight-harness now embeds /insights report as a third tab (true superset)
- Added integrity manifest: SHA-256 hash of key stats for tamper detection

### Content Extraction

- All homepage copy extracted to src/content/homepage.ts
- Updated install command and GitHub link for insight-harness skill

## What Remains

1. **Parse insight-harness HTML on upload** — extract tokens, tool usage, skills inventory, hooks, agent patterns, models from the new format
2. **Display richer harness data** — new sections in profile detail pages for tokens, tools, skills
3. **Update Prisma schema** — store additional harness data fields (tokens, tool stats, skill inventory)
4. **HMAC signing with server-side key** — discussed but not implemented; currently using client-side SHA-256 integrity hash
5. **Fresh /insights data** — the /insights report embedded in insight-harness is from Apr 1; user should run fresh /insights before /insight-harness
6. **Domain publishing** — insightharness.com domain, currently deploying to Vercel on feat/insightful-mvp branch

## Known Issues

- Untracked docs/mockups/ directory with 15 HTML mockup files — consider adding to .gitignore or committing
- Playwright QA CI check may still be failing (env vars in CI)

## Key Files

### Content & Marketing

- src/content/homepage.ts — all homepage copy, single source of truth

### Parser & Types

- src/lib/parser.ts — HTML parser for uploaded reports (needs extension for insight-harness format)
- src/types/insights.ts — type definitions (needs new fields for harness data)

### Pages

- src/app/page.tsx — homepage (Gallery Light layout)
- src/app/insights/[slug]/page.tsx — detail page
- src/app/upload/page.tsx — upload flow with dual path (insights vs insight-harness)
- src/app/profile/page.tsx — profile edit page with social links

### Skill

- ~/.claude/skills/insight-harness/ — local installed skill
- ~/Coding/claude-toolkit/skills/insight-harness/ — published skill repo

### Components

- src/components/SnapshotCard.tsx, ContributorRow.tsx, CollapsibleSection.tsx
- src/components/SkillBadges.tsx, ToolUsageChart.tsx

### API & Auth

- src/app/api/insights/route.ts, src/app/api/insights/[slug]/route.ts
- Auth: NextAuth v5 beta, edge-compatible auth.config.ts

## Context for Next Session

Primary focus should be extending the parser (src/lib/parser.ts) to handle the insight-harness HTML format, which contains richer data than plain /insights reports — token breakdowns, tool usage stats, skill inventories, hooks, and agent patterns. After parsing works, update the Prisma schema and detail page to display the new data. The upgrade path UX is already built so users can upload either format.

Key environment notes:

- Supabase DB: aws-1-us-east-1.pooler.supabase.com with pgbouncer=true
- Use `prisma db push` instead of `prisma migrate dev` if migration history diverges
- Vercel: auto-deploys from feat/insightful-mvp (default branch)
- 55+ tests passing
