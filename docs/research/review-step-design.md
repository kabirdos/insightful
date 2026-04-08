# Review Step Design for Insight-Harness Reports

Design document for the upload review step handling 120+ data points from insight-harness reports.

---

## 1. "Automagic" Non-Public Repo Button

### What it does

One-click removal of data that could identify non-public repositories. The button scans all parsed data, flags items likely tied to private/non-public repos, shows a confirmation diff, and strips them on confirm.

### Signals for non-public repos

| Signal                                               | Where it appears                                    | Confidence |
| ---------------------------------------------------- | --------------------------------------------------- | ---------- |
| No GitHub URL in project links                       | `projectLinks[].githubUrl`                          | Medium     |
| Local-only file paths (`~/Coding/...`, `/Users/...`) | `harnessFiles`, writeup narrative, `cliTools` paths | High       |
| Project area names that don't match any project link | `data.project_areas.areas[].name`                   | Medium     |
| Branch prefixes referencing internal project names   | `gitPatterns.branchPrefixes` keys                   | Medium     |
| Skill names containing repo-specific identifiers     | `skillInventory[].name`                             | Low        |
| Hook scripts with absolute paths                     | `hookDefinitions[].script`                          | High       |
| Custom agent names that reference projects           | `agentDispatch.customAgents[]`                      | Medium     |
| MCP server names that are project-specific           | `mcpServers` keys                                   | Low        |
| CLAUDE.md headings referencing projects              | New: `claudeMdSummaries[].heading`                  | Medium     |

### Data points containing repo-specific info to strip

These fields in `HarnessData` can leak non-public project information:

- `harnessFiles` -- contains file paths like `~/Coding/myproject/CLAUDE.md`
- `hookDefinitions[].script` -- may contain absolute paths
- `writeupSections[].contentHtml` -- narrative text references project names, paths, tool names
- `agentDispatch.customAgents[]` -- agent names may reference projects
- `gitPatterns.branchPrefixes` -- branch naming conventions can reveal project structure
- `cliTools` keys -- commands like `supabase`, `vercel` reveal stack but not private data; however specific project CLI tools could
- `skillInventory[].name` / `.description` -- custom skill names could identify projects
- NEW: `claudeMdSummaries` -- headings could reference project names

### UX Flow

```
[Automagic] button placement: top of the review step, above all section toggles

Click flow:
1. Button labeled "Auto-clean private data" with a sparkle icon
2. On click: scan runs client-side (< 100ms), produces a changeset
3. Modal appears: "Found N items that may reference private repos"
   - Grouped by category (file paths, project names, branch prefixes, etc.)
   - Each item shows: the text, where it was found, proposed action (redact/remove)
   - User can uncheck individual items
4. "Apply" button confirms; "Cancel" dismisses
5. After applying: affected section toggles show a badge "N items cleaned"
```

### Fallback when public/private status is unknown

Default stance: **treat as private**. If we cannot determine whether a repo is public (no GitHub URL provided, no API check), we flag it for removal. The user can always override and keep specific items.

Future enhancement: add a GitHub API check during upload that queries `GET /repos/:owner/:repo` -- if it returns 404 or 403, the repo is private. This requires the user's GitHub token (which we already have from OAuth).

---

## 2. New Data Sections for the Review Step

### Existing harness data points (already parsed and displayed)

These are already handled in `HarnessData` and shown via `HarnessSections.tsx`:

