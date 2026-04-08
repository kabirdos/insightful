# Mermaid Workflow Diagrams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workflow visualization to harness profiles by extracting tool transition and phase sequence data from JSONL sessions, then rendering interactive Mermaid state diagrams and flow charts on the report page.

**Architecture:** Part 1 extends the Python extraction script (`extract.py`) to track tool-to-tool transitions and classify tool runs into workflow phases (exploration, implementation, testing, shipping), counting transitions between phases. This data is emitted as new HTML sections in the harness report. Part 2 extends the TypeScript types, HTML parser, and React frontend to parse these sections and render them as client-side Mermaid diagrams — a state diagram for phase transitions and a flow diagram for tool transition patterns.

**Tech Stack:** Python 3 (extract.py), Mermaid.js (CDN), Next.js/React, cheerio (parser), Tailwind CSS, Vitest

---

### Task 1: Add tool transition tracking to extract.py

**Files:**

- Modify: `~/.claude/skills/insight-harness/scripts/extract.py` (lines 300-598, `extract_jsonl_metadata()`)

The extraction function already iterates through JSONL entries and tracks `tool_name` for each `tool_use` block. We add a `tool_transitions` Counter that tracks pairs like `"Read->Edit": 45`. Transitions reset on user messages (turn boundaries).

- [ ] **Step 1: Add tool_transitions Counter and prev_tool tracker**

At the top of `extract_jsonl_metadata()` (around line 301), add new tracking variables alongside the existing counters:

```python
    # Tool transition tracking (tool A -> tool B within a turn)
    tool_transitions = Counter()
    prev_tool_in_turn = None  # reset on user message boundaries
```

- [ ] **Step 2: Record transitions inside the tool_use processing block**

Inside the `if item.get("type") == "tool_use":` block (around line 397-450), after `tool_usage[tool_name] += 1`, add transition tracking:

```python
                                    # Tool transition tracking
                                    if prev_tool_in_turn is not None:
                                        transition_key = f"{prev_tool_in_turn}->{tool_name}"
                                        tool_transitions[transition_key] += 1
                                    prev_tool_in_turn = tool_name
```

- [ ] **Step 3: Reset prev_tool on user messages**

Inside the `elif entry_type == "user":` block (around line 453), alongside the existing `recent_reads = False` reset, add:

```python
                            # Reset tool transition tracking on new user turn
                            prev_tool_in_turn = None
```

- [ ] **Step 4: Add tool_transitions to the return dict**

In the return dict at the end of `extract_jsonl_metadata()` (around line 548-598), add:

```python
        # Tool transitions (top 30 most common A->B pairs)
        "tool_transitions": dict(tool_transitions.most_common(30)),
```

- [ ] **Step 5: Verify**

```bash
python3 ~/.claude/skills/insight-harness/scripts/extract.py 2>&1 | head -5
# Should output the HTML file path without errors
```

**Commit message:** `feat: add tool transition tracking to extract.py`

---

### Task 2: Add phase classification and phase transition tracking to extract.py

**Files:**

- Modify: `~/.claude/skills/insight-harness/scripts/extract.py` (lines 300-598, `extract_jsonl_metadata()`)

Phases classify runs of consecutive tools into workflow stages. Each tool call is mapped to a phase, and we track transitions between phases (e.g., "exploration->implementation"). We also compute phase statistics.

- [ ] **Step 1: Add phase mapping function above extract_jsonl_metadata()**

Add this function before `extract_jsonl_metadata()` (around line 298):

```python
def _classify_tool_phase(tool_name, cmd_name=None):
    """Classify a tool call into a workflow phase.

    Phases:
    - exploration: Read, Grep, Glob, WebSearch, WebFetch
    - implementation: Edit, Write, NotebookEdit
    - testing: Bash with test commands (pytest, jest, vitest, etc.)
    - shipping: Bash with git/gh commands
    - orchestration: Agent, Skill, TaskCreate, TaskUpdate
    - other: everything else (Bash with non-classified commands, etc.)
    """
    EXPLORATION_TOOLS = {"Read", "Grep", "Glob", "WebSearch", "WebFetch", "ToolSearch"}
    IMPLEMENTATION_TOOLS = {"Edit", "Write", "NotebookEdit"}
    ORCHESTRATION_TOOLS = {"Agent", "Skill", "TaskCreate", "TaskUpdate", "EnterPlanMode"}
    TEST_COMMANDS = {"pytest", "jest", "vitest", "mocha", "rspec", "test", "cargo"}
    SHIP_COMMANDS = {"git", "gh"}

    if tool_name in EXPLORATION_TOOLS:
        return "exploration"
    if tool_name in IMPLEMENTATION_TOOLS:
        return "implementation"
    if tool_name in ORCHESTRATION_TOOLS:
        return "orchestration"
    if tool_name == "Bash" and cmd_name:
        if cmd_name in TEST_COMMANDS:
            return "testing"
        if cmd_name in SHIP_COMMANDS:
            return "shipping"
    return "other"
```

