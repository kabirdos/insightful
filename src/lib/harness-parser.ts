import * as cheerio from "cheerio";
import sanitize from "sanitize-html";
import type { HarnessToolsEnvelope } from "@/types/insights";
import { toStoredHarnessData } from "@/types/insights";

/**
 * Detect whether an HTML string is an insight-harness report (vs plain /insights).
 * Checks for the integrity manifest script tag unique to harness reports.
 */
export function isHarnessReport(html: string): boolean {
  const $ = cheerio.load(html);
  return (
    $("script#insight-harness-integrity").length > 0 ||
    $("script#harness-data").length > 0
  );
}

/**
 * Parse an insight-harness HTML report into structured HarnessData.
 * Extracts the embedded JSON blob from <script id="harness-data"> via cheerio,
 * sanitizes writeup HTML, and validates the shape.
 * Throws a descriptive error if the tag is missing or JSON is malformed.
 */
export function parseHarnessHtml(html: string): HarnessToolsEnvelope {
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

  sanitizeClaudeWriteupSections(parsed);

  const data = toStoredHarnessData(parsed);
  if (!data) {
    throw new Error(
      "Harness report JSON is missing required fields. The embedded data does not match a supported Claude Code, Codex, or multi-tool harness shape.",
    );
  }

  return data;
}

function sanitizeClaudeWriteupSections(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") return;
  const obj = parsed as Record<string, unknown>;
  const candidates: unknown[] = [obj];

  if (
    obj.tools &&
    typeof obj.tools === "object" &&
    !Array.isArray(obj.tools)
  ) {
    candidates.push((obj.tools as Record<string, unknown>)["claude-code"]);
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const sections = (candidate as Record<string, unknown>).writeupSections;
    if (!Array.isArray(sections)) continue;
    for (const section of sections) {
      if (
        section &&
        typeof section === "object" &&
        typeof (section as { contentHtml?: unknown }).contentHtml === "string"
      ) {
        (section as { contentHtml: string }).contentHtml = sanitizeWriteupHtml(
          (section as { contentHtml: string }).contentHtml,
        );
      }
    }
  }
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
