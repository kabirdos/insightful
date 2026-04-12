import * as cheerio from "cheerio";
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

/**
 * Detect whether an HTML string is an insight-harness report (vs plain /insights).
 * Checks for the integrity manifest script tag unique to harness reports.
 */
export function isHarnessReport(html: string): boolean {
  return html.includes('id="insight-harness-integrity"');
}

/**
 * Parse an insight-harness HTML report into structured HarnessData.
 */
export function parseHarnessHtml(html: string): HarnessData {
  const $ = cheerio.load(html);

  return {
    stats: parseHarnessStats($),
    autonomy: parseAutonomy($),
    featurePills: parseFeaturePills($),
    toolUsage: parseBarChart($, "Tool Usage"),
    skillInventory: parseSkillInventory($),
    hookDefinitions: parseHookDefinitions($),
    hookFrequency: parseBarChart($, "Hook Execution Frequency"),
    plugins: parsePlugins($),
    harnessFiles: parseHarnessFiles($),
    fileOpStyle: parseFileOpStyle($),
    agentDispatch: parseAgentDispatch($),
    cliTools: parseBarChart($, "CLI Tools"),
    languages: parseBarChart($, "Languages"),
    models: parseBarChart($, "Models"),
    permissionModes: parseKvSection($, "Permission Modes"),
    mcpServers: parseKvSection($, "MCP Servers"),
    gitPatterns: parseGitPatterns($),
    versions: parseVersionTags($, "Claude Code Versions"),
    writeupSections: parseWriteupSections($),
    workflowData: parseWorkflowData($),
    integrityHash: parseIntegrityHash($),
    skillVersion: parseSkillVersion($),
  };
}

// ---------------------------------------------------------------------------
// Stats Grid
// ---------------------------------------------------------------------------

function parseHarnessStats($: cheerio.CheerioAPI): HarnessStats {
  const statValues: Record<string, string> = {};
  $(".stats-grid .stat").each((_, el) => {
    const label = $(el).find(".stat-label").text().trim().toLowerCase();
    const value = $(el).find(".stat-value").text().trim();
    statValues[label] = value;
  });

  return {
    totalTokens: parseNumericValue(statValues["tokens"] ?? "0"),
    durationHours:
      parseInt(statValues["duration"]?.replace(/h$/i, "") ?? "0", 10) || 0,
    avgSessionMinutes:
      parseFloat(statValues["avg session"]?.replace(/m$/i, "") ?? "0") || 0,
    skillsUsedCount: parseInt(statValues["skills used"] ?? "0", 10) || 0,
    hooksCount: parseInt(statValues["hooks"] ?? "0", 10) || 0,
    prCount: parseInt(statValues["prs"] ?? "0", 10) || 0,
    sessionCount: parseInt(statValues["sessions"] ?? "0", 10) || 0,
    commitCount: parseInt(statValues["commits"] ?? "0", 10) || 0,
  };
}

// ---------------------------------------------------------------------------
// Autonomy Box
// ---------------------------------------------------------------------------

function parseAutonomy($: cheerio.CheerioAPI): HarnessAutonomy {
  const box = $(".autonomy-box");
  const label = box.find(".autonomy-label").text().trim();
  const desc = box.find(".autonomy-desc").text().trim();

  const stats: Record<string, string> = {};
  box.find(".autonomy-stat").each((_, el) => {
    const text = $(el).text().trim();
    const strong = $(el).find("strong").text().trim();
    // "1234 user msgs" -> key="user msgs", value="1234"
    const remainder = text.replace(strong, "").trim();
    stats[remainder] = strong;
  });

  return {
    label,
    description: desc,
    userMessages: parseInt(stats["user msgs"] ?? "0", 10) || 0,
    assistantMessages: parseInt(stats["assistant msgs"] ?? "0", 10) || 0,
    turnCount: parseInt(stats["turns measured"] ?? "0", 10) || 0,
    errorRate: Object.keys(stats).find((k) => k.includes("error"))
      ? stats[Object.keys(stats).find((k) => k.includes("error"))!]
      : "0%",
  };
}