- [ ] **Step 2: Add phase tracking variables inside extract_jsonl_metadata()**

At the top of `extract_jsonl_metadata()`, after the tool_transitions variables:

```python
    # Phase transition tracking
    phase_transitions = Counter()  # "exploration->implementation": 23
    prev_phase_in_turn = None
    phase_call_counts = Counter()  # total tool calls per phase

    # Per-session phase sequences for aggregate stats
    session_phase_sequences = []  # list of per-session phase lists
```

Add a per-session tracker inside the session loop (after `session_tools = Counter()`, around line 369):

```python
            session_phases_seen = []  # ordered list of phases for this session
```

- [ ] **Step 3: Track phases inside the tool_use block**

After the tool transition tracking code added in Task 1, add phase classification. This goes inside the `if item.get("type") == "tool_use":` block, after the transition tracking:

```python
                                    # Phase classification
                                    _cmd_name_for_phase = None
                                    if tool_name == "Bash":
                                        _cmd_name_for_phase = extract_safe_command_name(
                                            item.get("input", {}).get("command", "")
                                        )
                                    current_phase = _classify_tool_phase(tool_name, _cmd_name_for_phase)
                                    phase_call_counts[current_phase] += 1

                                    # Phase transitions (within a turn)
                                    if prev_phase_in_turn is not None and prev_phase_in_turn != current_phase:
                                        phase_transitions[f"{prev_phase_in_turn}->{current_phase}"] += 1
                                    prev_phase_in_turn = current_phase

                                    # Record phase for session-level sequence
                                    if not session_phases_seen or session_phases_seen[-1] != current_phase:
                                        session_phases_seen.append(current_phase)
```

- [ ] **Step 4: Reset phase tracking on user messages**

In the `elif entry_type == "user":` block, alongside `prev_tool_in_turn = None`:

```python
                            prev_phase_in_turn = None
```

- [ ] **Step 5: Collect session phase sequences after session processing**

After the session type classification block (around line 538, after `session_type_counts["mixed"] += 1`), add:

```python
                if session_phases_seen:
                    session_phase_sequences.append(session_phases_seen)
```

- [ ] **Step 6: Compute phase statistics and add to return dict**

Before the return statement (around line 540), compute stats:

```python
    # Phase statistics
    total_phase_calls = sum(phase_call_counts.values()) or 1
    phase_pcts = {k: round(v / total_phase_calls * 100) for k, v in phase_call_counts.most_common()}

    # Session-level phase pattern stats
    sessions_that_test_before_ship = 0
    sessions_that_explore_before_implement = 0
    for seq in session_phase_sequences:
        if "testing" in seq and "shipping" in seq:
            if seq.index("testing") < seq.index("shipping"):
                sessions_that_test_before_ship += 1
        if "exploration" in seq and "implementation" in seq:
            if seq.index("exploration") < seq.index("implementation"):
                sessions_that_explore_before_implement += 1

    total_with_phases = len(session_phase_sequences) or 1
    test_before_ship_pct = round(sessions_that_test_before_ship / total_with_phases * 100)
    explore_before_impl_pct = round(sessions_that_explore_before_implement / total_with_phases * 100)
```

In the return dict, add:

```python
        # Phase transitions (top 20 most common phase->phase pairs)
        "phase_transitions": dict(phase_transitions.most_common(20)),
        # Phase call distribution (percentage per phase)
        "phase_distribution": phase_pcts,
        # Phase pattern stats
        "phase_stats": {
            "test_before_ship_pct": test_before_ship_pct,
            "explore_before_impl_pct": explore_before_impl_pct,
            "total_sessions_with_phases": len(session_phase_sequences),
        },
```

- [ ] **Step 7: Verify**

```bash
python3 ~/.claude/skills/insight-harness/scripts/extract.py 2>&1 | head -5
```

**Commit message:** `feat: add phase classification and transition tracking to extract.py`

---

### Task 3: Add workflow data to the HTML output in extract.py

**Files:**

- Modify: `~/.claude/skills/insight-harness/scripts/extract.py` (the `generate_html()` function, around line 1572)

We add two new HTML sections to the dashboard tab: "Workflow Phases" and "Tool Transitions". These use specific CSS classes so the parser can find them.

- [ ] **Step 1: Read the new data in generate_html()**

In `generate_html()`, after the existing variable unpacking (around line 1619, after `cli_tools = jsonl.get("cli_tools", {})`), add:

```python
    tool_transitions = jsonl.get("tool_transitions", {})
    phase_transitions = jsonl.get("phase_transitions", {})
    phase_distribution = jsonl.get("phase_distribution", {})
    phase_stats = jsonl.get("phase_stats", {})
```

- [ ] **Step 2: Generate Workflow Phases HTML section**

Before the HTML injection point for the "Tool Usage" section (find `<!-- TIER 3: Context & Background -->` around line 2013), add the workflow sections. Insert this block of Python before the f-string HTML, or construct the HTML strings in the function body before the main f-string:

```python
    # Workflow Phases HTML
    phase_dist_items = "".join(
        f'<div class="kv-row"><span class="mono">{he(phase)}</span><span class="meta">{pct_val}%</span></div>'
        for phase, pct_val in sorted(phase_distribution.items(), key=lambda x: x[1], reverse=True)
    ) if phase_distribution else ""

    phase_trans_items = "".join(
        f'<div class="bar-row"><div class="bar-label">{he(k)}</div>'
        f'<div class="bar-track"><div class="bar-fill" style="width:{bar_width(v, max(phase_transitions.values()) if phase_transitions else 1)};background:var(--purple)"></div></div>'
        f'<div class="bar-value">{v}</div></div>'
        for k, v in sorted(phase_transitions.items(), key=lambda x: x[1], reverse=True)[:12]
    ) if phase_transitions else ""

    tool_trans_items = "".join(
        f'<div class="bar-row"><div class="bar-label">{he(k)}</div>'
        f'<div class="bar-track"><div class="bar-fill" style="width:{bar_width(v, max(tool_transitions.values()) if tool_transitions else 1)};background:var(--teal)"></div></div>'
        f'<div class="bar-value">{v}</div></div>'
        for k, v in sorted(tool_transitions.items(), key=lambda x: x[1], reverse=True)[:15]
    ) if tool_transitions else ""
```

- [ ] **Step 3: Insert HTML sections into the template**

In the f-string HTML, before `<!-- TIER 3: Context & Background -->`, add:

```html
<!-- Workflow Phases -->
<section>
  <div class="section-header">
    <h2>Workflow Phases</h2>
    <span class="count"
      >{phase_stats.get("total_sessions_with_phases", 0)} sessions
      analyzed</span
    >
  </div>
  <div class="two-col">
    <div>
      <h3>Phase Distribution</h3>
      {phase_dist_items or '
      <p class="empty">No data</p>
      '}
    </div>
    <div>
      <h3>Phase Transitions</h3>
      {phase_trans_items or '
      <p class="empty">No data</p>
      '}
    </div>
  </div>
  <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-top:1rem">
    <div class="meta">
      <strong style="color:var(--ink)"
        >{phase_stats.get("explore_before_impl_pct", 0)}%</strong
      >
      explore before implementing
    </div>
    <div class="meta">
      <strong style="color:var(--ink)"
        >{phase_stats.get("test_before_ship_pct", 0)}%</strong
      >
      test before shipping
    </div>
  </div>
</section>

<!-- Tool Transitions -->
<section>
  <div class="section-header">
    <h2>Tool Transitions</h2>
    <span class="count">{sum(tool_transitions.values())} transitions</span>
  </div>
  {tool_trans_items or '
  <p class="empty">No data</p>
  '}
</section>
```

- [ ] **Step 4: Verify by generating a report and checking for the new sections**

```bash
REPORT=$(python3 ~/.claude/skills/insight-harness/scripts/extract.py)
grep -c "Workflow Phases" "$REPORT"
grep -c "Tool Transitions" "$REPORT"
# Both should output 1
```

**Commit message:** `feat: add workflow phases and tool transitions HTML sections to harness report`

---

### Task 4: Update SKILL.md with new data documentation

**Files:**

- Modify: `~/.claude/skills/insight-harness/SKILL.md`

- [ ] **Step 1: Add workflow data to "What You Get" section**

Under the `### New data sections` heading (around line 77), add:

```markdown
- **Workflow phases** — classifies tool usage into phases (exploration, implementation, testing, shipping, orchestration) and shows the distribution across sessions
- **Phase transitions** — tracks how you move between workflow phases (e.g., exploration -> implementation), with statistics on disciplined patterns like "test before ship"
- **Tool transitions** — tracks sequential tool usage patterns within turns (e.g., Read -> Edit), showing your most common tool flows
```

- [ ] **Step 2: Add to privacy whitelist**

Under `### What IS read:` (around line 36), add:

```markdown
- Tool transition sequences (which tool follows which — tool names only, no arguments)
- Workflow phase classifications derived from tool names and command first-tokens
```

- [ ] **Step 3: Verify SKILL.md is valid**

```bash
head -20 ~/.claude/skills/insight-harness/SKILL.md
```

**Commit message:** `docs: document workflow phases and tool transitions in SKILL.md`

---

### Task 5: Add new types to HarnessData in insights.ts

**Files:**

- Modify: `src/types/insights.ts`

- [ ] **Step 1: Add new interfaces**

After the `HarnessWriteupSection` interface (around line 191), add:

```typescript
export interface HarnessPhaseStats {
  testBeforeShipPct: number;
  exploreBeforeImplPct: number;
  totalSessionsWithPhases: number;
}

export interface HarnessWorkflowData {
  toolTransitions: Record<string, number>;
  phaseTransitions: Record<string, number>;
  phaseDistribution: Record<string, number>;
  phaseStats: HarnessPhaseStats;
}
```

