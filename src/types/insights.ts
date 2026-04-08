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
  rawHourCounts?: Record<string, number>;
  multiClauding?: MultiClaudingStats;
  detectedSkills?: SkillKey[];
  reportType?: "insights" | "insight-harness";
  harnessData?: HarnessData;
}

// ── Harness Data (insight-harness reports) ──────────────────────────────

export interface HarnessStats {
  totalTokens: number;
  durationHours: number;
  avgSessionMinutes: number;
  skillsUsedCount: number;
  hooksCount: number;
  prCount: number;
}

export interface HarnessAutonomy {
  label: string;
  description: string;
  userMessages: number;
  assistantMessages: number;
  turnCount: number;
  errorRate: string;
}

export interface HarnessFeaturePill {
  name: string;
  active: boolean;
  value: string;
}

export interface HarnessSkillEntry {
  name: string;
  calls: number;
  source: string;
  description: string;
}

export interface HarnessHookDef {
  event: string;
  matcher: string;
  script: string;
}

export interface HarnessPlugin {
  name: string;
  version: string;
  marketplace: string;
  active: boolean;
}

export interface HarnessFileOpStyle {
  readPct: number;
  editPct: number;
  writePct: number;
  grepCount: number;
  globCount: number;
  style: string;
}

export interface HarnessAgentDispatch {
  totalAgents: number;
  types: Record<string, number>;
  models: Record<string, number>;
  backgroundPct: number;
  customAgents: string[];
}

export interface HarnessGitPatterns {
  prCount: number;
  commitCount: number;
  linesAdded: string;
  branchPrefixes: Record<string, number>;
}

export interface HarnessWriteupSection {
  title: string;
  contentHtml: string;
}

export interface HarnessData {
  stats: HarnessStats;
  autonomy: HarnessAutonomy;
  featurePills: HarnessFeaturePill[];
  toolUsage: Record<string, number>;
  skillInventory: HarnessSkillEntry[];
  hookDefinitions: HarnessHookDef[];
  hookFrequency: Record<string, number>;
  plugins: HarnessPlugin[];
  harnessFiles: string[];
  fileOpStyle: HarnessFileOpStyle;
  agentDispatch: HarnessAgentDispatch | null;
  cliTools: Record<string, number>;
  languages: Record<string, number>;
  models: Record<string, number>;
  permissionModes: Record<string, number>;
  mcpServers: Record<string, number>;
  gitPatterns: HarnessGitPatterns;
  versions: string[];
  writeupSections: HarnessWriteupSection[];
  integrityHash: string;
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
  responseTimeDistribution?: ChartDataPoint[];
  toolErrors?: ChartDataPoint[];
  whatHelpedMost?: ChartDataPoint[];
  outcomes?: ChartDataPoint[];
  frictionTypes?: ChartDataPoint[];
  satisfaction?: ChartDataPoint[];
  timeOfDay?: ChartDataPoint[];
}

export interface MultiClaudingStats {
  overlapEvents: number;
  sessionsInvolved: number;
  ofMessages: string;
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
    colorClass:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
  worktrees: {
    key: "worktrees",
    label: "Worktrees",
    icon: "🌳",
    colorClass:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  custom_skills: {
    key: "custom_skills",
    label: "Custom Skills",
    icon: "⚡",
    colorClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  hooks: {
    key: "hooks",
    label: "Hooks",
    icon: "🪝",
    colorClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  mcp_servers: {
    key: "mcp_servers",
    label: "MCP Servers",
    icon: "🔌",
    colorClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  playwright: {
    key: "playwright",
    label: "Playwright",
    icon: "🎭",
    colorClass:
      "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  },
  headless_mode: {
    key: "headless_mode",
    label: "Headless Mode",
    icon: "🤖",
    colorClass:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  plan_mode: {
    key: "plan_mode",
    label: "Plan Mode",
    icon: "📋",
    colorClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  code_review: {
    key: "code_review",
    label: "Code Review",
    icon: "📝",
    colorClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  subagents: {
    key: "subagents",
    label: "Subagents",
    icon: "🧩",
    colorClass:
      "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  },
};

/**
 * Type guard: returns true if the given value is a known SkillKey.
 * Use at any boundary where untrusted data (DB rows, API responses) enters
 * a context that expects a typed SkillKey.
 */
export function isSkillKey(value: unknown): value is SkillKey {
  return (
    typeof value === "string" &&
    (SKILL_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Normalize an unknown input (e.g. `string[]` from Prisma) into a clean
 * `SkillKey[]`, silently dropping any values that aren't recognized.
 * Returns an empty array for null/undefined/non-array inputs.
 */
export function normalizeSkills(raw: unknown): SkillKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSkillKey);
}

/**
 * Validate that an unknown value from the DB (Prisma Json?) looks like
 * HarnessData. Returns the typed value if it passes, or null if malformed.
 * Checks for the required top-level keys with correct types.
 */
export function normalizeHarnessData(raw: unknown): HarnessData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Check a few required structural keys to confirm it's HarnessData
  if (typeof obj.stats !== "object" || obj.stats === null) return null;
  if (typeof obj.autonomy !== "object" || obj.autonomy === null) return null;
  if (!Array.isArray(obj.featurePills)) return null;

  // Fill in defaults for optional/array fields that may be missing
  return {
    stats: obj.stats as HarnessData["stats"],
    autonomy: obj.autonomy as HarnessData["autonomy"],
    featurePills: obj.featurePills as HarnessData["featurePills"],
    toolUsage: (obj.toolUsage as Record<string, number>) ?? {},
    skillInventory: (obj.skillInventory as HarnessData["skillInventory"]) ?? [],
    hookDefinitions:
      (obj.hookDefinitions as HarnessData["hookDefinitions"]) ?? [],
    hookFrequency: (obj.hookFrequency as Record<string, number>) ?? {},
    plugins: (obj.plugins as HarnessData["plugins"]) ?? [],
    harnessFiles: (obj.harnessFiles as string[]) ?? [],
    fileOpStyle: (obj.fileOpStyle as HarnessData["fileOpStyle"]) ?? {
      readPct: 0,
      editPct: 0,
      writePct: 0,
      grepCount: 0,
      globCount: 0,
      style: "",
    },
    agentDispatch: (obj.agentDispatch as HarnessData["agentDispatch"]) ?? null,
    cliTools: (obj.cliTools as Record<string, number>) ?? {},
    languages: (obj.languages as Record<string, number>) ?? {},
    models: (obj.models as Record<string, number>) ?? {},
    permissionModes: (obj.permissionModes as Record<string, number>) ?? {},
    mcpServers: (obj.mcpServers as Record<string, number>) ?? {},
    gitPatterns: (obj.gitPatterns as HarnessData["gitPatterns"]) ?? {
      prCount: 0,
      commitCount: 0,
      linesAdded: "0",
      branchPrefixes: {},
    },
    versions: (obj.versions as string[]) ?? [],
    writeupSections:
      (obj.writeupSections as HarnessData["writeupSections"]) ?? [],
    integrityHash: (obj.integrityHash as string) ?? "",
  };
}
