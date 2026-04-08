import * as cheerio from "cheerio";
import type {
  ChartData,
  ChartDataPoint,
  MultiClaudingStats,
} from "@/types/insights";

/**
 * Parse chart data from a Claude Code HTML insights report.
 *
 * The HTML report contains multiple `.chart-card` elements, each with a
 * `.chart-title` and one or more `.bar-row` children. Each bar row has
 * a `.bar-label` and `.bar-value`. We extract the four chart types we
 * know about by matching the chart title.
 */
export function parseChartData(html: string): ChartData {
  const $ = cheerio.load(html);
  const result: ChartData = {};

  $(".chart-card").each((_, card) => {
    const title = $(card).find(".chart-title").first().text().trim();
    const rows: ChartDataPoint[] = [];

    $(card)
      .find(".bar-row")
      .each((_, row) => {
        const label = $(row).find(".bar-label").text().trim();
        const valueText = $(row).find(".bar-value").text().trim();
        const value = parseInt(valueText.replace(/,/g, ""), 10);

        if (label && !isNaN(value)) {
          rows.push({ label, value });
        }
      });

    if (rows.length === 0) return;

    // Map chart title to our structured field
    const titleLower = title.toLowerCase();
    if (titleLower.includes("tools used") || titleLower.includes("top tools")) {
      result.toolUsage = rows;
    } else if (
      titleLower.includes("what you wanted") ||
      titleLower.includes("request")
    ) {
      result.requestTypes = rows;
    } else if (titleLower.includes("language")) {
      result.languages = rows;
    } else if (titleLower.includes("session type")) {
      result.sessionTypes = rows;
    } else if (titleLower.includes("response time")) {
      result.responseTimeDistribution = rows;
    } else if (titleLower.includes("tool error")) {
      result.toolErrors = rows;
    } else if (
      titleLower.includes("what helped") ||
      titleLower.includes("capabilities")
    ) {
      result.whatHelpedMost = rows;
    } else if (titleLower.includes("outcome")) {
      result.outcomes = rows;
    } else if (
      titleLower.includes("friction") ||
      titleLower.includes("primary friction")
    ) {
      result.frictionTypes = rows;
    } else if (
      titleLower.includes("satisfaction") ||
      titleLower.includes("inferred satisfaction")
    ) {
      result.satisfaction = rows;
    } else if (
      titleLower.includes("time of day") ||
      titleLower.includes("messages by time")
    ) {
      result.timeOfDay = rows;
    }
  });

  return result;
}

function isChartDataPoint(value: unknown): value is ChartDataPoint {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { label?: unknown }).label === "string" &&
    typeof (value as { value?: unknown }).value === "number" &&
    Number.isFinite((value as { value: number }).value)
  );
}

function normalizeSeries(raw: unknown): ChartDataPoint[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const clean = raw.filter(isChartDataPoint);
  return clean.length > 0 ? clean : undefined;
}

/**
 * Normalize an unknown input (e.g. a Prisma `Json?` field) into a clean
 * ChartData object. Returns null for null/undefined/non-object inputs.
 * Silently drops any series whose entries don't match the expected shape.
 *
 * Use at boundaries where untrusted JSON enters the UI (detail page,
 * homepage list) to protect chart components from malformed data.
 */
export function normalizeChartData(raw: unknown): ChartData | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const result: ChartData = {};

  const toolUsage = normalizeSeries(obj.toolUsage);
  if (toolUsage) result.toolUsage = toolUsage;

  const requestTypes = normalizeSeries(obj.requestTypes);
  if (requestTypes) result.requestTypes = requestTypes;

  const languages = normalizeSeries(obj.languages);
  if (languages) result.languages = languages;

  const sessionTypes = normalizeSeries(obj.sessionTypes);
  if (sessionTypes) result.sessionTypes = sessionTypes;

  const responseTimeDistribution = normalizeSeries(
    obj.responseTimeDistribution,
  );
  if (responseTimeDistribution)
    result.responseTimeDistribution = responseTimeDistribution;

  const toolErrors = normalizeSeries(obj.toolErrors);
  if (toolErrors) result.toolErrors = toolErrors;

  const whatHelpedMost = normalizeSeries(obj.whatHelpedMost);
  if (whatHelpedMost) result.whatHelpedMost = whatHelpedMost;

  const outcomes = normalizeSeries(obj.outcomes);
  if (outcomes) result.outcomes = outcomes;

  const frictionTypes = normalizeSeries(obj.frictionTypes);
  if (frictionTypes) result.frictionTypes = frictionTypes;

  const satisfaction = normalizeSeries(obj.satisfaction);
  if (satisfaction) result.satisfaction = satisfaction;

  const timeOfDay = normalizeSeries(obj.timeOfDay);
  if (timeOfDay) result.timeOfDay = timeOfDay;

  // If no valid series survived, return null so consumers can hide the UI
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract rawHourCounts from a `<script>` tag in the insights HTML.
 * The report embeds `const rawHourCounts = {...};` with per-hour message counts.
 */
export function parseRawHourCounts(
  html: string,
): Record<string, number> | undefined {
  const match = html.match(/rawHourCounts\s*=\s*(\{[^}]+\})/);
  if (!match) return undefined;

  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        result[key] = val;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract Multi-Clauding stats from the insights HTML.
 * This is a stats block (not a bar chart) with inline-styled stat values.
 */
export function parseMultiClauding(
  html: string,
): MultiClaudingStats | undefined {
  const $ = cheerio.load(html);

  // Find the chart-card whose title contains "multi-clauding"
  let multiCardHtml: string | null = null;
  $(".chart-card").each((_, card) => {
    const title = $(card).find(".chart-title").first().text().trim();
    if (title.toLowerCase().includes("multi-clauding")) {
      multiCardHtml = $.html(card);
    }
  });

  if (!multiCardHtml) return undefined;

  // Re-parse just the card to avoid cheerio type issues
  const $card = cheerio.load(multiCardHtml);

  // The card has inline-styled stat blocks, not bar-rows.
  // Each stat has a large number div and a label div below it.
  const statValues: string[] = [];
  const statLabels: string[] = [];

  $card("div[style*='text-align: center']").each((_, el) => {
    const children = $card(el).children("div");
    if (children.length >= 2) {
      statValues.push($card(children[0]).text().trim());
      statLabels.push($card(children[1]).text().trim().toLowerCase());
    }
  });

  const result: MultiClaudingStats = {
    overlapEvents: 0,
    sessionsInvolved: 0,
    ofMessages: "",
  };

  for (let i = 0; i < statLabels.length; i++) {
    const label = statLabels[i];
    const value = statValues[i];
    if (label.includes("overlap")) {
      result.overlapEvents = parseInt(value.replace(/,/g, ""), 10) || 0;
    } else if (label.includes("session")) {
      result.sessionsInvolved = parseInt(value.replace(/,/g, ""), 10) || 0;
    } else if (label.includes("message")) {
      result.ofMessages = value;
    }
  }

  return result.overlapEvents > 0 || result.sessionsInvolved > 0
    ? result
    : undefined;
}