- [ ] **Step 2: Add workflowData to HarnessData interface**

In the `HarnessData` interface (around line 194-215), add after `writeupSections`:

```typescript
workflowData: HarnessWorkflowData | null;
```

- [ ] **Step 3: Update normalizeHarnessData()**

In `normalizeHarnessData()` (around line 364-410), add to the return object before `integrityHash`:

```typescript
    workflowData: (obj.workflowData as HarnessData["workflowData"]) ?? null,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/craigdossantos/Coding/insightful && npx tsc --noEmit 2>&1 | head -20
```

**Commit message:** `feat: add HarnessWorkflowData types for phase and tool transitions`

---

### Task 6: Update harness-parser.ts to parse new HTML sections

**Files:**

- Modify: `src/lib/harness-parser.ts`

- [ ] **Step 1: Add import for new types**

Update the import at the top (line 6-13) to include the new types:

```typescript
import type {
  HarnessData,
  HarnessStats,
  HarnessAutonomy,
  HarnessFeaturePill,
  HarnessSkillEntry,
  HarnessHookDef,
  HarnessPlugin,
  HarnessFileOpStyle,
  HarnessAgentDispatch,
  HarnessGitPatterns,
  HarnessWriteupSection,
  HarnessWorkflowData,
  HarnessPhaseStats,
} from "@/types/insights";
```

- [ ] **Step 2: Add parseWorkflowData() function**

Before the `// Helpers` section (around line 490), add:

```typescript
// ---------------------------------------------------------------------------
// Workflow Data (Phases & Tool Transitions)
// ---------------------------------------------------------------------------

function parseWorkflowData($: cheerio.CheerioAPI): HarnessWorkflowData | null {
  const phaseSection = findSectionByTitle($, "Workflow Phases");
  const transSection = findSectionByTitle($, "Tool Transitions");

  if (!phaseSection && !transSection) return null;

  // Parse phase distribution from kv-rows
  const phaseDistribution: Record<string, number> = {};
  if (phaseSection) {
    phaseSection.find(".kv-row").each((_, el) => {
      const key = $(el).find(".mono").text().trim();
      const valText = $(el).find(".meta").text().trim();
      const numMatch = valText.match(/(\d+)/);
      if (key && numMatch) {
        phaseDistribution[key] = parseInt(numMatch[1], 10);
      }
    });
  }

  // Parse phase transitions from bar chart rows
  const phaseTransitions: Record<string, number> = {};
  if (phaseSection) {
    // Phase transitions are in the second column of the two-col layout
    const columns = phaseSection.find(".two-col > div");
    if (columns.length >= 2) {
      $(columns[1])
        .find(".bar-row")
        .each((_, el) => {
          const label = $(el).find(".bar-label").text().trim();
          const value = $(el).find(".bar-value").text().trim();
          if (label) {
            phaseTransitions[label] = parseNumericValue(value);
          }
        });
    }
  }

  // Parse tool transitions from bar chart rows
  const toolTransitions: Record<string, number> = {};
  if (transSection) {
    transSection.find(".bar-row").each((_, el) => {
      const label = $(el).find(".bar-label").text().trim();
      const value = $(el).find(".bar-value").text().trim();
      if (label) {
        toolTransitions[label] = parseNumericValue(value);
      }
    });
  }

  // Parse phase stats from meta elements
  const phaseStats: HarnessPhaseStats = {
    testBeforeShipPct: 0,
    exploreBeforeImplPct: 0,
    totalSessionsWithPhases: 0,
  };

  if (phaseSection) {
    phaseSection.find(".meta").each((_, el) => {
      const text = $(el).text().trim();
      const strongVal = $(el).find("strong").text().trim();
      if (text.includes("explore before")) {
        phaseStats.exploreBeforeImplPct = parseInt(strongVal, 10) || 0;
      } else if (text.includes("test before")) {
        phaseStats.testBeforeShipPct = parseInt(strongVal, 10) || 0;
      }
    });

    // Total sessions from section header count
    const countText = phaseSection.find(".section-header .count").text().trim();
    const countMatch = countText.match(/(\d+)/);
    if (countMatch) {
      phaseStats.totalSessionsWithPhases = parseInt(countMatch[1], 10);
    }
  }

  return {
    toolTransitions,
    phaseTransitions,
    phaseDistribution,
    phaseStats,
  };
}
```

- [ ] **Step 3: Wire parseWorkflowData into parseHarnessHtml()**

In `parseHarnessHtml()` (around line 27-52), add to the return object after `writeupSections`:

```typescript
    workflowData: parseWorkflowData($),
```

- [ ] **Step 4: Verify**

```bash
cd /Users/craigdossantos/Coding/insightful && npx tsc --noEmit 2>&1 | head -20
```

**Commit message:** `feat: parse workflow phases and tool transitions from harness HTML`

---

