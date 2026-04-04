export interface InsightsData {
  project_areas: {
    areas: ProjectArea[];
  };
  interaction_style: {
    narrative: string;
    key_pattern: string;
  };
  what_works: {
    intro: string;
    impressive_workflows: ImpressiveWorkflow[];
  };
  friction_analysis: {
    intro: string;
    categories: FrictionCategory[];
  };
  suggestions: {
    claude_md_additions: ClaudeMdAddition[];
    features_to_try: FeatureToTry[];
    usage_patterns: UsagePattern[];
  };
  on_the_horizon: {
    intro: string;
    opportunities: HorizonOpportunity[];
  };
  fun_ending: {
    headline: string;
    detail: string;
  };
  at_a_glance: {
    whats_working: string;
    whats_hindering: string;
    quick_wins: string;
    ambitious_workflows: string;
  };
}

export interface ProjectArea {
  name: string;
  session_count: number;
  description: string;
}

export interface ImpressiveWorkflow {
  title: string;
  description: string;
}

export interface FrictionCategory {
  category: string;
  description: string;
  examples: string[];
}

export interface ClaudeMdAddition {
  addition: string;
  why: string;
  prompt_scaffold: string;
}

export interface FeatureToTry {
  feature: string;
  one_liner: string;
  why_for_you: string;
  example_code: string;
}

export interface UsagePattern {
  title: string;
  suggestion: string;
  detail: string;
  copyable_prompt: string;
}

export interface HorizonOpportunity {
  title: string;
  whats_possible: string;
  how_to_try: string;
  copyable_prompt: string;
}

export interface RedactionItem {
  id: string;
  text: string;
  type: "project_name" | "file_path" | "github_url" | "email" | "code_snippet";
  context: string;
  sectionKey: string;
  action: "redact" | "alias" | "keep";
  alias?: string;
}

export interface ParsedInsightsReport {
  stats: {
    sessionCount: number;
    analyzedCount: number;
    messageCount: number;
    hours: string;
    commitCount: number;
    dateRangeStart: string;
    dateRangeEnd: string;
    linesAdded?: number | null;
    linesRemoved?: number | null;
    fileCount?: number | null;
    dayCount?: number | null;
    msgsPerDay?: number | null;
  };
  data: InsightsData;
  detectedRedactions: RedactionItem[];
  chartData?: ChartData;
  detectedSkills?: SkillKey[];
}

// v2: Chart data parsed from HTML report
export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartData {
  toolUsage?: ChartDataPoint[];
  requestTypes?: ChartDataPoint[];
  languages?: ChartDataPoint[];
  sessionTypes?: ChartDataPoint[];
}

// v2: Closed set of detectable Claude Code skills/features
export const SKILL_KEYS = [
  "parallel_agents",
  "worktrees",
  "custom_skills",
  "hooks",
  "mcp_servers",
  "playwright",
  "headless_mode",
  "plan_mode",
  "code_review",
  "subagents",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export interface SkillMetadata {
  key: SkillKey;
  label: string;
  icon: string;
  colorClass: string;
}

export const SKILL_METADATA: Record<SkillKey, SkillMetadata> = {
  parallel_agents: {
    key: "parallel_agents",
    label: "Parallel Agents",
    icon: "🔀",
    colorClass: "bg-violet-100 text-violet-700",
  },
  worktrees: {
    key: "worktrees",
    label: "Worktrees",
    icon: "🌳",
    colorClass: "bg-green-100 text-green-700",
  },
  custom_skills: {
    key: "custom_skills",
    label: "Custom Skills",
    icon: "⚡",
    colorClass: "bg-amber-100 text-amber-700",
  },
  hooks: {
    key: "hooks",
    label: "Hooks",
    icon: "🪝",
    colorClass: "bg-sky-100 text-sky-700",
  },
  mcp_servers: {
    key: "mcp_servers",
    label: "MCP Servers",
    icon: "🔌",
    colorClass: "bg-slate-100 text-slate-700",
  },
  playwright: {
    key: "playwright",
    label: "Playwright",
    icon: "🎭",
    colorClass: "bg-pink-100 text-pink-700",
  },
  headless_mode: {
    key: "headless_mode",
    label: "Headless Mode",
    icon: "🤖",
    colorClass: "bg-indigo-100 text-indigo-700",
  },
  plan_mode: {
    key: "plan_mode",
    label: "Plan Mode",
    icon: "📋",
    colorClass: "bg-emerald-100 text-emerald-700",
  },
  code_review: {
    key: "code_review",
    label: "Code Review",
    icon: "📝",
    colorClass: "bg-red-100 text-red-700",
  },
  subagents: {
    key: "subagents",
    label: "Subagents",
    icon: "🧩",
    colorClass: "bg-teal-100 text-teal-700",
  },
};
