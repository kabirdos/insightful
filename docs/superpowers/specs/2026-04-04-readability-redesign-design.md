# Insightful v2 — Readability & Data Redesign

## Problem

The current report detail page is a wall of text. It's hard to scan, doesn't surface the most interesting information (tools used, workflow patterns, skills), and doesn't let readers expand/collapse to control detail level. The homepage shows report cards but doesn't give a quick sense of who each contributor is.

## Design

### 1. Homepage: Contributor-Grouped Report List

Replace the current report-card grid with a contributor-grouped list. One row per report, but visually grouped by contributor.

**Layout:** Clean list rows, each containing:

- GitHub avatar (already stored from OAuth)
- Display name + @username + date + days tracked (e.g., "@craigdossantos · Apr 3, 2026 · 18 days tracked")
- **Normalized per-week stats** for comparability: messages/week, lines/week
- Absolute labeled stats: "+N added" (green), "-N removed" (red), files, commits
- "Skills Used" label above badges row
- Skills badges: small colored chips
- Click entire row → report detail page

**Per-week calculation:** `messagesPerWeek = messageCount / (dayCount / 7)`, `linesPerWeek = (linesAdded + linesRemoved) / (dayCount / 7)`. Computed at read time — not stored.

**Raw tool counts NOT shown** on homepage rows (Bash is always at top for everyone — not differentiating). Tools belong in the detail page only.

If a user has multiple reports, they appear as separate rows but visually grouped under the same contributor header.

**Sorting:** Default by most recent upload. Sort options: newest, most voted, trending (existing algorithm).

**Data source:** All fields come from the InsightReport model. The new `chartData` and `detectedSkills` fields provide the tools and skills.

### 2. Upload Pipeline Changes

#### 2a. Parse Chart Data from HTML

The Claude Code HTML report contains bar chart sections with structured data in `.chart-card` elements:

- "What You Wanted" (request types: Bug Fix, Code Review, Git Operations, etc.)
- "Top Tools Used" (Bash, Read, Edit, TaskUpdate, Grep, Agent, etc.)
- "Languages" (TypeScript, Markdown, HTML, JSON, etc.)
- "Session Types" (Multi Task, Iterative Refinement, Single Task, etc.)

**Parse approach:** Use cheerio to extract `.chart-card` → `.bar-row` elements. Each row has `.bar-label` (text) and `.bar-value` (number). Store as JSON arrays of `{label: string, value: number}`.

**chartData JSON shape:**

```typescript
interface ChartData {
  toolUsage?: { label: string; value: number }[]; // "Top Tools Used"
  requestTypes?: { label: string; value: number }[]; // "What You Wanted"
  languages?: { label: string; value: number }[]; // "Languages"
  sessionTypes?: { label: string; value: number }[]; // "Session Types"
}
```

All keys are optional — if a chart section is missing from the HTML, that key is omitted. Display components render only what's present, with no empty-state needed for missing charts.

#### 2b. Detect Skills/Features

Scan all parsed text content for mentions of Claude Code features. Detection rules:

| Skill Key         | Detection Pattern                                                     |
| ----------------- | --------------------------------------------------------------------- |
| `parallel_agents` | "parallel agent", "parallel", "agent workflow", "TaskCreate" in tools |
| `worktrees`       | "worktree", "git worktree"                                            |
| `custom_skills`   | "skill", "slash command", "/skill", "SKILL.md"                        |
| `hooks`           | "hook", "pre-commit hook", "post-tool hook"                           |
| `mcp_servers`     | "MCP", "mcp server", "Playwright MCP"                                 |
| `playwright`      | "Playwright", "browser test", "visual test"                           |
| `headless_mode`   | "headless", "headless mode", "non-interactive"                        |
| `plan_mode`       | "plan mode", "implementation plan"                                    |
| `code_review`     | "code review", "Codex CLI review", "review agent"                     |
| `subagents`       | "subagent", "sub-agent", "Agent tool" in tools                        |

Store as `string[]` on the report (closed set — only the keys above are valid). Display as colored badge chips.

#### 2c. Full Project Redaction

Current behavior: only the project name text gets replaced with `[redacted]`.

New behavior: when a project name is marked for redaction:

- Replace the name everywhere it appears (already works)
- Also replace the project's description in the `project_areas` section with `[redacted]`
- Scan all other sections for exact matches of the project name, replace those too
- Do NOT do fuzzy/fragment matching on descriptions (too aggressive, would over-redact)

**Order of operations:** Redaction happens last, after all parsing and skill detection. User reviews the redacted result.

#### 2d. Review Step Shows Full Content

Current behavior: the redaction review step shows section toggle switches and a list of detected sensitive items, but doesn't show the actual section content.