### Task 7: Create WorkflowDiagram component (Mermaid state diagram)

**Files:**

- Create: `src/components/WorkflowDiagram.tsx`

This component renders a Mermaid state diagram showing phase transitions with probabilities.

- [ ] **Step 1: Create the component**

```typescript
// src/components/WorkflowDiagram.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { HarnessWorkflowData } from "@/types/insights";

interface WorkflowDiagramProps {
  workflowData: HarnessWorkflowData;
}

// Phase display names and colors
const PHASE_META: Record<string, { label: string; color: string }> = {
  exploration: { label: "Exploration", color: "#3b82f6" },
  implementation: { label: "Implementation", color: "#22c55e" },
  testing: { label: "Testing", color: "#f59e0b" },
  shipping: { label: "Shipping", color: "#8b5cf6" },
  orchestration: { label: "Orchestration", color: "#06b6d4" },
  other: { label: "Other", color: "#94a3b8" },
};

function buildStateDiagram(workflowData: HarnessWorkflowData): string {
  const { phaseTransitions, phaseDistribution } = workflowData;

  // Only include phases that have data
  const activePhases = Object.keys(phaseDistribution).filter(
    (p) => phaseDistribution[p] > 0,
  );

  if (activePhases.length === 0) return "";

  const lines: string[] = ["stateDiagram-v2"];

  // Define states with display names
  for (const phase of activePhases) {
    const meta = PHASE_META[phase] || { label: phase, color: "#94a3b8" };
    lines.push(`    ${phase} : ${meta.label} (${phaseDistribution[phase]}%)`);
  }

  // Add transitions with counts
  const totalTransitions = Object.values(phaseTransitions).reduce(
    (a, b) => a + b,
    0,
  );

  if (totalTransitions > 0) {
    // Sort transitions by count descending, show top 10
    const sorted = Object.entries(phaseTransitions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [key, count] of sorted) {
      const [from, to] = key.split("->");
      if (from && to && activePhases.includes(from) && activePhases.includes(to)) {
        const pct = Math.round((count / totalTransitions) * 100);
        lines.push(`    ${from} --> ${to} : ${pct}%`);
      }
    }
  }

  // Add start state pointing to most common phase
  const topPhase = activePhases.sort(
    (a, b) => (phaseDistribution[b] || 0) - (phaseDistribution[a] || 0),
  )[0];
  if (topPhase) {
    lines.push(`    [*] --> ${topPhase}`);
  }

  return lines.join("\n");
}

export default function WorkflowDiagram({ workflowData }: WorkflowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [mermaidLoaded, setMermaidLoaded] = useState(false);

  // Load Mermaid.js from CDN
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already loaded
    if ((window as unknown as Record<string, unknown>).mermaid) {
      setMermaidLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.async = true;
    script.onload = () => {
      const mermaid = (window as unknown as Record<string, unknown>).mermaid as {
        initialize: (config: Record<string, unknown>) => void;
      };
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        stateDiagram: {
          useMaxWidth: true,
        },
      });
      setMermaidLoaded(true);
    };
    script.onerror = () => setError(true);
    document.head.appendChild(script);
  }, []);

  // Render diagram when mermaid is loaded
  useEffect(() => {
    if (!mermaidLoaded || !containerRef.current) return;

    const diagram = buildStateDiagram(workflowData);
    if (!diagram) {
      setError(true);
      return;
    }

    const mermaid = (window as unknown as Record<string, unknown>).mermaid as {
      render: (
        id: string,
        definition: string,
      ) => Promise<{ svg: string }>;
    };

    const id = `mermaid-state-${Date.now()}`;
    mermaid
      .render(id, diagram)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch(() => setError(true));
  }, [mermaidLoaded, workflowData]);

  if (error) return null;

  const { phaseStats } = workflowData;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Workflow Phases
        </h3>
        <span className="text-xs text-slate-400">
          {phaseStats.totalSessionsWithPhases} sessions analyzed
        </span>
      </div>

      {/* Mermaid diagram container */}
      <div
        ref={containerRef}
        className="flex min-h-[200px] items-center justify-center overflow-x-auto [&_svg]:max-w-full"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>

      {/* Phase stats summary */}
      <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {phaseStats.exploreBeforeImplPct}%
          </span>{" "}
          explore before implementing
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {phaseStats.testBeforeShipPct}%
          </span>{" "}
          test before shipping
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/craigdossantos/Coding/insightful && npx tsc --noEmit 2>&1 | head -20
```

**Commit message:** `feat: add WorkflowDiagram component with Mermaid state diagram`

---

### Task 8: Create ToolTransitionFlow component (Mermaid flow diagram)

**Files:**

- Create: `src/components/ToolTransitionFlow.tsx`

This component renders a Mermaid flowchart showing the most common tool-to-tool transitions.

- [ ] **Step 1: Create the component**

