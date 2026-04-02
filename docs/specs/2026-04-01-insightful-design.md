# Insightful — Design Spec

A community platform for sharing Claude Code /insights reports, discovering tips and tricks, and learning from how others use Claude Code.

## Core Concept

Users generate insights reports locally via Claude Code's `/insights` command, which produces a self-contained HTML file analyzing their last 30 days of usage. Insightful lets them upload, redact sensitive data, and share these reports with the community. Other users can browse, highlight standout sections, comment, and vote.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL + Auth)
- **ORM:** Prisma
- **Styling:** Tailwind CSS
- **Auth:** GitHub OAuth via Supabase Auth
- **Deployment:** Local dev first (Vercel-ready)

## Features (v1 Scope)

### 1. Authentication

- GitHub OAuth login via Supabase Auth
- User profile: GitHub username, avatar, optional bio
- Public profile page showing their shared insights

### 2. Upload & Redaction Flow

**Upload:**

- User uploads their local insights HTML file (from `~/.claude/usage-data/report.html`)
- System parses the HTML to extract structured sections (the insights JSON is embedded in the HTML or we parse the DOM sections)

**Smart Auto-Detect Redaction (Option B):**

- On upload, the system scans the parsed content for likely sensitive data:
  - Project area names (from the `project_areas` section)
  - File paths and directory names
  - GitHub repo names / URLs
  - Tool-specific configuration snippets
  - Email addresses, usernames in examples
- Presents a redaction review UI where each detected item is highlighted
- User can: accept suggested redaction, skip it, add custom redactions, or replace with an alias
- Redacted text is replaced with `[redacted]` or a user-chosen alias (e.g., "Project Alpha")
- Original content is NEVER stored — only the redacted version is saved

### 3. Reading Experience (Option C: Full-Page with Highlighted Sections)

**Public Insights Page:**

- Renders the full insights report in a clean, consistent layout (not raw HTML embed)
- Sections map to the insights JSON structure:
  - At a Glance (summary)
  - Project Areas (with redacted names)
  - Interaction Style / Key Pattern
  - Impressive Workflows (what works)
  - Friction Analysis (what's hard)
  - Suggestions (CLAUDE.md additions, features to try, usage patterns)
  - On the Horizon (ambitious workflows)
- Each section is independently addressable (anchor links, can be highlighted/voted on)

**Highlighted Sections:**

- Author can mark specific sections as "featured" during upload
- Community members can highlight/bookmark sections they find valuable
- A "Popular Highlights" view shows the most-highlighted sections across all reports

### 4. Voting

- Each major section of a report can be upvoted independently
- Upvote count shown per-section
- Global feed can be sorted by: newest, most upvoted (total), trending (recent upvotes)
- "Top Insights" page aggregates the most upvoted individual sections across all reports

### 5. Comments

- Author can add annotations/comments to their own sections (inline context)
- Other users can comment on the full report
- Comments support markdown
- Comment threading (1 level deep — reply to comment)

### 6. Project Links

- Author can optionally link projects mentioned in their report to:
  - GitHub repos (validated URL)
  - Live project URLs
- Projects display as cards below the insights report
- Links to advertise what they're building with Claude Code

### 7. Browse & Discovery

- **Home feed:** Recent shared insights, sortable by newest / most upvoted / trending
- **Search:** Full-text search across insights content
- **Filters:** By interaction style, by top friction categories, by suggested features
- **User profiles:** See all insights from a specific user

## Data Model (Prisma)

```
User
  - id (cuid)
  - githubId (string, unique)
  - username (string, unique)
  - displayName (string?)
  - avatarUrl (string?)
  - bio (string?)
  - createdAt, updatedAt

InsightReport
  - id (cuid)
  - authorId -> User
  - title (string, auto-generated from stats)
  - slug (string, unique)
  - publishedAt (datetime)
  - stats (json) — session count, messages, commits, date range
  - atAGlance (json)
  - interactionStyle (json)
  - projectAreas (json) — redacted
  - impressiveWorkflows (json)
  - frictionAnalysis (json)
  - suggestions (json)
  - onTheHorizon (json)
  - funEnding (json?)
  - createdAt, updatedAt

ProjectLink
  - id (cuid)
  - reportId -> InsightReport
  - name (string)
  - githubUrl (string?)
  - liveUrl (string?)
  - description (string?)

SectionVote
  - id (cuid)
  - userId -> User
  - reportId -> InsightReport
  - sectionKey (string) — e.g., "impressive_workflows.0", "friction.1"
  - createdAt
  - @@unique([userId, reportId, sectionKey])

SectionHighlight
  - id (cuid)
  - userId -> User
  - reportId -> InsightReport
  - sectionKey (string)
  - createdAt
  - @@unique([userId, reportId, sectionKey])

Comment
  - id (cuid)
  - authorId -> User
  - reportId -> InsightReport
  - parentId -> Comment? (for threading)
  - sectionKey (string?) — null for report-level comments
  - body (text)
  - createdAt, updatedAt

AuthorAnnotation
  - id (cuid)
  - reportId -> InsightReport
  - sectionKey (string)
  - body (text)
  - createdAt, updatedAt
```

## Key Pages / Routes

```
/                     — Home feed (browse insights)
/login                — GitHub OAuth login
/upload               — Upload & redaction flow
/insights/[slug]      — View a shared insight report
/insights/[slug]/edit — Edit redactions, annotations, project links
/u/[username]         — User profile + their insights
/top                  — Top voted sections across all reports
/search               — Search insights
```

## Redaction Implementation

1. **Parse:** On file upload, extract the insights JSON from the HTML (it's embedded as structured data or parse the DOM)
2. **Detect:** Run detection rules against all text content:
   - Project area names → always flagged
   - File paths (regex: paths with `/` and file extensions) → flagged
   - GitHub URLs → flagged
   - Email addresses → flagged
   - Anything in code blocks that looks like a path or config → flagged
3. **Present:** Show each detected item in a review UI with:
   - The text in context (surrounding sentence)
   - Options: Redact (replace with [redacted]), Alias (user types replacement), Keep
4. **Apply:** Generate the redacted version; store only the redacted content
5. **No undo on original:** We never store the un-redacted version server-side

## Non-Goals (v1)

- No real-time collaboration
- No email notifications
- No admin dashboard
- No rate limiting beyond basic auth
- No image/chart extraction from HTML (text-only sections)
- No Claude Code skill integration (future)
- No SSR optimization (CSR fine for v1)

## Success Criteria

- User can sign in with GitHub, upload an insights HTML, redact sensitive content, and publish
- Other users can browse, read, vote on sections, and comment
- The redaction auto-detection catches project names, file paths, and emails
- The whole thing runs locally with `npm run dev`