// ---------------------------------------------------------------------------
// Feature Pills
// ---------------------------------------------------------------------------

function parseFeaturePills($: cheerio.CheerioAPI): HarnessFeaturePill[] {
  const pills: HarnessFeaturePill[] = [];
  $(".pills .pill").each((_, el) => {
    const text = $(el).text().trim();
    const active = $(el).hasClass("on");
    // "Task Agents (12%)" -> name="Task Agents", value="12%"
    const match = text.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      pills.push({ name: match[1].trim(), active, value: match[2].trim() });
    } else {
      pills.push({ name: text, active, value: "" });
    }
  });
  return pills;
}

// ---------------------------------------------------------------------------
// Bar Charts (Tool Usage, CLI Tools, Languages, Models)
// ---------------------------------------------------------------------------

function parseBarChart(
  $: cheerio.CheerioAPI,
  sectionTitle: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  const section = findSectionByTitle($, sectionTitle);
  if (!section) return result;

  section.find(".bar-row").each((_, el) => {
    const label = $(el).find(".bar-label").text().trim();
    const value = $(el).find(".bar-value").text().trim();
    if (label) {
      result[label] = parseNumericValue(value);
    }
  });

  return result;
}

// ---------------------------------------------------------------------------
// Skills Inventory
// ---------------------------------------------------------------------------

function parseSkillInventory($: cheerio.CheerioAPI): HarnessSkillEntry[] {
  const skills: HarnessSkillEntry[] = [];
  const section = findSectionByTitle($, "Skills");
  if (!section) return skills;

  section.find("tbody tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 2) return;

    const nameCell = cells.eq(0);
    const name = nameCell.find(".mono.accent").text().trim();
    const calls = parseInt(cells.eq(1).text().trim(), 10) || 0;

    // Determine source from badge
    let source = "unknown";
    const badge = nameCell.find(".badge");
    if (badge.hasClass("custom")) source = "custom";
    else if (badge.hasClass("plugin")) source = "plugin";

    const description = nameCell.find(".meta").text().trim();

    if (name) {
      skills.push({ name, calls, source, description });
    }
  });

  return skills;
}

// ---------------------------------------------------------------------------
// Hook Definitions
// ---------------------------------------------------------------------------

function parseHookDefinitions($: cheerio.CheerioAPI): HarnessHookDef[] {
  const hooks: HarnessHookDef[] = [];
  const section = findSectionByTitle($, "Hooks");
  if (!section) return hooks;

  section.find("tbody tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 3) return;
    const event = cells.eq(0).text().trim();
    const matcher = cells.eq(1).text().trim();
    const script = cells.eq(2).text().trim();
    if (event && !cells.eq(0).hasClass("empty")) {
      hooks.push({ event, matcher, script });
    }
  });

  return hooks;
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

