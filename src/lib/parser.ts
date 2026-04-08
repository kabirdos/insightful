import * as cheerio from "cheerio";
import type {
  ParsedInsightsReport,
  InsightsData,
  ProjectArea,
  ImpressiveWorkflow,
  FrictionCategory,
  ClaudeMdAddition,
  FeatureToTry,
  UsagePattern,
  HorizonOpportunity,
} from "@/types/insights";

/**
 * Parse a Claude Code Insights HTML report into structured data.
 */
export function parseInsightsHtml(html: string): ParsedInsightsReport {
  const $ = cheerio.load(html);

  const stats = parseStats($);
  const data = parseData($);

  return {
    stats,
    data,
    detectedRedactions: [], // populated later by redaction engine
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function parseStats($: cheerio.CheerioAPI): ParsedInsightsReport["stats"] {
  const subtitle = $(".subtitle").text();

  // "1,268 messages across 102 sessions (126 total) | 2026-03-02 to 2026-04-02"
  const messageMatch = subtitle.match(/([\d,]+)\s+messages/);
  const sessionMatch = subtitle.match(/across\s+([\d,]+)\s+sessions/);
  const totalSessionMatch = subtitle.match(/\(([\d,]+)\s+total\)/);
  const dateRangeMatch = subtitle.match(
    /(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/,
  );

  // Extract commit count from the narrative or stats — the stats row may have
  // different stat labels. We look for stat blocks with specific labels.
  const statValues: Record<string, string> = {};
  $(".stat").each((_, el) => {
    const label = $(el).find(".stat-label").text().trim().toLowerCase();
    const value = $(el).find(".stat-value").text().trim();
    statValues[label] = value;
  });

  // Try to find commit count in the narrative text
  const narrativeText = $(".narrative").text();
  const commitMatch = narrativeText.match(/([\d,]+)\s+commits/);

  // Extract hours from stat values or compute from days
  const daysValue = statValues["days"] ?? "0";

  // Parse lines added/removed from "+69,951/-3,476" format
  const linesRaw = statValues["lines"] ?? "";
  const linesMatch = linesRaw.match(/\+?([\d,]+)\s*\/\s*-?([\d,]+)/);
  const linesAdded = linesMatch ? parseNumeric(linesMatch[1]) : null;
  const linesRemoved = linesMatch ? parseNumeric(linesMatch[2]) : null;

  // Parse file count, day count, msgs/day
  const fileCount = statValues["files"]
    ? parseNumeric(statValues["files"])
    : null;
  const dayCount = statValues["days"] ? parseNumeric(statValues["days"]) : null;
  const msgsPerDayRaw = statValues["msgs/day"] ?? "";
  const msgsPerDay = msgsPerDayRaw
    ? parseFloat(msgsPerDayRaw.replace(/,/g, "")) || null
    : null;

  return {
    sessionCount: parseNumeric(
      totalSessionMatch?.[1] ?? sessionMatch?.[1] ?? "0",
    ),
    analyzedCount: parseNumeric(sessionMatch?.[1] ?? "0"),
    messageCount: parseNumeric(messageMatch?.[1] ?? "0"),
    hours: daysValue, // report uses "Days" rather than hours
    commitCount: parseNumeric(commitMatch?.[1] ?? "0"),
    dateRangeStart: dateRangeMatch?.[1] ?? "",
    dateRangeEnd: dateRangeMatch?.[2] ?? "",
    linesAdded,
    linesRemoved,
    fileCount,
    dayCount,
    msgsPerDay,
  };
}

// ---------------------------------------------------------------------------
// Data sections
// ---------------------------------------------------------------------------

function parseData($: cheerio.CheerioAPI): InsightsData {
  return {
    at_a_glance: parseAtAGlance($),
    project_areas: { areas: parseProjectAreas($) },
    interaction_style: parseInteractionStyle($),
    what_works: parseWhatWorks($),
    friction_analysis: parseFrictionAnalysis($),
    suggestions: parseSuggestions($),
    on_the_horizon: parseOnTheHorizon($),
    fun_ending: parseFunEnding($),
  };
}

// ---------------------------------------------------------------------------
// At a Glance
// ---------------------------------------------------------------------------

function parseAtAGlance($: cheerio.CheerioAPI): InsightsData["at_a_glance"] {
  const sections: Record<string, string> = {
    whats_working: "",
    whats_hindering: "",
    quick_wins: "",
    ambitious_workflows: "",
  };

  // Map label prefixes to keys — handles variations like
  // "What's hindering you:" vs "What's hindering:"
  const keyPrefixes: [string, keyof typeof sections][] = [
    ["what's working", "whats_working"],
    ["what's hindering", "whats_hindering"],
    ["quick wins", "quick_wins"],
    ["ambitious workflows", "ambitious_workflows"],
  ];

  $(".at-a-glance .glance-section").each((_, el) => {
    const strong = $(el).find("strong").first().text().trim().toLowerCase();
    // Remove trailing colon and extra words
    const label = strong.replace(/:$/, "");

    // Get full text minus the "see more" link
    const clone = $(el).clone();
    clone.find(".see-more").remove();
    clone.find("strong").first().remove();
    const text = clone.text().trim();

    const match = keyPrefixes.find(([prefix]) => label.startsWith(prefix));
    if (match) {
      sections[match[1]] = text;
    }
  });

  return sections as InsightsData["at_a_glance"];
}

// ---------------------------------------------------------------------------
// Project Areas
// ---------------------------------------------------------------------------

function parseProjectAreas($: cheerio.CheerioAPI): ProjectArea[] {
  const areas: ProjectArea[] = [];

  $(".project-area").each((_, el) => {
    const name = $(el).find(".area-name").text().trim();
    const countText = $(el).find(".area-count").text().trim();
    const countMatch = countText.match(/(\d+)/);
    const description = $(el).find(".area-desc").text().trim();

    areas.push({
      name,
      session_count: countMatch ? parseInt(countMatch[1], 10) : 0,
      description,
    });
  });

  return areas;
}

// ---------------------------------------------------------------------------
// Interaction Style (How You Use Claude Code)
// ---------------------------------------------------------------------------

function parseInteractionStyle(
  $: cheerio.CheerioAPI,
): InsightsData["interaction_style"] {
  const narrative = $(".narrative p")
    .map((_, el) => $(el).text().trim())
    .get()
    .join("\n\n");

  const keyPattern = $(".key-insight").text().trim();

  return {
    narrative: narrative || "",
    key_pattern: keyPattern || "",
  };
}

// ---------------------------------------------------------------------------
// What Works (Impressive Things)
// ---------------------------------------------------------------------------

function parseWhatWorks($: cheerio.CheerioAPI): InsightsData["what_works"] {
  const introEl = $("h2#section-wins").next(".section-intro");
  const intro = introEl.text().trim();

  const workflows: ImpressiveWorkflow[] = [];
  $(".big-win").each((_, el) => {
    workflows.push({
      title: $(el).find(".big-win-title").text().trim(),
      description: $(el).find(".big-win-desc").text().trim(),
    });
  });

  return {
    intro,
    impressive_workflows: workflows,
  };
}

// ---------------------------------------------------------------------------
// Friction Analysis
// ---------------------------------------------------------------------------

function parseFrictionAnalysis(
  $: cheerio.CheerioAPI,
): InsightsData["friction_analysis"] {
  const introEl = $("h2#section-friction").next(".section-intro");
  const intro = introEl.text().trim();

  const categories: FrictionCategory[] = [];
  $(".friction-category").each((_, el) => {
    const examples: string[] = [];
    $(el)
      .find(".friction-examples li")
      .each((_, li) => {
        examples.push($(li).text().trim());
      });

    categories.push({
      category: $(el).find(".friction-title").text().trim(),
      description: $(el).find(".friction-desc").text().trim(),
      examples,
    });
  });

  return { intro, categories };
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function parseSuggestions($: cheerio.CheerioAPI): InsightsData["suggestions"] {
  // CLAUDE.md additions
  const claudeMdAdditions: ClaudeMdAddition[] = [];
  $(".claude-md-item").each((_, el) => {
    const checkbox = $(el).find(".cmd-checkbox");
    const dataText = checkbox.attr("data-text") ?? "";
    const code = $(el).find(".cmd-code").text().trim();
    const why = $(el).find(".cmd-why").text().trim();

    claudeMdAdditions.push({
      addition: code,
      why,
      prompt_scaffold: dataText,
    });
  });

  // Features to try
  const featuresToTry: FeatureToTry[] = [];
  $(".feature-card").each((_, el) => {
    const exampleCode = $(el).find(".example-code").text().trim();

    featuresToTry.push({
      feature: $(el).find(".feature-title").text().trim(),
      one_liner: $(el).find(".feature-oneliner").text().trim(),
      why_for_you: $(el).find(".feature-why").text().trim(),
      example_code: exampleCode,
    });
  });

  // Usage patterns
  const usagePatterns: UsagePattern[] = [];
  $(".pattern-card").each((_, el) => {
    usagePatterns.push({
      title: $(el).find(".pattern-title").text().trim(),
      suggestion: $(el).find(".pattern-summary").text().trim(),
      detail: $(el).find(".pattern-detail").text().trim(),
      copyable_prompt: $(el).find(".copyable-prompt").text().trim(),
    });
  });

  return {
    claude_md_additions: claudeMdAdditions,
    features_to_try: featuresToTry,
    usage_patterns: usagePatterns,
  };
}

// ---------------------------------------------------------------------------
// On the Horizon
// ---------------------------------------------------------------------------

function parseOnTheHorizon(
  $: cheerio.CheerioAPI,
): InsightsData["on_the_horizon"] {
  const introEl = $("h2#section-horizon").next(".section-intro");
  const intro = introEl.text().trim();

  const opportunities: HorizonOpportunity[] = [];
  $(".horizon-card").each((_, el) => {
    const promptCode = $(el).find(".pattern-prompt code").text().trim();

    opportunities.push({
      title: $(el).find(".horizon-title").text().trim(),
      whats_possible: $(el).find(".horizon-possible").text().trim(),
      how_to_try: $(el).find(".horizon-tip").text().trim(),
      copyable_prompt: promptCode,
    });
  });

  return { intro, opportunities };
}

// ---------------------------------------------------------------------------
// Fun Ending
// ---------------------------------------------------------------------------

function parseFunEnding($: cheerio.CheerioAPI): InsightsData["fun_ending"] {
  return {
    headline: $(".fun-headline").text().trim(),
    detail: $(".fun-detail").text().trim(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNumeric(s: string): number {
  return parseInt(s.replace(/,/g, ""), 10) || 0;
}
