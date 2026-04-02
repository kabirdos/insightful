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
  };
  data: InsightsData;
  detectedRedactions: RedactionItem[];
}
