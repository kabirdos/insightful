import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Section keys in the HTML report that map to InsightsData fields
const SECTION_MAPPING: Record<string, string> = {
  "at-a-glance": "atAGlance",
  "interaction-style": "interactionStyle",
  "project-areas": "projectAreas",
  "impressive-workflows": "impressiveWorkflows",
  "friction-analysis": "frictionAnalysis",
  suggestions: "suggestions",
  "on-the-horizon": "onTheHorizon",
  "fun-ending": "funEnding",
};

// Patterns for detecting potentially sensitive information
const REDACTION_PATTERNS = [
  {
    type: "email" as const,
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
  {
    type: "github_url" as const,
    regex: /https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/g,
  },
  {
    type: "file_path" as const,
    regex: /(?:\/(?:Users|home|var|etc|opt)\/[^\s"'<>,]+)/g,
  },
  {
    type: "file_path" as const,
    regex: /(?:[A-Z]:\\[^\s"'<>,]+)/g,
  },
];

interface DetectedRedaction {
  id: string;
  text: string;
  type: "project_name" | "file_path" | "github_url" | "email" | "code_snippet";
  context: string;
  sectionKey: string;
  action: "redact" | "alias" | "keep";
}

function detectRedactions(
  content: string,
  sectionKey: string,
): DetectedRedaction[] {
  const redactions: DetectedRedaction[] = [];
  const seen = new Set<string>();

  for (const pattern of REDACTION_PATTERNS) {
    const matches = content.matchAll(pattern.regex);
    for (const match of matches) {
      const text = match[0];
      const key = `${pattern.type}:${text}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Extract context around the match
      const start = Math.max(0, (match.index ?? 0) - 40);
      const end = Math.min(
        content.length,
        (match.index ?? 0) + text.length + 40,
      );
      const context = content.slice(start, end);

      redactions.push({
        id: `${sectionKey}-${redactions.length}-${Math.random().toString(36).substring(2, 8)}`,
        text,
        type: pattern.type,
        context,
        sectionKey,
        action: "redact",
      });
    }
  }

  return redactions;
}

function extractJsonFromScript(html: string): Record<string, unknown> | null {
  // Try to find embedded JSON data in script tags
  const scriptMatch = html.match(
    /<script[^>]*id=["']?report-data["']?[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (scriptMatch) {
    try {
      return JSON.parse(scriptMatch[1]) as Record<string, unknown>;
    } catch {
      // Not valid JSON
    }
  }

  // Try generic script tags with JSON-like content
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    try {
      return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function extractStatsFromHtml(
  html: string,
): Record<string, string | number | null> {
  const stats: Record<string, string | number | null> = {
    sessionCount: null,
    analyzedCount: null,
    messageCount: null,
    hours: null,
    commitCount: null,
    dateRangeStart: null,
    dateRangeEnd: null,
  };

  // Try to extract stats from common patterns in the HTML
  const sessionMatch = html.match(
    /(\d+)\s*(?:sessions?\s*analyzed|total\s*sessions?)/i,
  );
  if (sessionMatch) stats.sessionCount = parseInt(sessionMatch[1], 10);

  const messageMatch = html.match(/(\d[\d,]*)\s*messages?/i);
  if (messageMatch)
    stats.messageCount = parseInt(messageMatch[1].replace(/,/g, ""), 10);

  const commitMatch = html.match(/(\d[\d,]*)\s*commits?/i);
  if (commitMatch)
    stats.commitCount = parseInt(commitMatch[1].replace(/,/g, ""), 10);

  return stats;
}

function extractSectionsFromHtml(html: string): Record<string, string> {
  const sections: Record<string, string> = {};

  // Try extracting sections by id or class patterns
  for (const [htmlKey, dataKey] of Object.entries(SECTION_MAPPING)) {
    const pattern = new RegExp(
      `<(?:section|div)[^>]*(?:id|class)=["']?[^"']*${htmlKey}[^"']*["']?[^>]*>([\\s\\S]*?)(?=<(?:section|div)[^>]*(?:id|class)=["']?[^"']*(?:${Object.keys(SECTION_MAPPING).join("|")})|$)`,
      "i",
    );
    const match = html.match(pattern);
    if (match) {
      sections[dataKey] = match[1].trim();
    }
  }

  return sections;
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

    // Try to extract embedded JSON data first
    const jsonData = extractJsonFromScript(html);
    const stats = extractStatsFromHtml(html);
    const allRedactions: DetectedRedaction[] = [];

    let parsedData: Record<string, unknown>;

    if (jsonData) {
      // If embedded JSON found, use it directly
      parsedData = jsonData;

      // Detect redactions across all JSON string values
      const jsonStr = JSON.stringify(jsonData);
      for (const [, dataKey] of Object.entries(SECTION_MAPPING)) {
        const sectionData = (jsonData as Record<string, unknown>)[dataKey];
        if (sectionData) {
          const sectionStr =
            typeof sectionData === "string"
              ? sectionData
              : JSON.stringify(sectionData);
          allRedactions.push(...detectRedactions(sectionStr, dataKey));
        }
      }

      // Also scan full content for any missed redactions
      const fullRedactions = detectRedactions(jsonStr, "general");
      const existingTexts = new Set(allRedactions.map((r) => r.text));
      for (const r of fullRedactions) {
        if (!existingTexts.has(r.text)) {
          allRedactions.push(r);
        }
      }
    } else {
      // Fall back to HTML section extraction
      const sections = extractSectionsFromHtml(html);
      parsedData = {};

      for (const [key, content] of Object.entries(sections)) {
        parsedData[key] = content;
        allRedactions.push(...detectRedactions(content, key));
      }

      // If no sections found, scan the entire HTML body
      if (Object.keys(sections).length === 0) {
        // Strip HTML tags for plain text analysis
        const textContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        parsedData = { rawContent: textContent };
        allRedactions.push(...detectRedactions(textContent, "general"));
      }
    }

    return NextResponse.json({
      data: {
        stats,
        sections: parsedData,
        detectedRedactions: allRedactions,
      },
    });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}