| Field                                                    | Current Review Control | Notes                                |
| -------------------------------------------------------- | ---------------------- | ------------------------------------ |
| `stats` (tokens, hours, avg session, skills, hooks, PRs) | Always shown           | No toggle -- aggregate stats         |
| `autonomy` (label, description, msgs, turns, error rate) | Always shown           | No toggle                            |
| `featurePills`                                           | Always shown           | Low privacy risk                     |
| `toolUsage`                                              | Section toggle         | Safe -- tool names are generic       |
| `skillInventory`                                         | Section toggle         | **Privacy risk**: custom skill names |
| `hookDefinitions`                                        | Section toggle         | **Privacy risk**: script paths       |
| `hookFrequency`                                          | Part of hooks section  | Safe                                 |
| `plugins`                                                | Section toggle         | Safe -- marketplace data             |
| `harnessFiles`                                           | Section toggle         | **High privacy risk**: file paths    |
| `fileOpStyle`                                            | Section toggle         | Safe -- ratios only                  |
| `agentDispatch`                                          | Section toggle         | **Medium risk**: custom agent names  |
| `cliTools`                                               | Section toggle         | Low risk -- command names            |
| `languages`                                              | Section toggle         | Safe                                 |
| `models`                                                 | Section toggle         | Safe                                 |
| `permissionModes`                                        | Section toggle         | Safe                                 |
| `mcpServers`                                             | Section toggle         | **Medium risk**: server names        |
| `gitPatterns`                                            | Section toggle         | **Medium risk**: branch prefixes     |
| `versions`                                               | Section toggle         | Safe                                 |
| `writeupSections`                                        | Section toggle         | **High risk**: narrative text        |
| `integrityHash`                                          | Never shown in UI      | Internal only                        |

### NEW data points to add

#### 2a. CLAUDE.md Section Summaries

```typescript
interface ClaudeMdSummary {
  scope: "global" | "project"; // global ~/.claude/CLAUDE.md or project-level
  headings: string[]; // e.g. ["# Git Workflow", "# Code Quality"]
  ruleCount: number; // approximate count of directive lines
  lineCount: number;
}
```

- **Tier**: 2 (collapsed, "dig in")
- **Review control**: Section toggle + individual heading redaction. Headings are the risky part -- they can name projects. Rule count/line count are safe aggregates.
- **Privacy**: MEDIUM. Headings like "# Acme Corp API Rules" reveal project identity. The automagic button should flag any heading containing words that match project area names.
- **Display format**: Card showing "Global CLAUDE.md: 45 lines, 6 sections" with expandable heading list. Project-level shown as count: "3 project CLAUDE.md files".

#### 2b. Harness Age (first session date)

```typescript
harnessAge: {
  firstSessionDate: string; // ISO date, e.g. "2025-11-15"
  totalDaysActive: number; // days between first and last session
}
```

- **Tier**: 1 (always visible -- tells visitors how experienced this user is)
- **Review control**: Simple toggle (on/off). No inline redaction needed.
- **Privacy**: LOW. A date is not identifying.
- **Display format**: "Using Claude Code since Nov 2025 (143 days)" in the stats bar.

#### 2c. Session Type Distribution

```typescript
sessionTypeDistribution: {
  testing: number; // percentage
  featureDev: number;
  exploration: number;
  git: number;
  orchestration: number;
}
```

- **Tier**: 2 (collapsed section with pie/bar chart)
- **Review control**: Section toggle. No individual item controls needed -- these are aggregate percentages.
- **Privacy**: LOW. Percentages reveal workflow style, not project details.
- **Display format**: Horizontal stacked bar or small donut chart. Labels: "Feature Dev 45% | Testing 25% | Exploration 15% | Git Ops 10% | Orchestration 5%"

#### 2d. Skill Allowed Tools

```typescript
// Extend existing HarnessSkillEntry
interface HarnessSkillEntry {
  name: string;
  calls: number;
  source: string;
  description: string;
  allowedTools: string[]; // NEW: e.g. ["Bash", "Read", "Write", "WebFetch"]
}
```

- **Tier**: 3 (hidden by default -- technical detail)
- **Review control**: Part of Skills section toggle. Shown as sub-detail when skills section is expanded.
- **Privacy**: LOW. Tool names are from a closed set.
- **Display format**: Pill badges under each skill row in the skills table.

#### 2e. Project Count and Diversity

```typescript
projectDiversity: {
  totalProjects: number; // from permissions_profile.projects_with_local_settings
  gen1Count: number; // CLAUDE.md only
  gen2Count: number; // AGENTS.md / agent/ bundle
  unconfiguredCount: number; // no Claude Code config files
  avgPermissionGrants: number; // from perm_accumulation
}
```

- **Tier**: 1 (interesting signal -- shows breadth of usage)
- **Review control**: Toggle on/off. No redaction needed -- purely numeric.
- **Privacy**: LOW. Counts only, no names.
- **Display format**: Stat cell in overview bar: "12 projects (8 configured)". Expandable detail: "5 Gen 1, 3 Gen 2, 4 unconfigured".

#### 2f. Prompt Interaction Patterns