New behavior: render each section's full parsed content below the toggles/redaction controls. Use `SectionRenderer` with a new `readOnly` prop that hides vote/highlight buttons and interactive actions. This lets users read exactly what they're about to share.

### 3. Schema Additions

Add to `InsightReport` model in `prisma/schema.prisma`:

```prisma
// Chart data parsed from HTML report
chartData       Json?      // ChartData shape (see 2a above)

// Detected Claude Code skills/features
detectedSkills  String[]   // closed set from detection table (see 2b above)
```

**Dropped from earlier draft:**

- `keyPattern` — derive at read time from `interactionStyle.key_pattern` (avoid duplicate source of truth)
- `originalData` — privacy risk, stores pre-redaction content. Voice rewrite also dropped, so no need.

Migration: add columns via SQL applied through `npx supabase db query --linked -f <file>`.

### 4. Report Detail Page Redesign

#### 4a. Top Snapshot Card

A visually prominent card at the top of the report, above all sections. **Order matters — skills first, tools collapsed.**

**Row 1: Stats bar**

- Larger numbers, bolder typography
- Stats: Sessions | Messages | Msgs/Week | Lines Added (green) | Removed (red) | Files | Commits
- `Msgs/Week = messageCount / (dayCount / 7)` computed at read time

**Row 2: Skills & Features (primary, always visible)**

- Header: "Skills & Features Used"
- Colored chip/badge for each detected skill
- e.g., `🔀 Parallel Agents` `🌳 Worktrees` `⚡ Custom Skills` `🎭 Playwright`
- Muted colors, small text, pill-shaped
- If `detectedSkills` is empty, hide this row entirely

**Row 3: Key pattern highlight**

- The one-liner from `interactionStyle.key_pattern` (derived at read time)
- Displayed in a slightly highlighted/quoted style with left border accent
- If missing, hide this row

**Row 4: Tool usage chart (secondary, collapsed by default)**

- Wrapped in a native `<details>` element with summary "Top Tools Used ▸"
- Horizontal bar chart rendered from `chartData.toolUsage`
- Top 5-6 tools, proportional bars with values
- If `chartData.toolUsage` is missing/empty, hide entirely
- **Rationale:** Bash is always at the top for everyone, so this is lower-value info than skills

#### 4b. Collapsible Sections

Each of the 8 content sections becomes a collapsible card:

**Header (always visible):**

- Section icon + section name (larger, bolder than current)
- **2-3 sentence summary** (see mapping below) — long enough to give real sense of what's inside
- Expand/collapse chevron

**Body (collapsed by default except "At a Glance"):**

- Full section content with improved typography
- Section-specific card layouts for structured content (project areas, friction categories, etc.)

**Section → summary mapping (2-3 sentences each):**

- At a Glance: always expanded, shows 4 sub-cards
- Interaction Style: first 2-3 sentences of `interaction_style.narrative`
- Project Areas: computed text like "{N} project areas across ~{total} sessions. Major projects include {top_2_names}."
- Impressive Workflows: full `at_a_glance.whats_working` text (already 2-3 sentences)
- Friction Analysis: full `at_a_glance.whats_hindering` text
- Suggestions: full `at_a_glance.quick_wins` text
- On the Horizon: full `at_a_glance.ambitious_workflows` text
- Fun Ending: the headline + first sentence of detail

**Fallback:** If a summary source is missing, show only the section name with no summary text.

#### 4c. Typography & Spacing

- Section headings: text-xl font-semibold (up from text-lg)
- Body text: text-base with leading-relaxed (up from text-sm)
- Card padding: p-6 (up from p-4/p-5)
- Section spacing: space-y-6 (up from space-y-4)

#### 4d. Mobile Behavior

- Snapshot card stacks vertically (stats → chart → badges → key pattern)
- Collapsible sections work the same on mobile
- Tool chart bars scale proportionally to container width
- Skills badges wrap to multiple rows

### 5. Data Flow

```
Upload HTML → Parse (cheerio) → Extract charts → Detect skills
    → User reviews (full content visible with readOnly SectionRenderer)
    → Redact → Publish
    → Store: sections + chartData + detectedSkills
    → Display: snapshot card + collapsible sections
```

### 6. Not in Scope

- Voice rewrite (second → third person) — dropped for complexity
- Twitter/X handle integration (P1 follow-up — grab from GitHub API `twitter_username` and `blog` fields during OAuth)
- Workflow diagram visualization (dropped — too speculative about accuracy)
- Response time and multi-clauding chart parsing (phase 2 — no UX defined yet)
- Dark mode adjustments (existing dark mode support carries forward)
- Comments/voting redesign (existing system unchanged)