```typescript
// src/components/ToolTransitionFlow.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { HarnessWorkflowData } from "@/types/insights";

interface ToolTransitionFlowProps {
  workflowData: HarnessWorkflowData;
}

function buildFlowDiagram(toolTransitions: Record<string, number>): string {
  const entries = Object.entries(toolTransitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12); // top 12 transitions

  if (entries.length === 0) return "";

  const totalTransitions = entries.reduce((sum, [, count]) => sum + count, 0);
  const lines: string[] = ["flowchart LR"];

  // Collect unique tools
  const tools = new Set<string>();
  for (const [key] of entries) {
    const [from, to] = key.split("->");
    if (from) tools.add(from);
    if (to) tools.add(to);
  }

  // Define tool nodes with rounded boxes
  for (const tool of tools) {
    lines.push(`    ${tool.replace(/[^a-zA-Z0-9]/g, "_")}(${tool})`);
  }

  // Add edges with percentage labels
  for (const [key, count] of entries) {
    const [from, to] = key.split("->");
    if (!from || !to) continue;
    const fromId = from.replace(/[^a-zA-Z0-9]/g, "_");
    const toId = to.replace(/[^a-zA-Z0-9]/g, "_");
    const pct = Math.round((count / totalTransitions) * 100);
    // Use thicker lines for more common transitions
    if (pct >= 15) {
      lines.push(`    ${fromId} ==>|${pct}%| ${toId}`);
    } else if (pct >= 5) {
      lines.push(`    ${fromId} -->|${pct}%| ${toId}`);
    } else {
      lines.push(`    ${fromId} -.->|${pct}%| ${toId}`);
    }
  }

  return lines.join("\n");
}

export default function ToolTransitionFlow({
  workflowData,
}: ToolTransitionFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [mermaidLoaded, setMermaidLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as unknown as Record<string, unknown>).mermaid) {
      setMermaidLoaded(true);
      return;
    }
    // Wait for mermaid to be loaded by WorkflowDiagram or load it
    const check = setInterval(() => {
      if ((window as unknown as Record<string, unknown>).mermaid) {
        setMermaidLoaded(true);
        clearInterval(check);
      }
    }, 100);
    // Fallback: load it ourselves after 2s
    const timeout = setTimeout(() => {
      if ((window as unknown as Record<string, unknown>).mermaid) return;
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
      script.async = true;
      script.onload = () => {
        const mermaid = (window as unknown as Record<string, unknown>)
          .mermaid as {
          initialize: (config: Record<string, unknown>) => void;
        };
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
        });
        setMermaidLoaded(true);
      };
      script.onerror = () => setError(true);
      document.head.appendChild(script);
    }, 2000);
    return () => {
      clearInterval(check);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!mermaidLoaded || !containerRef.current) return;

    const diagram = buildFlowDiagram(workflowData.toolTransitions);
    if (!diagram) {
      setError(true);
      return;
    }

    const mermaid = (window as unknown as Record<string, unknown>).mermaid as {
      render: (
        id: string,
        definition: string,
      ) => Promise<{ svg: string }>;
    };

    const id = `mermaid-flow-${Date.now()}`;
    mermaid
      .render(id, diagram)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch(() => setError(true));
  }, [mermaidLoaded, workflowData]);

  if (error || Object.keys(workflowData.toolTransitions).length === 0)
    return null;

  const totalTransitions = Object.values(
    workflowData.toolTransitions,
  ).reduce((a, b) => a + b, 0);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Tool Transition Flow
        </h3>
        <span className="text-xs text-slate-400">
          {totalTransitions.toLocaleString()} transitions
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-[180px] items-center justify-center overflow-x-auto [&_svg]:max-w-full"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/craigdossantos/Coding/insightful && npx tsc --noEmit 2>&1 | head -20
```

**Commit message:** `feat: add ToolTransitionFlow component with Mermaid flowchart`

---

### Task 9: Add workflow diagrams to the report page

**Files:**

- Modify: `src/app/insights/[slug]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of the file (around line 30), add:

```typescript
import WorkflowDiagram from "@/components/WorkflowDiagram";
import ToolTransitionFlow from "@/components/ToolTransitionFlow";
```

- [ ] **Step 2: Add the components to the harness report layout**

In the harness report section (inside `{isHarness && report.harnessData ? ( ... )}`), add the workflow diagrams after the `<ToolUsageTreemap>` component and before the `<SkillCardGrid>` component (around line 416). Find this block:

```typescript
          {/* Tool Usage Treemap */}
          {Object.keys(report.harnessData.toolUsage).length > 0 && (
            <ToolUsageTreemap toolUsage={report.harnessData.toolUsage} />
          )}

          {/* Skills Card Grid */}
```

And insert between them:

```typescript
          {/* Workflow Diagrams */}
          {report.harnessData.workflowData && (
            <>
              <WorkflowDiagram workflowData={report.harnessData.workflowData} />
              <ToolTransitionFlow workflowData={report.harnessData.workflowData} />
            </>
          )}
