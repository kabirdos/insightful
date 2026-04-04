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
