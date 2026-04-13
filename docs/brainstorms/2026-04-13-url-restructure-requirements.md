---
date: 2026-04-13
topic: url-restructure
---

# URL Restructure — Username-Scoped Reports and Root Profile

## Problem Frame

Today reports live at `/insights/[slug]` where `slug` is a composite string like `craig-20260412-a4f2`. Profiles live at `/u/[username]`. Two issues:

- **Username is invisible in report URLs.** A reader sees `/insights/craig-20260412-a4f2` and has to decode that the first token is the author. A reader-facing URL should surface the author explicitly.
- **Profile URLs carry an unnecessary `/u/` prefix.** Shorter, more memorable profile URLs (`insightharness.com/craig`) match how competitors like GitHub, X, and Substack present author pages. This matters as the product enters social-share territory.

The product has no live users yet, so this is a greenfield change — no redirects, no deprecation window, no SEO preservation burden.

## URL Map

| Concept       | Today                                | After                                |
| ------------- | ------------------------------------ | ------------------------------------ |
| Report detail | `/insights/craig-20260412-a4f2`      | `/insights/craig/20260412-a4f2`      |
| Profile       | `/u/craig`                           | `/craig`                             |
| Edit report   | `/insights/craig-20260412-a4f2/edit` | `/insights/craig/20260412-a4f2/edit` |
| OG image      | `/api/og/craig-20260412-a4f2`        | `/api/og/craig/20260412-a4f2`        |
| Report API    | `/api/insights/craig-20260412-a4f2`  | `/api/insights/craig/20260412-a4f2`  |

## Requirements

**URL Structure**

- R1. Report detail pages resolve at `/insights/[username]/[slug]`. Both segments are required; a URL with only one path segment under `/insights/` returns 404.
- R2. Profile pages resolve at `/[username]` as a root-level dynamic route.
- R3. The edit page moves to `/insights/[username]/[slug]/edit`.
- R4. The OG image endpoint moves to `/api/og/[username]/[slug]` (or equivalent — final path in planning).
- R5. Report API routes move from `/api/insights/[slug]` to `/api/insights/[username]/[slug]` for all sub-resources (`vote`, `highlight`, `annotations`, `comments`, `projects`, etc.).
- R6. The `/u/[username]` route is removed entirely (no redirect — no users exist to protect).

**Slug Storage**

- R7. The `slug` column on `InsightReport` stores only the tail — the portion after the username. Example tail: `20260412-a4f2`.
- R8. Slug uniqueness becomes per-user via a composite unique index `@@unique([authorId, slug])`. Global slug uniqueness is dropped.
- R9. Slug generation drops the `{username}-` prefix. Generated tails are `{YYYYMMDD}-{6-char-base36}`.

**Reserved Username Policy**

- R10. At first login, if the GitHub username matches any entry in the reserved-username allowlist (case-insensitive), the user cannot sign up. The login flow surfaces a clear error and directs them to contact support.
- R11. The reserved allowlist covers every top-level app route plus near-term expected routes. Minimum set: `api`, `insights`, `search`, `top`, `u`, `upload`, `settings`, `login`, `logout`, `signup`, `about`, `pricing`, `admin`, `dashboard`, `docs`, `blog`, `help`, `terms`, `privacy`, `welcome`, `new`.
- R12. The allowlist lives in a single source file imported by (a) the auth handler at signup and (b) any future username validators.
- R13. Once a user exists, their username is immutable — we do not sync GitHub username changes. This means the reserved-list check only runs at initial account creation.

**Username Immutability**

- R14. Users cannot change their username through the product UI or API. The GitHub username captured at first sign-in is the permanent URL identifier.
- R15. If a user renames on GitHub, their URLs continue to resolve under the original name. No mapping table or alias support is built.

**Profile Page**

- R16. Content at `/[username]` is identical to today's `/u/[username]` — same props, same rendering, same sections. This is a route move, not a redesign.

**Call Sites and Link Updates**

