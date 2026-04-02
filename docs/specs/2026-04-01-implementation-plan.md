# Insightful — Implementation Plan

## Phase 1: Project Scaffolding & Database (Foundation)

### Task 1.1: Initialize Next.js project

- `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- Add Prisma: `npm install prisma @prisma/client && npx prisma init`
- Add Supabase: `npm install @supabase/supabase-js @supabase/ssr`
- Add dependencies: `npm install next-themes lucide-react clsx`
- Configure `.env.local.example` with required env vars

### Task 1.2: Database schema (Prisma)

- Create full Prisma schema per the design spec data model
- Configure Prisma for Supabase (PostgreSQL connection)
- Generate Prisma client
- Create seed script with sample data for development

### Task 1.3: Supabase Auth setup

- Configure Supabase project for GitHub OAuth
- Create auth helper utilities (`src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`)
- Create auth middleware for protected routes
- Create login/callback routes

## Phase 2: Core Data Layer

### Task 2.1: API routes for insights

- POST `/api/insights` — create new insight report (authenticated)
- GET `/api/insights` — list insights (public, paginated, sortable)
- GET `/api/insights/[slug]` — get single insight (public)
- PUT `/api/insights/[slug]` — update insight (author only)
- DELETE `/api/insights/[slug]` — delete insight (author only)

### Task 2.2: API routes for interactions

- POST `/api/insights/[slug]/vote` — vote on a section
- DELETE `/api/insights/[slug]/vote` — remove vote
- POST `/api/insights/[slug]/comments` — add comment
- GET `/api/insights/[slug]/comments` — list comments
- POST `/api/insights/[slug]/highlight` — highlight a section
- DELETE `/api/insights/[slug]/highlight` — remove highlight

### Task 2.3: API routes for user

- GET `/api/users/[username]` — public profile
- PUT `/api/users/me` — update own profile
- POST `/api/insights/[slug]/projects` — add project link
- DELETE `/api/insights/[slug]/projects/[id]` — remove project link

## Phase 3: Upload & Redaction Engine

### Task 3.1: HTML parser

- Parse the insights HTML file to extract structured JSON
- Handle both formats: embedded JSON data and DOM-parsed sections
- Extract stats (sessions, messages, commits, date range)
- Extract all text sections into structured format
- Write comprehensive tests for parser

### Task 3.2: Redaction detection engine

- Scan parsed content for sensitive data:
  - Project area names (always flagged from project_areas section)
  - File paths (regex: `/path/to/something`, `~/something`)
  - GitHub URLs (`github.com/...`)
  - Email addresses
  - Code blocks containing paths or configs
- Return list of detected items with context (surrounding text)
- Each detection includes: text, type, location (sectionKey + offset), suggested action

### Task 3.3: Redaction application

- Apply user's redaction decisions to the parsed content
- Replace with `[redacted]` or user-provided alias
- Ensure redactions are applied consistently (same text redacted everywhere)
- Generate final clean JSON for storage
- Never persist un-redacted content

## Phase 4: UI — Layout & Navigation

### Task 4.1: App layout and navigation

- Root layout with header (logo, nav, auth status)
- Responsive sidebar/mobile nav
- Footer
- Theme: clean, minimal, inspired by the insights HTML style (slate/blue palette)
- Dark mode support via next-themes

### Task 4.2: Auth UI

- Login page with GitHub OAuth button
- Auth callback handler
- User menu (avatar dropdown with profile, settings, logout)
- Protected route wrapper component

## Phase 5: UI — Core Pages

### Task 5.1: Home feed page (`/`)

- List of insight report cards
- Each card shows: author avatar/name, title (stats summary), date, top voted sections preview
- Sort: newest, most upvoted, trending
- Pagination (cursor-based)
- Empty state for no reports

### Task 5.2: Upload page (`/upload`)

- File upload dropzone (drag & drop + click)
- Parse uploaded HTML and show preview
- Step 1: Upload & parse
- Step 2: Redaction review (show detected items, let user approve/modify/skip each)
- Step 3: Add project links (optional)
- Step 4: Preview & publish
- Multi-step wizard UI

### Task 5.3: Insight report page (`/insights/[slug]`)

- Full report rendered from stored JSON
- Section-by-section layout matching the insights format
- Per-section vote buttons with counts
- Per-section highlight buttons
- Author annotations displayed inline
- Comments section at bottom
- Project links sidebar/section
- Share button (copy URL)

### Task 5.4: User profile page (`/u/[username]`)

- User info (avatar, name, bio, GitHub link)
- List of their shared insights
- Stats (total reports, total votes received)

### Task 5.5: Top insights page (`/top`)

- Aggregated view of most-upvoted sections across all reports
- Each entry shows the section content, author, report link, vote count
- Filter by section type (workflows, friction, suggestions, etc.)

### Task 5.6: Search page (`/search`)

- Full-text search input
- Results show matching sections with highlighted search terms
- Link to full report with section anchored

## Phase 6: Integration & Polish

### Task 6.1: End-to-end testing

- Test upload flow with sample insights HTML
- Test redaction detection and application
- Test voting, commenting, highlighting
- Test auth flow
- Test responsive layout

### Task 6.2: Seed data & demo

- Create 3-5 sample redacted insight reports for demo
- Generate sample votes, comments, highlights
- Ensure the app looks populated on first load

### Task 6.3: Final polish

- Loading states and skeletons
- Error handling and error pages (404, 500)
- Meta tags and OG images for sharing
- README with setup instructions

## Agent Assignment

| Agent     | Tasks           | Notes                                                                              |
| --------- | --------------- | ---------------------------------------------------------------------------------- |
| Research  | Pre-work        | Research Next.js 14 app router patterns, Supabase auth setup, Prisma with Supabase |
| Planner   | Plan validation | Review plan against spec, identify gaps                                            |
| Builder-1 | Phase 1, 2, 3   | Foundation, API, parser/redaction                                                  |
| Builder-2 | Phase 4, 5      | UI layout and all pages                                                            |
| Builder-3 | Phase 6         | Testing, seed data, polish                                                         |
| Reviewer  | Continuous      | Code review each phase via Codex CLI                                               |
