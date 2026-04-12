import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseInsightsHtml } from "@/lib/parser";
import { isHarnessReport, parseHarnessHtml } from "@/lib/harness-parser";
import { detectRedactions } from "@/lib/redaction";
import { parseChartData } from "@/lib/chart-parser";
import { detectSkills } from "@/lib/skill-detector";
import * as cheerio from "cheerio";

/**
 * Extract enhanced stats (linesAdded, linesRemoved, fileCount, dayCount, msgsPerDay)
 * from the stats row in the HTML report.
 */
function extractEnhancedStats(html: string) {
  const $ = cheerio.load(html);
  const statValues: Record<string, string> = {};
  $(".stat").each((_, el) => {
    const label = $(el).find(".stat-label").text().trim().toLowerCase();
    const value = $(el).find(".stat-value").text().trim();
    statValues[label] = value;
  });

  // Parse lines: "+47,313/-2,967"
  let linesAdded: number | null = null;
  let linesRemoved: number | null = null;
  const linesValue = statValues["lines"];
  if (linesValue) {
    const linesMatch = linesValue.match(/\+?([\d,]+)\s*\/\s*-?([\d,]+)/);
    if (linesMatch) {
      linesAdded = parseInt(linesMatch[1].replace(/,/g, ""), 10);
      linesRemoved = parseInt(linesMatch[2].replace(/,/g, ""), 10);
    }
  }

  // Parse files
  const fileCount = statValues["files"]
    ? parseInt(statValues["files"].replace(/,/g, ""), 10)
    : null;

  // Parse days
  const dayCount = statValues["days"]
    ? parseInt(statValues["days"].replace(/,/g, ""), 10)
    : null;

  // Parse msgs/day
  const msgsPerDay = statValues["msgs/day"]
    ? parseFloat(statValues["msgs/day"].replace(/,/g, ""))
    : null;

  return { linesAdded, linesRemoved, fileCount, dayCount, msgsPerDay };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "HTML file is required" },
        { status: 400 },
      );
    }

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      return NextResponse.json(
        { error: "File must be an HTML file" },
        { status: 400 },
      );
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 },
      );
    }

    const html = await file.text();

    // Detect report type
    const isHarness = isHarnessReport(html);

    // For harness reports, extract the embedded /insights tab content
    // and parse that — the top-level HTML has harness-specific selectors
    // that would confuse the insights parser (wrong .stat/.subtitle elements).
    let insightsHtml = html;
    if (isHarness) {
      const $doc = cheerio.load(html);
      const insightsTab = $doc("#tab-insights");
      if (insightsTab.length) {
        // Wrap in minimal HTML so the parser can find selectors
        insightsHtml = `<html><body>${insightsTab.html()}</body></html>`;
      }
    }

    // Parse the /insights data from the appropriate HTML source
    const parsed = parseInsightsHtml(insightsHtml);

    // Extract chart data and detect skills from the insights HTML
    const chartData = parseChartData(insightsHtml);
    const detectedSkills = detectSkills(parsed.data, chartData);

    // Detect sensitive data using the redaction engine
    const detectedRedactions = detectRedactions(parsed.data);

    // Parse harness-specific data if applicable
    let harnessData: ReturnType<typeof parseHarnessHtml> | undefined;
    if (isHarness) {
      try {
        harnessData = parseHarnessHtml(html);
      } catch (e) {
        return NextResponse.json(
          {
            error:
              e instanceof Error
                ? e.message
                : "Failed to parse harness report data",
          },
          { status: 400 },
        );
      }
    }

    // Extract enhanced stats — for harness reports, source from JSON blob;
    // for plain insights, scrape from the insights stats row
    const enhancedStats = harnessData?.enhancedStats
      ? {
          linesAdded: harnessData.enhancedStats.linesAdded,
          linesRemoved: harnessData.enhancedStats.linesRemoved,
          fileCount: harnessData.enhancedStats.fileCount,
          dayCount: harnessData.enhancedStats.dayCount,
          msgsPerDay: harnessData.enhancedStats.msgsPerDay,
        }
      : extractEnhancedStats(insightsHtml);

    // For harness reports, override stats with harness-level data
    // since the embedded insights tab may have stale/different stats
    const stats = {
      ...parsed.stats,
      ...enhancedStats,
      ...(harnessData
        ? {
            sessionCount:
              harnessData.stats.sessionCount ?? parsed.stats.sessionCount ?? 0,
            commitCount:
              harnessData.stats.commitCount ?? parsed.stats.commitCount ?? 0,
            dayCount: enhancedStats.dayCount ?? 30,
          }
        : {}),
    };

    return NextResponse.json({
      stats,
      data: parsed.data,
      detectedRedactions,
      chartData,
      detectedSkills,
      reportType: isHarness ? "insight-harness" : "insights",
      harnessData,
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}