- R17. Every internal link that builds a report URL uses a single helper (e.g., `buildReportUrl(username, slug)`) rather than string-concatenating. This includes share buttons (PR #62), profile cards (PR #58), OG card responses, upload-success redirects, and any component that renders an `href` pointing at a report.
- R18. Every internal link that builds a profile URL uses a single helper (e.g., `buildProfileUrl(username)`).

**Next.js Routing**

- R19. The root-level `/[username]` dynamic route must not intercept static top-level routes. The reserved-username allowlist enforces this at signup; Next.js route precedence handles the request-time resolution (static routes always win over dynamic).

## Success Criteria

- Visiting `/insights/craig/20260412-a4f2` renders the report that was previously at `/insights/craig-20260412-a4f2`.
- Visiting `/craig` renders the profile page that was previously at `/u/craig`.
- Visiting `/u/craig` returns 404 (route removed).
- Attempting to sign up with a reserved GitHub username (e.g., someone named `search` on GitHub) surfaces a clear error at the auth step; the user does not get a broken account.
- A user named `admin` cannot accidentally shadow an admin route because `admin` is on the reserved list.
- All internal share and link-rendering call sites produce the new URL shape with no hand-rolled concatenation left in the codebase.
- Two users can independently have a report with slug `20260412-a4f2` without conflict.

## Scope Boundaries

- **No migration logic.** No users exist; existing `slug` column data (if any in dev) can be wiped or manually rewritten. No 301 redirects from old URLs.
- **No `/u/[username]` alias.** The route is deleted outright.
- **No profile redesign.** The `/[username]` page is the current `/u/[username]` page moved.
- **No username-change flow.** Usernames are immutable. Building a rename flow is out of scope.
- **No custom domains, vanity URLs, or short-link service.** Just a cleaner path structure.
- **No SEO work beyond the route change.** Sitemap regeneration is the only SEO-adjacent task; metadata tags are unchanged.
- **No change to the skill-showcase integration plan (2026-04-12-002).** That plan renders on the report page; after this restructure it renders on `/insights/[username]/[slug]` instead of `/insights/[slug]`. The integration plan is compatible.

## Key Decisions

- **Greenfield migration, no backwards compatibility.** No live users to protect. Decided during brainstorm based on product state.
- **Reserved allowlist at signup, not URL rewriting.** Enforcing uniqueness of name-to-route mapping at account creation is cheaper than URL-time disambiguation and avoids silent failure modes.
- **Per-user slug uniqueness, not global.** Shorter URLs, independent of username changes (even though we disallow those), one composite index. Matches how most content platforms structure author-scoped URLs.
- **Immutable username.** Eliminates the entire class of URL-invalidation bugs, at the cost of a rare support request if a user genuinely needs a rename. Support can handle one-off cases manually.
- **Single URL-builder helper.** Prevents future route drift. Any structural URL change becomes a one-file edit.
- **Delete `/u/[username]` route entirely.** No users, no redirect burden.

## Dependencies / Assumptions

- GitHub OAuth is the sole identity provider (no email/password signup). Reserved-list check runs inside the GitHub callback handler.
- The skill-showcase integration plan (`docs/plans/2026-04-12-002-feat-skill-showcase-in-report-plan.md`) is either not yet shipped or easily rebased onto the new URL structure; this brainstorm is meant to land first.
- Vercel deployments rebuild the sitemap on each deploy; no external cache needs manual invalidation.
- No external partner currently links into specific reports or profiles (we'd know — there are no users).

## Outstanding Questions

### Deferred to Planning

- [Affects R4][Technical] Final OG image path: `/api/og/[username]/[slug]` vs. keeping `/api/og/[slug]` and looking up by tail-only slug. Decide based on how the current OG handler accepts params and what change is smaller.
- [Affects R7, R9][Technical] Do existing dev-environment reports need manual cleanup? Strategy: either `prisma migrate reset` during development or a one-off script to split `{username}-{date}-{shortid}` into tail + username. Planning picks the path.
- [Affects R10, R11][Technical] Where exactly does the reserved-username check hook into the NextAuth (or equivalent) callback? Locate the signup / first-login seam and add the check there.
- [Affects R17, R18][Technical] Audit every component and API handler that constructs report/profile URLs. Grep-level audit deferred to planning; the brainstorm only asserts the requirement.
- [Affects R19][Needs research] Confirm Next.js App Router dynamic-route precedence for root-level `[username]` next to static `/search`, `/top`, etc. Expected behavior: static wins. Planning verifies with a local test.

## Next Steps

→ `/ce:plan` for structured implementation planning