```typescript
promptPatterns: {
  avgPromptLength: number; // words per user message (approximated)
  shortPromptRatio: number; // % of prompts under 20 words
  longPromptRatio: number; // % of prompts over 100 words
  autonomyRatio: number; // already exists as jsonl.autonomy_ratio
  medianTurnDurationSec: number; // already exists
  compactionEvents: number; // already exists
}
```

- **Tier**: 2 (interesting for power users studying workflow optimization)
- **Review control**: Section toggle. All aggregate numbers.
- **Privacy**: NONE. Pure statistics.
- **Display format**: Three-stat row: "Avg prompt: 42 words | Short prompts: 35% | Long prompts: 12%". Below: "Median turn: 18s | Compactions: 7"

#### 2g. Read-Before-Write Ratio

```typescript
readBeforeWriteRatio: number; // reads / (reads + writes), as percentage
```

- **Tier**: 2 (part of File Operation Style section)
- **Review control**: Part of existing fileOpStyle toggle.
- **Privacy**: NONE. A single ratio.
- **Display format**: Added to the existing File Operation Style card: "Read-before-write: 78% (surgical editor)"

#### 2h. Safety Posture

```typescript
safetyPosture: {
  label: string;                    // "Custom Safety Gate" or "Stock Permissions"
  skipDangerPrompt: boolean;
  hasSafetyHooks: boolean;
  safetyHookNames: string[];        // e.g. ["dcg", "validate_file_write.py"]
  universalDenyCount: number;
}
```

- **Tier**: 1 (visitors want to know if this is a battle-hardened setup)
- **Review control**: Toggle on/off. Safety hook names could be redacted individually if they reference project-specific scripts.
- **Privacy**: LOW. Script names are generic. The label is a classification.
- **Display format**: Badge next to autonomy label: "Custom Safety Gate" in green or "Stock Permissions" in neutral. Expandable: "3 safety hooks, 5 universal deny rules".

#### 2i. Memory Architecture

```typescript
memoryArch: {
  isDualLayer: boolean;
  inRepoMemoryCount: number;
  claudeManagedMemoryCount: number;
  totalAtoms: number;
  atomTypes: Record<string, number>; // feedback, project, reference, user
}
```

- **Tier**: 2 (interesting harness sophistication signal)
- **Review control**: Toggle on/off.
- **Privacy**: LOW. Counts only. Atom type names are from a closed set.
- **Display format**: "Dual-layer memory: 4 in-repo + 3 Claude-managed (12 atoms)". Expandable: atom type breakdown as mini bar chart.

#### 2j. IDE Integration & Hybrid Tools

```typescript
ideMode: "terminal-only" | "vs-code";
hybridTools: string[];   // e.g. ["Gemini CLI", "GitHub Copilot"]
```

- **Tier**: 2 (mildly interesting context)
- **Review control**: Toggle on/off.
- **Privacy**: NONE.
- **Display format**: Pills: "Terminal" or "VS Code". If hybrid tools present: "Also uses: Gemini CLI, Copilot".

#### 2k. Stats Cache (Usage Volume)

```typescript
usageVolume: {
  peakDayMessages: number;
  peakDayDate: string;
  avgDailyMessages: number;
  totalMessagesAllTime: number;
  daysTracked: number;
  cacheReadRatio: number; // how efficiently cache is used
}
```

- **Tier**: 1 (the "wow" numbers -- peak day, total volume)
- **Review control**: Toggle on/off. Dates could be toggled independently.
- **Privacy**: LOW. Aggregate usage stats.
- **Display format**: Highlight stat: "Peak day: 287 messages on Mar 15". Below: "Avg 45 msgs/day over 92 days tracked".

---

## 3. Data Tiering for Public Profile

### Tier 1: Always Visible (the "hook" -- top 20%)

These are what make a profile interesting at first glance. They answer: "How experienced is this person with Claude Code, and what's their style?"

