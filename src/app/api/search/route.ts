import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { filterReportForListFeed } from "@/lib/filter-report-response";

const SEARCHABLE_JSON_FIELDS = [
  "atAGlance",
  "interactionStyle",
  "projectAreas",
  "impressiveWorkflows",
  "frictionAnalysis",
  "suggestions",
  "onTheHorizon",
  "funEnding",
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 },
      );
    }

    const searchTerm = q.toLowerCase();

    // Fetch all reports with their content and author info
    // SQLite doesn't support JSON path queries, so we fetch and filter in-memory
    const allReports = await prisma.insightReport.findMany({
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            comments: true,
            votes: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    });

    // Score and filter reports based on search term matches
    type ReportWithRelations = (typeof allReports)[number];
    interface ScoredReport {
      report: ReportWithRelations;
      score: number;
      matchedSections: string[];
    }

    const scored: ScoredReport[] = allReports.map((report) => {
      let score = 0;
      const matchedSections: string[] = [];

      // Check title
      if (report.title.toLowerCase().includes(searchTerm)) {
        score += 10;
      }

      // Check author username/display name
      if (report.author.username.toLowerCase().includes(searchTerm)) {
        score += 5;
      }
      if (report.author.displayName?.toLowerCase().includes(searchTerm)) {
        score += 5;
      }

      // Check JSON content fields
      for (const field of SEARCHABLE_JSON_FIELDS) {
        const value = report[field];
        if (value !== null && value !== undefined) {
          const jsonStr = JSON.stringify(value).toLowerCase();
          if (jsonStr.includes(searchTerm)) {
            score += 3;
            matchedSections.push(field);
          }
        }
      }

      return { report, score, matchedSections };
    });

    const results = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ report, score, matchedSections }) => {
        // Strip JSON content from response to keep payloads small
        const {
          atAGlance: _1,
          interactionStyle: _2,
          projectAreas: _3,
          impressiveWorkflows: _4,
          frictionAnalysis: _5,
          suggestions: _6,
          onTheHorizon: _7,
          funEnding: _8,
          ...rest
        } = report;

        // Strip hidden items + heavy showcase bytes before serializing.
        // Cards don't render readme_markdown/hero_base64; shipping them in
        // search results would bloat the response post --include-skills and
        // could leak hidden showcase content.
        const listFiltered = filterReportForListFeed(rest);

        return {
          ...listFiltered,
          matchedSections,
          relevanceScore: score,
        };
      });

    return NextResponse.json({
      data: results,
      query: q,
      total: results.length,
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