```

- [ ] **Step 3: Verify it compiles and renders**

```bash
cd /Users/craigdossantos/Coding/insightful && npx tsc --noEmit 2>&1 | head -20
```

Then manually verify by navigating to a harness report page in the browser.

**Commit message:** `feat: add workflow diagrams to harness report page`

---

### Task 10: Add eye toggle for workflow section in the edit page

**Files:**

- Modify: `src/app/insights/[slug]/edit/page.tsx`

- [ ] **Step 1: Add imports**

At the top (around line 10), add:

```typescript
import WorkflowDiagram from "@/components/WorkflowDiagram";
import ToolTransitionFlow from "@/components/ToolTransitionFlow";
```

- [ ] **Step 2: Add workflow toggle to the harness section preview**

In the harness preview section (after `<SkillCardGrid>`, around line 321), add:

```typescript
          {harnessData.workflowData && (
            <div className={hiddenSections["workflowData"] ? "opacity-40" : ""}>
              <div className="mb-1 flex items-center gap-2">
                <EyeToggle
                  enabled={!hiddenSections["workflowData"]}
                  onToggle={() => toggleSection("workflowData")}
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Workflow Diagrams
                </span>
                {hiddenSections["workflowData"] && (
                  <span className="text-xs text-red-500">Will be removed</span>
                )}
              </div>
              {!hiddenSections["workflowData"] && (
                <>
                  <WorkflowDiagram workflowData={harnessData.workflowData} />
                  <ToolTransitionFlow workflowData={harnessData.workflowData} />
                </>
              )}
            </div>
          )}
```

- [ ] **Step 3: Handle workflowData in buildSaveBody()**

In `buildSaveBody()` (around line 133-150), add handling for the workflow section:

```typescript
// Handle workflow data visibility
if (hiddenSections["workflowData"] && report?.harnessData) {
  // Set workflowData to null inside harnessData
  body.harnessData = {
    ...report.harnessData,
    workflowData: null,
  };
}
```

- [ ] **Step 4: Verify**

```bash
cd /Users/craigdossantos/Coding/insightful && npx tsc --noEmit 2>&1 | head -20
```

**Commit message:** `feat: add workflow diagram eye toggle to edit page`

---

### Task 11: Tests

**Files:**

- Create: `src/lib/__tests__/harness-parser-workflow.test.ts`
- Create: `src/components/__tests__/WorkflowDiagram.test.tsx`

- [ ] **Step 1: Create parser test for workflow data extraction**

```typescript
// src/lib/__tests__/harness-parser-workflow.test.ts
import { describe, it, expect } from "vitest";
import { parseHarnessHtml } from "@/lib/harness-parser";

const MOCK_HTML = `
<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
<div class="stats-grid">
  <div class="stat"><div class="stat-value">10</div><div class="stat-label">Sessions</div></div>
  <div class="stat"><div class="stat-value">1.2M</div><div class="stat-label">Tokens</div></div>
  <div class="stat"><div class="stat-value">24h</div><div class="stat-label">Duration</div></div>
  <div class="stat"><div class="stat-value">45m</div><div class="stat-label">Avg Session</div></div>
  <div class="stat"><div class="stat-value">3</div><div class="stat-label">Skills Used</div></div>
  <div class="stat"><div class="stat-value">2</div><div class="stat-label">Hooks</div></div>
  <div class="stat"><div class="stat-value">0</div><div class="stat-label">PRs</div></div>
  <div class="stat"><div class="stat-value">5</div><div class="stat-label">Commits</div></div>
</div>
<div class="autonomy-box">
  <div class="autonomy-label">Directive</div>
  <div class="autonomy-desc">test</div>
  <div class="autonomy-stats">
    <div class="autonomy-stat"><strong>50</strong> user msgs</div>
    <div class="autonomy-stat"><strong>200</strong> assistant msgs</div>
    <div class="autonomy-stat"><strong>100</strong> turns measured</div>
    <div class="autonomy-stat"><strong>2%</strong> error rate</div>
  </div>
</div>
<div class="pills"></div>

<section>
  <div class="section-header"><h2>Workflow Phases</h2><span class="count">8 sessions analyzed</span></div>
  <div class="two-col">
    <div>
      <h3>Phase Distribution</h3>
      <div class="kv-row"><span class="mono">exploration</span><span class="meta">40%</span></div>
      <div class="kv-row"><span class="mono">implementation</span><span class="meta">35%</span></div>
      <div class="kv-row"><span class="mono">testing</span><span class="meta">15%</span></div>
      <div class="kv-row"><span class="mono">shipping</span><span class="meta">10%</span></div>
    </div>
    <div>
      <h3>Phase Transitions</h3>
      <div class="bar-row"><div class="bar-label">exploration->implementation</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">23</div></div>
      <div class="bar-row"><div class="bar-label">implementation->testing</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">15</div></div>
      <div class="bar-row"><div class="bar-label">testing->shipping</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">8</div></div>
    </div>
  </div>
  <div style="display:flex;gap:1.5rem">
    <div class="meta"><strong>75%</strong> explore before implementing</div>
    <div class="meta"><strong>60%</strong> test before shipping</div>
  </div>
</section>

<section>
  <div class="section-header"><h2>Tool Transitions</h2><span class="count">120 transitions</span></div>
  <div class="bar-row"><div class="bar-label">Read->Edit</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">45</div></div>
  <div class="bar-row"><div class="bar-label">Grep->Read</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">30</div></div>
  <div class="bar-row"><div class="bar-label">Edit->Bash</div><div class="bar-track"><div class="bar-fill"></div></div><div class="bar-value">25</div></div>
</section>

<script type="application/json" id="insight-harness-integrity">{"hash":"test123"}</script>
</body>
</html>
`;