function parsePlugins($: cheerio.CheerioAPI): HarnessPlugin[] {
  const plugins: HarnessPlugin[] = [];
  $(".plugin-card").each((_, el) => {
    const name = $(el).find(".plugin-name").text().trim();
    const badge = $(el).find(".badge");
    const active = badge.hasClass("active");
    const meta = $(el).find(".meta").text().trim();
    // "v1.0.3 · compound-engineering"
    const versionMatch = meta.match(/^v([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : "";
    const marketplace = meta.replace(/^v[\d.]+\s*·\s*/, "").trim();

    if (name) {
      plugins.push({ name, version, marketplace, active });
    }
  });
  return plugins;
}

// ---------------------------------------------------------------------------
// Harness Files
// ---------------------------------------------------------------------------

function parseHarnessFiles($: cheerio.CheerioAPI): string[] {
  const files: string[] = [];
  const section = findSectionByTitle($, "Harness File Ecosystem");
  if (!section) return files;

  section.find(".file-item").each((_, el) => {
    const text = $(el).text().trim();
    if (text) files.push(text);
  });
  return files;
}

// ---------------------------------------------------------------------------
// File Operation Style
// ---------------------------------------------------------------------------

function parseFileOpStyle($: cheerio.CheerioAPI): HarnessFileOpStyle {
  const section = findSectionByTitle($, "File Operation Style");
  if (!section) {
    return {
      readPct: 0,
      editPct: 0,
      writePct: 0,
      grepCount: 0,
      globCount: 0,
      style: "",
    };
  }

  const donutItems = section.find(".donut-item");
  let readPct = 0,
    editPct = 0,
    writePct = 0,
    grepCount = 0,
    globCount = 0;
  let style = "";

  donutItems.each((i, el) => {
    const ratio = $(el).find(".ratio").text().trim();
    const label = $(el).find(".label").text().trim().toLowerCase();

    if (
      label.includes("read") &&
      label.includes("edit") &&
      label.includes("write")
    ) {
      // "45:40:15" -> read:edit:write
      const parts = ratio.split(":").map((s) => parseInt(s.trim(), 10) || 0);
      readPct = parts[0] ?? 0;
      editPct = parts[1] ?? 0;
      writePct = parts[2] ?? 0;
    } else if (label.includes("grep") && label.includes("glob")) {
      const parts = ratio.split(":").map((s) => parseInt(s.trim(), 10) || 0);
      grepCount = parts[0] ?? 0;
      globCount = parts[1] ?? 0;
    } else {
      // Style label like "Surgical Editor"
      style = ratio;
    }
  });

  return { readPct, editPct, writePct, grepCount, globCount, style };
}

// ---------------------------------------------------------------------------
// Agent Dispatch
// ---------------------------------------------------------------------------

function parseAgentDispatch(
  $: cheerio.CheerioAPI,
): HarnessAgentDispatch | null {
  const section = findSectionByTitle($, "Agent Dispatch");
  if (!section) return null;

  const countText = section.find(".section-header .count").text().trim();
  const countMatch = countText.match(/(\d+)/);
  const totalAgents = countMatch ? parseInt(countMatch[1], 10) : 0;

  const types: Record<string, number> = {};
  const models: Record<string, number> = {};
  let backgroundPct = 0;
  const customAgents: string[] = [];

  // Parse the two-col layout
  const columns = section.find(".two-col > div");
  columns.each((_, col) => {
    const heading = $(col).find("h3").text().trim().toLowerCase();
    if (heading.includes("agent types")) {
      $(col)
        .find(".kv-row")
        .each((__, row) => {
          const key = $(row).find(".mono").text().trim();
          const val = $(row).find(".meta").text().trim();
          if (key) types[key] = parseInt(val, 10) || 0;
        });
    } else if (heading.includes("model tiering")) {
      $(col)
        .find(".kv-row")
        .each((__, row) => {
          const key = $(row).find(".mono").text().trim();
          const val = $(row).find(".meta").text().trim();
          if (key) models[key] = parseInt(val, 10) || 0;
        });
      const bgMeta = $(col).find(".meta").last().text();
      const bgMatch = bgMeta.match(/(\d+)%/);
      if (bgMatch) backgroundPct = parseInt(bgMatch[1], 10);
    }
  });

  // Custom agents
  const customSection = section
    .find("h3")
    .filter((_, el) => $(el).text().toLowerCase().includes("custom agent"));
  if (customSection.length) {
    customSection
      .next(".tags")
      .find(".tag")
      .each((_, el) => {
        customAgents.push($(el).text().trim());
      });
  }

  return { totalAgents, types, models, backgroundPct, customAgents };
}

// ---------------------------------------------------------------------------
// Key-Value Sections (Permission Modes, MCP Servers)
// ---------------------------------------------------------------------------

function parseKvSection(
  $: cheerio.CheerioAPI,
  sectionTitle: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  const section = findSectionByTitle($, sectionTitle);
  if (!section) return result;

  section.find(".kv-row").each((_, el) => {
    const key = $(el).find(".mono").text().trim();
    const valText = $(el).find(".meta").text().trim();
    const numMatch = valText.match(/([\d,.]+)/);
    if (key && numMatch) {
      result[key] = parseNumericValue(numMatch[1]);
    }
  });
  return result;
}

// ---------------------------------------------------------------------------
// Git Patterns
// ---------------------------------------------------------------------------

function parseGitPatterns($: cheerio.CheerioAPI): HarnessGitPatterns {
  const section = findSectionByTitle($, "Git Patterns");
  const branchPrefixes: Record<string, number> = {};

  if (!section) {
    return { prCount: 0, commitCount: 0, linesAdded: "0", branchPrefixes };
  }

  // Parse summary meta: "12 PRs · 45 commits · 1.2K lines added"
  const meta = section.find(".meta").first().text();
  const prMatch = meta.match(/([\d,]+)\s*PRs/);
  const commitMatch = meta.match(/([\d,]+)\s*commits/);
  const linesMatch = meta.match(/([\d,.]+[KM]?)\s*lines added/);

  // Branch convention tags: "feat/ (12)"
  section.find(".tags .tag").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^(.+?)\s*\((\d+)\)$/);
    if (match) {
      branchPrefixes[match[1].trim()] = parseInt(match[2], 10);
    }
  });

  return {
    prCount: prMatch ? parseNumericValue(prMatch[1]) : 0,
    commitCount: commitMatch ? parseNumericValue(commitMatch[1]) : 0,
    linesAdded: linesMatch ? linesMatch[1] : "0",
    branchPrefixes,
  };
}

