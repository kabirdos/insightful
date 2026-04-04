import type { InsightsData, RedactionItem } from "@/types/insights";

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Scan all text content in the parsed insights data and return a list of
 * potentially sensitive items that should be reviewed for redaction.
 */
export function detectRedactions(data: InsightsData): RedactionItem[] {
  const items: RedactionItem[] = [];
  const seen = new Set<string>(); // deduplicate by text+type

  function add(
    text: string,
    type: RedactionItem["type"],
    context: string,
    sectionKey: string,
  ) {
    const key = `${type}::${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      id: crypto.randomUUID(),
      text,
      type,
      context: context.slice(0, 50),
      sectionKey,
      action: "redact",
    });
  }

  // --- Project area names (ALWAYS flagged) ---
  for (const area of data.project_areas.areas) {
    add(area.name, "project_name", area.name, "project_areas");
  }

  // --- Scan all text fields for patterns ---
  const textFields = collectTextFields(data);

  for (const { text, sectionKey } of textFields) {
    // File paths: /path/to/file or ~/path/to/file
    for (const match of text.matchAll(
      /(?:~|\/(?:Users|home|var|etc|opt|tmp|usr|src))\/[\w./@-]+/g,
    )) {
      add(
        match[0],
        "file_path",
        surrounding(text, match.index!, match[0].length),
        sectionKey,
      );
    }

    // GitHub URLs
    for (const match of text.matchAll(/https?:\/\/github\.com\/[\w./-]+/g)) {
      add(
        match[0],
        "github_url",
        surrounding(text, match.index!, match[0].length),
        sectionKey,
      );
    }

    // Email addresses
    for (const match of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
      add(
        match[0],
        "email",
        surrounding(text, match.index!, match[0].length),
        sectionKey,
      );
    }

    // Code snippets containing file paths (in suggestion code blocks)
    if (
      sectionKey === "suggestions" &&
      (text.includes("/") || text.includes("~"))
    ) {
      for (const match of text.matchAll(/(?:\.\/|\.\.\/|src\/)[\w./@-]+/g)) {
        add(
          match[0],
          "code_snippet",
          surrounding(text, match.index!, match[0].length),
          sectionKey,
        );
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/**
 * Apply redaction decisions to the insights data. Returns a new deep-cloned
 * copy with replacements applied consistently across all sections.
 */
export function applyRedactions(
  data: InsightsData,
  decisions: RedactionItem[],
): InsightsData {
  // Deep clone to avoid mutating the original
  const clone: InsightsData = JSON.parse(JSON.stringify(data));

  // Build a map of text -> replacement for items that need replacing
  const replacements = new Map<string, string>();

  for (const item of decisions) {
    if (item.action === "keep") continue;
    if (item.action === "redact") {
      replacements.set(item.text, "[redacted]");
    } else if (item.action === "alias" && item.alias) {
      replacements.set(item.text, item.alias);
    }
  }

  if (replacements.size === 0) return clone;

  // Sort by length descending so longer strings are replaced first
  // (prevents partial replacements)
  const sortedEntries = [...replacements.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );

  function replaceInString(s: string): string {
    let result = s;
    for (const [original, replacement] of sortedEntries) {
      result = result.split(original).join(replacement);
    }
    return result;
  }

  // Walk every string field in the clone and apply replacements
  applyToObject(clone as unknown as Record<string, unknown>, replaceInString);

  // v2: If a project name is marked for full redaction, also clear its description
  const redactedProjectNames = new Set(
    decisions
      .filter(
        (d) =>
          d.type === "project_name" &&
          d.sectionKey === "project_areas" &&
          d.action === "redact",
      )
      .map((d) => d.text),
  );

  if (redactedProjectNames.size > 0 && clone.project_areas?.areas) {
    for (const area of clone.project_areas.areas) {
      if (area.name === "[redacted]") {
        area.description = "[redacted]";
      }
    }
  }

  return clone;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TextField {
  text: string;
  sectionKey: string;
}

/**
 * Collect all string values from the InsightsData structure along with
 * the section they belong to.
 */
function collectTextFields(data: InsightsData): TextField[] {
  const fields: TextField[] = [];

  function walk(obj: unknown, sectionKey: string) {
    if (typeof obj === "string") {
      fields.push({ text: obj, sectionKey });
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        walk(item, sectionKey);
      }
    } else if (obj !== null && typeof obj === "object") {
      for (const value of Object.values(obj)) {
        walk(value, sectionKey);
      }
    }
  }

  // Walk each top-level section with its key
  for (const [key, value] of Object.entries(data)) {
    walk(value, key);
  }

  return fields;
}

/**
 * Recursively apply a string transformation to every string field in an object.
 * Mutates the object in place.
 */
function applyToObject(
  obj: Record<string, unknown>,
  fn: (s: string) => string,
) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string") {
      obj[key] = fn(val);
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (typeof val[i] === "string") {
          val[i] = fn(val[i]);
        } else if (val[i] !== null && typeof val[i] === "object") {
          applyToObject(val[i] as Record<string, unknown>, fn);
        }
      }
    } else if (val !== null && typeof val === "object") {
      applyToObject(val as Record<string, unknown>, fn);
    }
  }
}

/**
 * Extract surrounding context around a match position.
 */
function surrounding(text: string, index: number, length: number): string {
  const contextRadius = 25;
  const start = Math.max(0, index - contextRadius);
  const end = Math.min(text.length, index + length + contextRadius);
  return text.slice(start, end);
}
