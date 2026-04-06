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