// ---------------------------------------------------------------------------
// Version Tags
// ---------------------------------------------------------------------------

function parseVersionTags(
  $: cheerio.CheerioAPI,
  sectionTitle: string,
): string[] {
  const versions: string[] = [];
  const section = findSectionByTitle($, sectionTitle);
  if (!section) return versions;

  section.find(".tags .tag").each((_, el) => {
    versions.push($(el).text().trim());
  });
  return versions;
}

// ---------------------------------------------------------------------------
// Writeup Sections
// ---------------------------------------------------------------------------

function parseWriteupSections($: cheerio.CheerioAPI): HarnessWriteupSection[] {
  const sections: HarnessWriteupSection[] = [];
  const writeupTab = $("#tab-writeup");
  if (!writeupTab.length) return sections;

  writeupTab.find(".writeup-section").each((_, el) => {
    const title = $(el).find("h2").first().text().trim();
    // Get inner HTML minus the h2
    const clone = $(el).clone();
    clone.find("h2").first().remove();
    // Sanitize: strip script tags, event handlers, and iframes
    clone.find("script, iframe, object, embed").remove();
    clone
      .find("[onclick], [onerror], [onload], [onmouseover]")
      .each((_, node) => {
        const $node = $(node);
        $node.removeAttr("onclick");
        $node.removeAttr("onerror");
        $node.removeAttr("onload");
        $node.removeAttr("onmouseover");
      });
    const contentHtml = clone.html()?.trim() ?? "";
    if (title) {
      sections.push({ title, contentHtml });
    }
  });

  return sections;
}

// ---------------------------------------------------------------------------
// Integrity Hash
// ---------------------------------------------------------------------------

function parseIntegrityHash($: cheerio.CheerioAPI): string {
  const script = $("#insight-harness-integrity").html();
  if (!script) return "";
  try {
    const data = JSON.parse(script);
    return data.hash ?? "";
  } catch {
    return "";
  }
}

