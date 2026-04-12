import * as cheerio from "cheerio";
import sanitize from "sanitize-html";
import type { HarnessData } from "@/types/insights";
import { normalizeHarnessData } from "@/types/insights";

/**
 * Detect whether an HTML string is an insight-harness report (vs plain /insights).
 * Checks for the integrity manifest script tag unique to harness reports.
 */
export function isHarnessReport(html: string): boolean {
  return html.includes('id="insight-harness-integrity"');
}

/**
 * Parse an insight-harness HTML report into structured HarnessData.
 * Extracts the embedded JSON blob from <script id="harness-data"> via cheerio,
 * sanitizes writeup HTML, and validates the shape.
 * Throws a descriptive error if the tag is missing or JSON is malformed.
 */
export function parseHarnessHtml(html: string): HarnessData {
  const $ = cheerio.load(html);
  const script = $("script#harness-data").first();
  const jsonString = script.html();

  if (!jsonString) {
    throw new Error(
      'Harness report is missing the embedded data blob. Expected a <script id="harness-data" type="application/json"> tag containing the report data as JSON.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(
      `Harness report contains malformed JSON in the harness-data script tag: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Sanitize writeup contentHtml before validation
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).writeupSections)
  ) {
    const sections = (parsed as Record<string, unknown>)
      .writeupSections as Array<{ title: string; contentHtml: string }>;
    for (const section of sections) {
      if (section.contentHtml) {
        section.contentHtml = sanitizeWriteupHtml(section.contentHtml);
      }
    }
  }

  const data = normalizeHarnessData(parsed);
  if (!data) {
    throw new Error(
      "Harness report JSON is missing required fields (stats, autonomy, featurePills). The embedded data does not match the expected HarnessData shape.",
    );
  }

  return data;
}

/**
 * Allowlist-based HTML sanitizer for writeup contentHtml.
 * Only permits safe formatting tags. Strips all event handlers, javascript: URLs,
 * and dangerous tags (script, iframe, object, embed, svg, math, form, input, etc.).
 */
function sanitizeWriteupHtml(html: string): string {
  return sanitize(html, {
    allowedTags: [
      // Block
      "p",
      "div",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "pre",
      "code",
      "hr",
      "br",
      // Lists
      "ul",
      "ol",
      "li",
      // Inline
      "a",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "span",
      "sub",
      "sup",
      "mark",
      // Tables
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      // Definition lists
      "dl",
      "dt",
      "dd",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      span: ["class"],
      div: ["class"],
      pre: ["class"],
      code: ["class"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Strip all on* event handlers
    exclusiveFilter: undefined,
  });
}
