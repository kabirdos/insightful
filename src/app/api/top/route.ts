import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const SECTION_KEYS = [
  "atAGlance",
  "interactionStyle",
  "projectAreas",
  "impressiveWorkflows",
  "frictionAnalysis",
  "suggestions",
  "onTheHorizon",
  "funEnding",
] as const;

// Map from camelCase DB keys to snake_case display keys
const keyToType: Record<string, string> = {
  atAGlance: "at_a_glance",
  interactionStyle: "interaction_style",
  projectAreas: "project_areas",
  impressiveWorkflows: "impressive_workflows",
  frictionAnalysis: "friction_analysis",
  suggestions: "suggestions",
  onTheHorizon: "on_the_horizon",
  funEnding: "fun_ending",
};

// Reverse map for filtering
const typeToKey: Record<string, string> = Object.fromEntries(
  Object.entries(keyToType).map(([k, v]) => [v, k]),
);

function extractPreview(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;

  // Try common fields for preview text
  for (const field of [
    "summary",
    "whats_working",
    "overview",
    "description",
    "text",
    "content",
  ]) {
    if (typeof obj[field] === "string") {
      return (obj[field] as string).slice(0, 200);
    }
  }

  // Try array fields
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === "string") return first.slice(0, 200);
      if (typeof first === "object" && first !== null) {
        const inner = first as Record<string, unknown>;
        for (const f of ["title", "name", "text", "description", "summary"]) {
          if (typeof inner[f] === "string")
            return (inner[f] as string).slice(0, 200);
        }
      }
    }
  }

  // Fallback: stringify first value
  const firstVal = Object.values(obj)[0];
  if (typeof firstVal === "string") return firstVal.slice(0, 200);
  return "";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");

    // Filter to specific section keys if type is provided
    let sectionKeyFilter: string[] | undefined;
    if (typeFilter && typeFilter !== "all") {
      const dbKey = typeToKey[typeFilter];
      if (dbKey) {
        sectionKeyFilter = [dbKey];
      }
    }

    // Get all votes grouped by reportId + sectionKey
    const votes = await prisma.sectionVote.groupBy({
      by: ["reportId", "sectionKey"],
      _count: { id: true },
      ...(sectionKeyFilter
        ? { where: { sectionKey: { in: sectionKeyFilter } } }
        : {}),
      orderBy: { _count: { id: "desc" } },
      take: 50,
    });

    if (votes.length === 0) {
      return NextResponse.json({ sections: [] });
    }

    // Fetch the reports for these votes
    const reportIds = [...new Set(votes.map((v) => v.reportId))];
    const reports = await prisma.insightReport.findMany({
      where: { id: { in: reportIds } },
      include: {
        author: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const reportMap = new Map(reports.map((r) => [r.id, r]));

    // Build the response
    const sections = votes
      .map((vote) => {
        const report = reportMap.get(vote.reportId);
        if (!report) return null;

        const sectionKey = vote.sectionKey;
        const sectionType = keyToType[sectionKey] || sectionKey;
        const sectionData = report[sectionKey as keyof typeof report];
        const preview = extractPreview(sectionData);

        return {
          id: `${vote.reportId}-${sectionKey}`,
          sectionKey,
          sectionType,
          preview,
          voteCount: vote._count.id,
          reportSlug: report.slug,
          reportTitle: report.title,
          author: {
            username: report.author.username,
            displayName: report.author.displayName,
            avatarUrl: report.author.avatarUrl,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ sections });
  } catch (error) {
    console.error("GET /api/top error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top sections" },
      { status: 500 },
    );
  }
}
