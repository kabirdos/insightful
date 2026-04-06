import * as cheerio from "cheerio";
import type { ChartData, ChartDataPoint } from "@/types/insights";

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

  // If no valid series survived, return null so consumers can hide the UI
  return Object.keys(result).length > 0 ? result : null;
}