function parseSkillVersion($: cheerio.CheerioAPI): string | null {
  const script = $("#insight-harness-integrity").html();
  if (!script) return null;
  try {
    const data = JSON.parse(script);
    const payload = JSON.parse(data.payload ?? "{}");
    return payload.skill_version ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Workflow Data (Phases & Tool Transitions)
// ---------------------------------------------------------------------------

function parseWorkflowData($: cheerio.CheerioAPI): HarnessWorkflowData | null {
  const phaseSection = findSectionByTitle($, "Workflow Phases");
  const skillSection = findSectionByTitle($, "Skill Workflow");

  if (!phaseSection && !skillSection) return null;

  // Parse skill invocations from bar-rows in Skill Workflow section
  const skillInvocations: Record<string, number> = {};
  const agentDispatches: Record<string, number> = {};
  const workflowPatterns: Array<{ sequence: string[]; count: number }> = [];

  if (skillSection) {
    // The section has three groups separated by .footnote labels:
    // 1. Skill invocations (bar-rows after "Skill invocations" footnote)
    // 2. Agent dispatches (bar-rows after "Agent dispatches" footnote)
    // 3. Workflow patterns (bar-rows after "Common workflow patterns" footnote)
    let currentGroup = "skills";
    skillSection.children().each((_, el) => {
      const $el = $(el);
      if ($el.hasClass("footnote")) {
        const text = $el.text().trim().toLowerCase();
        if (text.includes("agent dispatch")) {
          currentGroup = "agents";
        } else if (text.includes("workflow pattern")) {
          currentGroup = "patterns";
        } else if (text.includes("skill invocation")) {
          currentGroup = "skills";
        }
        return;
      }
      if ($el.hasClass("bar-row")) {
        const label = $el.find(".bar-label").text().trim();
        const value = $el.find(".bar-value").text().trim();
        if (!label) return;
        if (currentGroup === "skills") {
          skillInvocations[label] = parseNumericValue(value);
        } else if (currentGroup === "agents") {
          agentDispatches[label] = parseNumericValue(value);
        } else if (currentGroup === "patterns") {
          // Pattern labels use " → " as separator
          const parts = label.split(/\s*→\s*/);
          workflowPatterns.push({
            sequence: parts,
            count: parseNumericValue(value),
          });
        }
      }
    });
  }

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
    skillInvocations,
    agentDispatches,
    workflowPatterns,
    phaseTransitions,
    phaseDistribution,
    phaseStats,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find a <section> element by looking for a matching h2 text in .section-header.
 * Falls back to searching all section > h2 elements.
 */
function findSectionByTitle(
  $: cheerio.CheerioAPI,
  title: string,
): ReturnType<cheerio.CheerioAPI> | null {
  const lowerTitle = title.toLowerCase();

  // Try section-header h2 first
  let found: ReturnType<cheerio.CheerioAPI> | null = null;
  $("section").each((_, el) => {
    const h2 = $(el).find(".section-header h2").text().trim().toLowerCase();
    if (h2.includes(lowerTitle)) {
      found = $(el);
      return false; // break
    }
  });
  if (found) return found;

  // Fallback: any h2 containing the title, return its parent section
  $("h2").each((_, el) => {
    if ($(el).text().trim().toLowerCase().includes(lowerTitle)) {
      const parent = $(el).closest("section");
      if (parent.length) {
        found = parent;
        return false;
      }
    }
  });

  return found;
}

/**
 * Parse a numeric value that may have K/M suffixes or commas.
 */
function parseNumericValue(s: string): number {
  if (!s) return 0;
  s = s.replace(/,/g, "").trim();

  const tokenMatch = s.match(/(\d+(?:\.\d+)?)\s*([KM])?\s*(?:tokens?|tok)\b/i);
  if (tokenMatch) {
    const value = parseFloat(tokenMatch[1]);
    const suffix = tokenMatch[2]?.toUpperCase();
    if (suffix === "M") return Math.round(value * 1_000_000);
    if (suffix === "K") return Math.round(value * 1_000);
    return Math.round(value) || 0;
  }

  const upper = s.toUpperCase();
  if (upper.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (upper.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return Math.round(parseFloat(s)) || 0;
}