| Data Point                       | Field                                      | Why Tier 1                                             |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| Autonomy label + ratio           | `autonomy.label`, `autonomy.description`   | Immediately tells the visitor the user's working style |
| Session count + duration         | `stats.totalTokens`, `stats.durationHours` | Scale of usage                                         |
| Token consumption                | `stats.totalTokens`                        | The single most impressive number                      |
| Harness age                      | NEW `harnessAge.firstSessionDate`          | Tenure signal                                          |
| Safety posture label             | NEW `safetyPosture.label`                  | Battle-hardened or stock?                              |
| Feature pills (active)           | `featurePills` (active only)               | Quick capability scan                                  |
| Project count                    | NEW `projectDiversity.totalProjects`       | Breadth                                                |
| Peak day stats                   | NEW `usageVolume.peakDayMessages`          | The "wow" stat                                         |
| Error rate                       | `autonomy.errorRate`                       | Reliability signal                                     |
| Detected skills (SkillKey pills) | `detectedSkills`                           | What Claude Code features they use                     |
| Key pattern                      | `interactionStyle.key_pattern`             | One-line summary                                       |

### Tier 2: Collapsed, "Dig In"

Visible on profile page behind disclosure toggles. Worth sharing but not attention-grabbing.

| Data Point                     | Field                         | Why Tier 2               |
| ------------------------------ | ----------------------------- | ------------------------ |
| Tool usage breakdown           | `toolUsage`                   | Interesting but dense    |
| Language distribution          | `languages`                   | Context, not a hook      |
| Model distribution             | `models`                      | Cost optimization signal |
| File operation style           | `fileOpStyle`                 | Workflow pattern         |
| Read-before-write ratio        | NEW `readBeforeWriteRatio`    | Sub-detail of file ops   |
| Session type distribution      | NEW `sessionTypeDistribution` | Interesting context      |
| CLI tools                      | `cliTools`                    | Tech stack signal        |
| Git patterns (branch prefixes) | `gitPatterns.branchPrefixes`  | Workflow pattern         |
| Permission modes               | `permissionModes`             | Configuration detail     |
| Prompt interaction patterns    | NEW `promptPatterns`          | Workflow optimization    |
| Memory architecture            | NEW `memoryArch`              | Harness sophistication   |
| CLAUDE.md summaries (headings) | NEW `claudeMdSummaries`       | Instruction structure    |
| IDE integration / hybrid tools | NEW `ideMode`, `hybridTools`  | Environment context      |
| Plugins (active list)          | `plugins`                     | Ecosystem participation  |
| MCP servers                    | `mcpServers`                  | Integration depth        |
| Versions                       | `versions`                    | Update cadence           |
| Writeup sections               | `writeupSections`             | Detailed narrative       |
| Chart data                     | `chartData`                   | Visual breakdown         |

### Tier 3: Hidden by Default, Opt-In

Only shown if user explicitly enables during review. These are personal/internal.

| Data Point                    | Field                                 | Why Tier 3                                |
| ----------------------------- | ------------------------------------- | ----------------------------------------- |
| Hook definitions (scripts)    | `hookDefinitions`                     | Can leak file paths and project structure |
| Hook frequency                | `hookFrequency`                       | Tied to hooks                             |
| Harness files (paths)         | `harnessFiles`                        | Direct file path exposure                 |
| Custom agent names            | `agentDispatch.customAgents`          | Could identify projects                   |
| Agent dispatch models/types   | `agentDispatch.types`, `.models`      | Detailed but low-interest                 |
| Skill allowed tools           | NEW `skillInventory[].allowedTools`   | Deep technical detail                     |
| Skill inventory (full table)  | `skillInventory`                      | Custom skill names may be identifying     |
| Git commit/PR counts          | `gitPatterns.prCount`, `.commitCount` | Can feel judgmental                       |
| Lines added                   | `gitPatterns.linesAdded`              | Can feel judgmental                       |
| Agent details (model tiering) | NEW from `agent_details`              | Internal strategy                         |
| Permission accumulation       | NEW from `perm_accumulation`          | Internal config                           |

### Tier 4: Never Shared

Data that exists in the upload/review step for the automagic feature and validation, but never reaches the database or public profile.

