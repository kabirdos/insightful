import type { InsightsData, ChartData, SkillKey } from "@/types/insights";

/**
 * Collect all text content from parsed insights data into a single searchable string.
 */
function collectText(data: InsightsData): string {
  const parts: string[] = [];

  const walk = (obj: unknown): void => {
    if (typeof obj === "string") {
      parts.push(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (obj !== null && typeof obj === "object") {
      Object.values(obj).forEach(walk);
    }
  };

  walk(data);
  return parts.join(" ").toLowerCase();
}

interface SkillRule {
  key: SkillKey;
  textPatterns?: string[];
  toolPatterns?: string[];
}

const RULES: SkillRule[] = [
  {
    key: "parallel_agents",
    textPatterns: ["parallel agent", "parallel sub-agent", "agent workflow"],
    toolPatterns: ["TaskCreate"],
  },
  {
    key: "worktrees",
    textPatterns: ["worktree", "git worktree"],
  },
  {
    key: "custom_skills",
    textPatterns: ["skill.md", "custom skill", "slash command"],
  },
  {
    key: "hooks",
    textPatterns: [
      "pre-commit hook",
      "post-tool hook",
      "pre-tool hook",
      "hooks configured",
      "hook configured",
      "configured hooks",
    ],
  },
  {
    key: "mcp_servers",
    textPatterns: ["mcp server", "mcp "],
  },
  {
    key: "playwright",
    textPatterns: ["playwright", "browser test"],
  },
  {
    key: "headless_mode",
    textPatterns: [
      "headless mode",
      "headless claude",
      "non-interactive claude",
    ],
  },
  {
    key: "plan_mode",
    textPatterns: ["plan mode", "implementation plan"],
  },
  {
    key: "code_review",
    textPatterns: ["code review", "review agent", "codex cli review"],
  },
  {
    key: "subagents",
    textPatterns: ["subagent", "sub-agent"],
    toolPatterns: ["Agent"],
  },
];

/**
 * Scan parsed insights data and chart data for mentions of Claude Code features.
 * Returns an array of detected skill keys (deduplicated).
 */
export function detectSkills(
  data: InsightsData,
  chartData: ChartData,
): SkillKey[] {
  const text = collectText(data);
  const toolNames = new Set((chartData.toolUsage ?? []).map((t) => t.label));

  const detected = new Set<SkillKey>();

  for (const rule of RULES) {
    // Check text patterns
    if (rule.textPatterns) {
      for (const pattern of rule.textPatterns) {
        if (text.includes(pattern.toLowerCase())) {
          detected.add(rule.key);
          break;
        }
      }
    }

    // Check tool patterns (exact match on tool names)
    if (!detected.has(rule.key) && rule.toolPatterns) {
      for (const pattern of rule.toolPatterns) {
        if (toolNames.has(pattern)) {
          detected.add(rule.key);
          break;
        }
      }
    }
  }

  return Array.from(detected);
}