describe("harness-parser workflow data", () => {
  it("parses workflow phases section", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData).not.toBeNull();
    expect(result.workflowData!.phaseDistribution).toEqual({
      exploration: 40,
      implementation: 35,
      testing: 15,
      shipping: 10,
    });
  });

  it("parses phase transitions", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.phaseTransitions).toEqual({
      "exploration->implementation": 23,
      "implementation->testing": 15,
      "testing->shipping": 8,
    });
  });

  it("parses tool transitions", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.toolTransitions).toEqual({
      "Read->Edit": 45,
      "Grep->Read": 30,
      "Edit->Bash": 25,
    });
  });

  it("parses phase stats", () => {
    const result = parseHarnessHtml(MOCK_HTML);
    expect(result.workflowData!.phaseStats.exploreBeforeImplPct).toBe(75);
    expect(result.workflowData!.phaseStats.testBeforeShipPct).toBe(60);
    expect(result.workflowData!.phaseStats.totalSessionsWithPhases).toBe(8);
  });

  it("returns null workflowData when sections are missing", () => {
    const minimalHtml = `
      <!DOCTYPE html><html><body>
      <div class="stats-grid">
        <div class="stat"><div class="stat-value">1</div><div class="stat-label">Sessions</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Tokens</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Duration</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Avg Session</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Skills Used</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Hooks</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">PRs</div></div>
        <div class="stat"><div class="stat-value">0</div><div class="stat-label">Commits</div></div>
      </div>
      <div class="autonomy-box">
        <div class="autonomy-label">Test</div>
        <div class="autonomy-desc">test</div>
      </div>
      <div class="pills"></div>
      <script type="application/json" id="insight-harness-integrity">{"hash":"x"}</script>
      </body></html>
    `;
    const result = parseHarnessHtml(minimalHtml);
    expect(result.workflowData).toBeNull();
  });
});
```

- [ ] **Step 2: Create component smoke test**

```typescript
// src/components/__tests__/WorkflowDiagram.test.tsx
import { describe, it, expect, vi } from "vitest";
import type { HarnessWorkflowData } from "@/types/insights";

// Test the diagram builder logic without DOM/mermaid
// We import the module to verify it compiles and exports correctly
describe("WorkflowDiagram", () => {
  it("module exports default component", async () => {
    const mod = await import("@/components/WorkflowDiagram");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});

describe("ToolTransitionFlow", () => {
  it("module exports default component", async () => {
    const mod = await import("@/components/ToolTransitionFlow");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/craigdossantos/Coding/insightful && npx vitest run --reporter=verbose 2>&1 | tail -30
```

**Commit message:** `test: add tests for workflow data parsing and diagram components`

---

## Summary of Changes

### Part 1: Harness Skill (extract.py)

| Task | Description                        | Files        |
| ---- | ---------------------------------- | ------------ |
| 1    | Tool transition Counter            | `extract.py` |
| 2    | Phase classification + transitions | `extract.py` |
| 3    | HTML output sections               | `extract.py` |
| 4    | SKILL.md docs                      | `SKILL.md`   |

### Part 2: App Integration

| Task | Description                  | Files                                             |
| ---- | ---------------------------- | ------------------------------------------------- |
| 5    | TypeScript types             | `src/types/insights.ts`                           |
| 6    | HTML parser                  | `src/lib/harness-parser.ts`                       |
| 7    | WorkflowDiagram component    | `src/components/WorkflowDiagram.tsx`              |
| 8    | ToolTransitionFlow component | `src/components/ToolTransitionFlow.tsx`           |
| 9    | Report page integration      | `src/app/insights/[slug]/page.tsx`                |
| 10   | Edit page eye toggle         | `src/app/insights/[slug]/edit/page.tsx`           |
| 11   | Tests                        | `src/lib/__tests__/`, `src/components/__tests__/` |

### Dependency order

Tasks 1-4 (Python) are independent of Tasks 5-11 (TypeScript) and can be parallelized. Within each group:

- Part 1: 1 -> 2 -> 3 -> 4 (sequential)
- Part 2: 5 -> 6 -> 7+8 (parallel) -> 9+10 (parallel) -> 11