| Data Point                      | Field                                    | Why Tier 4                     |
| ------------------------------- | ---------------------------------------- | ------------------------------ |
| Integrity hash                  | `integrityHash`                          | Validation only                |
| Raw file paths                  | Any absolute path (`/Users/...`)         | PII                            |
| Email addresses                 | Detected by redaction engine             | PII                            |
| Settings.local.json contents    | `permissions_profile` raw data           | Per-project secrets            |
| Deny rules (text)               | `safety_posture.universal_denies`        | Could reveal security concerns |
| Plugin blocklist contradictions | `blocklist.contradictions`               | Internal config issue          |
| Team configs (hashed names)     | `team_configs`                           | Org-identifying                |
| Experimental env flags          | `experimental.experimental_flags`        | May contain secrets            |
| Full bash permission patterns   | `permissions_profile.bash_command_types` | Could reveal workflow secrets  |

---

## 4. Review Step Information Architecture

### Layout

The review step currently has four sub-steps: `upload` -> `redact` -> `projects` -> `preview`. The proposed design enriches the `redact` step and adds harness-specific controls.

```
+----------------------------------------------------------+
| STEP 2: Review & Redact                                  |
|                                                          |
| +------------------------------------------------------+ |
| | [Auto-clean private data]  [Redact All] [Keep All]   | |
| +------------------------------------------------------+ |
|                                                          |
| DETECTED SENSITIVE ITEMS (existing redaction engine)     |
| +------------------------------------------------------+ |
| | [eye] project-name   "acme-corp"     [Redact|Alias|Keep] |
| | [eye] file-path      "/Users/craig/..." [Redact|Alias|Keep] |
| | [eye] github-url     "github.com/..." [Redact|Alias|Keep] |
| +------------------------------------------------------+ |
|                                                          |
| REPORT SECTIONS                                          |
| [toggle] At a Glance           [on]                      |
| [toggle] Interaction Style     [on]                      |
| [toggle] Project Areas         [on]                      |
| [toggle] Impressive Workflows  [on]                      |
| [toggle] Friction Analysis     [on]                      |
| [toggle] Suggestions           [on]                      |
| [toggle] On the Horizon        [on]                      |
| [toggle] Fun Ending            [on]                      |
|                                                          |
| HARNESS DATA (only for insight-harness reports)          |
| ---- Tier 1: Profile Headline ----                       |
| [toggle] Harness Stats (tokens, hours, sessions)  [on]   |
| [toggle] Autonomy Profile                         [on]   |
| [toggle] Feature Pills                            [on]   |
| [toggle] Safety Posture                           [on]   |
| [toggle] Harness Age                              [on]   |
| [toggle] Peak Usage Stats                         [on]   |
|                                                          |
| ---- Tier 2: Detailed Breakdown ----                     |
| [toggle] Tool Usage                               [on]   |
| [toggle] Languages & Models                       [on]   |
| [toggle] File Operation Style                     [on]   |
| [toggle] Session Type Distribution                [on]   |
| [toggle] CLI Tools                                [on]   |
| [toggle] Prompt Patterns                          [on]   |
| [toggle] Memory Architecture                      [on]   |
| [toggle] CLAUDE.md Structure                      [on]   |
| [toggle] Plugins                                  [on]   |
| [toggle] MCP Servers                              [on]   |
| [toggle] Git Patterns                             [on]   |
| [toggle] Versions                                 [on]   |
| [toggle] Writeup Analysis                         [on]   |
|                                                          |
| ---- Tier 3: Opt-In (off by default) ----               |
| [toggle] Skills Inventory (custom skill names)    [OFF]  |
| [toggle] Hook Definitions (scripts & matchers)    [OFF]  |
| [toggle] Harness File Paths                       [OFF]  |
| [toggle] Agent Dispatch (custom agents)           [OFF]  |
| [toggle] Agent Details (model tiering)            [OFF]  |
| [toggle] Commit & PR Counts                       [OFF]  |
| [toggle] Permission Details                       [OFF]  |
|                                                          |
|                           [Next: Add Projects ->]        |
+----------------------------------------------------------+
```

### Section Ordering Rationale

1. **Auto-clean button** at the very top -- first action a user should consider.
2. **Sensitive items** (redaction list) next -- these are the most important decisions.
3. **Report sections** (insights narrative) -- familiar from current flow.
4. **Harness data** organized by tier -- Tier 1 (on by default, headline data), Tier 2 (on by default, detailed), Tier 3 (off by default, opt-in).

### Inline Redaction Controls vs Section Toggles

Two levels of control, working together:

- **Section toggles**: Binary on/off for entire data categories. When off, the entire section is stripped from the published report. This is the coarse control.
- **Inline redaction**: For sections that are ON, specific text values can be redacted or aliased. This is the fine control. Only applies to fields with privacy risk (skill names, hook scripts, agent names, branch prefixes, writeup narrative).

Implementation: the existing `RedactionItem` type handles inline redaction. Extend it to cover harness data fields:

```typescript
// Extend RedactionItem type to include harness section keys
type: "project_name" |
  "file_path" |
  "github_url" |
  "email" |
  "code_snippet" |
  "skill_name" |
  "hook_script" |
  "agent_name" |
  "branch_prefix" |
  "mcp_server" |
  "claude_md_heading";
```

### Real-Time Publish Preview

The current preview step (step 4) shows the full report as it will appear publicly. Changes should:

1. **Reflect immediately**: When a toggle is switched or a redaction is applied in step 2, the internal state updates. The preview in step 4 renders from this state.
2. **Diffing not needed**: The preview already renders from `parsed` + `redactions` + `disabledSections`. No separate diff computation needed.
3. **Consider a split-pane option**: On desktop (>1024px), show the review controls on the left and a live mini-preview on the right. This lets users see the impact of each toggle without navigating back and forth.

```
Desktop layout (>1024px):
+---------------------------+---------------------------+
| Review Controls           | Live Preview              |
| [toggles, redactions]     | [rendered profile card]   |
|                           | [updates in real-time]    |
+---------------------------+---------------------------+

Mobile layout:
[Review Controls]
[Next ->]
[Preview step shows full render]
```

---

## 5. Type System Updates Needed

### 5a. New fields on HarnessData (`src/types/insights.ts`)

```typescript
// Add to existing HarnessData interface
export interface HarnessData {
  // ... existing fields ...

  // NEW fields from enhanced skill
  claudeMdSummaries: ClaudeMdSummary[];
  harnessAge: HarnessAge | null;
  sessionTypeDistribution: SessionTypeDistribution | null;
  projectDiversity: ProjectDiversity | null;
  promptPatterns: PromptPatterns | null;
  readBeforeWriteRatio: number | null;
  safetyPosture: SafetyPosture | null;
  memoryArch: MemoryArchitecture | null;
  ideMode: "terminal-only" | "vs-code";
  hybridTools: string[];
  usageVolume: UsageVolume | null;
}

// NEW interfaces
export interface ClaudeMdSummary {
  scope: "global" | "project";
  headings: string[];
  ruleCount: number;
  lineCount: number;
}

export interface HarnessAge {
  firstSessionDate: string; // ISO date
  totalDaysActive: number;
}

export interface SessionTypeDistribution {
  testing: number;
  featureDev: number;
  exploration: number;
  git: number;
  orchestration: number;
}

export interface ProjectDiversity {
  totalProjects: number;
  gen1Count: number;
  gen2Count: number;
  unconfiguredCount: number;
  avgPermissionGrants: number;
}

export interface PromptPatterns {
  avgPromptLength: number;
  shortPromptRatio: number;
  longPromptRatio: number;
  compactionEvents: number;
}

export interface SafetyPosture {
  label: string;
  skipDangerPrompt: boolean;
  hasSafetyHooks: boolean;
  safetyHookNames: string[];
  universalDenyCount: number;
}

export interface MemoryArchitecture {
  isDualLayer: boolean;
  inRepoMemoryCount: number;
  claudeManagedMemoryCount: number;
  totalAtoms: number;
  atomTypes: Record<string, number>;
}

export interface UsageVolume {
  peakDayMessages: number;
  peakDayDate: string;
  avgDailyMessages: number;
  totalMessagesAllTime: number;
  daysTracked: number;
  cacheReadRatio: number;
}
```

### 5b. RedactionItem type extension

```typescript
export interface RedactionItem {
  id: string;
  text: string;
  type:
    | "project_name"
    | "file_path"
    | "github_url"
    | "email"
    | "code_snippet"
    | "skill_name"
    | "hook_script"
    | "agent_name"
    | "branch_prefix"
    | "mcp_server"
    | "claude_md_heading";
  context: string;
  sectionKey: string;
  action: "redact" | "alias" | "keep";
  alias?: string;
}
```

### 5c. Prisma schema changes

No new columns needed. The existing `harnessData Json?` column already stores all of `HarnessData` as a JSON blob. The new fields simply extend the JSON structure.

The `normalizeHarnessData()` function in `insights.ts` needs to be updated to provide defaults for the new fields:

```typescript
// Add to normalizeHarnessData return value:
claudeMdSummaries: (obj.claudeMdSummaries as HarnessData["claudeMdSummaries"]) ?? [],
harnessAge: (obj.harnessAge as HarnessData["harnessAge"]) ?? null,
sessionTypeDistribution: (obj.sessionTypeDistribution as HarnessData["sessionTypeDistribution"]) ?? null,
projectDiversity: (obj.projectDiversity as HarnessData["projectDiversity"]) ?? null,
promptPatterns: (obj.promptPatterns as HarnessData["promptPatterns"]) ?? null,
readBeforeWriteRatio: (obj.readBeforeWriteRatio as number) ?? null,
safetyPosture: (obj.safetyPosture as HarnessData["safetyPosture"]) ?? null,
memoryArch: (obj.memoryArch as HarnessData["memoryArch"]) ?? null,
ideMode: (obj.ideMode as HarnessData["ideMode"]) ?? "terminal-only",
hybridTools: (obj.hybridTools as string[]) ?? [],
usageVolume: (obj.usageVolume as HarnessData["usageVolume"]) ?? null,
```

### 5d. API route changes (`src/app/api/insights/route.ts`)

No new top-level fields to accept. The new data flows through the existing `harnessData` JSON field. The POST handler already accepts `harnessData` as an opaque JSON object and stores it directly.

### 5e. Harness parser changes (`src/lib/harness-parser.ts`)

The parser needs new extraction functions for each data point. These parse from the HTML report's data attributes or structured sections that the enhanced `extract.py` produces.

### 5f. Upload page changes (`src/app/upload/page.tsx`)

Add to `HARNESS_SECTION_OPTIONS`:

```typescript
{ key: "claudeMdSummaries", label: "CLAUDE.md Structure" },
{ key: "harnessAge", label: "Harness Age" },
{ key: "sessionTypeDistribution", label: "Session Types" },
{ key: "projectDiversity", label: "Project Diversity" },
{ key: "promptPatterns", label: "Prompt Patterns" },
{ key: "safetyPosture", label: "Safety Posture" },
{ key: "memoryArch", label: "Memory Architecture" },
{ key: "usageVolume", label: "Usage Volume" },
```

---

## Data Flow Summary

```
extract.py          harness-parser.ts      upload/page.tsx        API POST         DB (Json)        Detail page
  |                       |                     |                    |                |                |
  | Generates HTML        | Parses HTML to      | User toggles      | Strips disabled | Stored as      | normalizeHarnessData()
  | with all 120+         | HarnessData with    | sections on/off,  | sections,       | harnessData    | fills defaults,
  | data points in        | new fields          | applies redactions| applies text    | Json column    | components render
  | structured sections   |                     | via automagic or  | redactions      |                | by tier
  |                       |                     | manual controls   |                 |                |
  v                       v                     v                   v                 v                v
 HTML file ---------> ParsedInsightsReport -> Review Step ------> POST body ------> Prisma -------> Profile
                      .harnessData             with tier-based     .harnessData      .harnessData     HarnessOverview
                                               toggles + inline                                      HarnessSections
                                               redaction controls                                    (new components)
```

---

## Privacy Classification Summary

| Classification               | Data Points                                                                                                                                  | Rule                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| SAFE (no action needed)      | Stats, ratios, percentages, feature pills, models, languages, versions, tool names, IDE mode, permission mode names                          | Generic/aggregate data with no project identity                       |
| SCAN (automagic flags)       | Project area names, skill names, hook scripts, custom agent names, branch prefixes, MCP server names, CLAUDE.md headings, harness file paths | Could contain project-specific identifiers; automagic scans and flags |
| REDACT BY DEFAULT (Tier 3/4) | File paths, email addresses, GitHub URLs, writeup narrative text, deny rules, team configs, experimental flags, bash permission patterns     | Known PII or high risk of leaking internal information                |
| NEVER SHARE (Tier 4)         | Integrity hash, raw settings.local.json, blocklist contradictions, team config names                                                         | Internal validation or org-identifying data                           |
