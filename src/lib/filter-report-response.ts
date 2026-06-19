/**
 * Server-side report filtering: strips hidden harness data and narrative
 * section items before sending to non-owner viewers.
 *
 * Fixes the pre-existing privacy leak where GET /api/insights/[slug]
 * returned harnessData unfiltered for section-level hides added via edit.
 */

import { stripHiddenHarnessData } from "./harness-section-visibility";
import { hideSetFromArray, filterList } from "./item-visibility";
import { normalizeHarnessEnvelope } from "@/types/insights";

/**
 * The shape of a narrative section that contains filterable sub-lists.
 * We only filter sections that have arrays as sub-properties.
 */

interface FilterOptions {
  viewerIsOwner: boolean;
  includeHidden: boolean;
}

/**
 * The canonical set of narrative sections that can be hidden whole (the
 * camelCase Prisma columns). A key listed in a report's hiddenNarrativeSections
 * nulls the corresponding column in the response for non-owners —
 * non-destructively (the DB column is untouched).
 *
 * This is the single source of truth: write paths (POST/PUT) must sanitize
 * incoming keys against it (see `sanitizeNarrativeHideKeys`) so the DB never
 * records a "hidden" key the filter won't actually strip — otherwise search
 * and the detail response would disagree about what's hidden.
 */
export const NARRATIVE_SECTION_KEYS = [
  "atAGlance",
  "interactionStyle",
  "projectAreas",
  "impressiveWorkflows",
  "frictionAnalysis",
  "suggestions",
  "onTheHorizon",
] as const;

const NARRATIVE_SECTION_KEY_SET = new Set<string>(NARRATIVE_SECTION_KEYS);

/**
 * Keep only canonical, de-duplicated narrative hide keys. Applied on every
 * write so the stored array can never contain a key the filter ignores.
 */
export function sanitizeNarrativeHideKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter((k) => NARRATIVE_SECTION_KEY_SET.has(k)))];
}

/**
 * Filter a report's data for the response. Returns a new object with hidden
 * data stripped. When viewerIsOwner && includeHidden, returns data untouched.
 */
export function filterReportForResponse<
  T extends {
    harnessData?: unknown;
    hiddenHarnessSections?: string[] | null;
    hiddenNarrativeSections?: string[] | null;
    atAGlance?: unknown;
    interactionStyle?: unknown;
    impressiveWorkflows?: unknown;
    frictionAnalysis?: unknown;
    projectAreas?: unknown;
    suggestions?: unknown;
    onTheHorizon?: unknown;
  },
>(report: T, options: FilterOptions): T {
  const { viewerIsOwner, includeHidden } = options;
  const hiddenSections = report.hiddenHarnessSections ?? [];
  const hiddenNarrative = report.hiddenNarrativeSections ?? [];

  // Owner with includeHidden=true gets unfiltered data (for edit page)
  if (viewerIsOwner && includeHidden) return report;

  // Nothing to filter
  if (hiddenSections.length === 0 && hiddenNarrative.length === 0)
    return report;

  const hidden = hideSetFromArray(hiddenSections);
  const result = { ...report };

  // Null whole narrative sections the author has hidden. Non-destructive: the
  // DB column is untouched; only this response copy is cleared, so the detail
  // page's null-check skips the section. Owners re-fetch with includeHidden
  // (edit page) to toggle them back on.
  if (hiddenNarrative.length > 0) {
    const narrativeHidden = new Set(hiddenNarrative);
    for (const key of NARRATIVE_SECTION_KEYS) {
      if (narrativeHidden.has(key)) {
        (result as Record<string, unknown>)[key] = null;
      }
    }
  }

  // Filter harnessData (the main privacy fix)
  if (result.harnessData && typeof result.harnessData === "object") {
    result.harnessData = stripHiddenHarnessData(
      result.harnessData,
      hiddenSections,
    ) as unknown as T["harnessData"];
  }

  // Filter narrative JSON sections that contain sub-lists
  if (
    result.impressiveWorkflows &&
    typeof result.impressiveWorkflows === "object"
  ) {
    const iw = result.impressiveWorkflows as {
      impressive_workflows?: Array<{ title: string }>;
    };
    if (iw.impressive_workflows && Array.isArray(iw.impressive_workflows)) {
      result.impressiveWorkflows = {
        ...iw,
        impressive_workflows: filterList(
          iw.impressive_workflows,
          hidden,
          "impressiveWorkflows",
          (w) => w.title,
        ),
      } as T["impressiveWorkflows"];
    }
  }

  if (result.frictionAnalysis && typeof result.frictionAnalysis === "object") {
    const fa = result.frictionAnalysis as {
      categories?: Array<{ category: string }>;
    };
    if (fa.categories && Array.isArray(fa.categories)) {
      result.frictionAnalysis = {
        ...fa,
        categories: filterList(
          fa.categories,
          hidden,
          "frictionAnalysis",
          (c) => c.category,
        ),
      } as T["frictionAnalysis"];
    }
  }

  if (result.projectAreas && typeof result.projectAreas === "object") {
    const pa = result.projectAreas as { areas?: Array<{ name: string }> };
    if (pa.areas && Array.isArray(pa.areas)) {
      result.projectAreas = {
        ...pa,
        areas: filterList(pa.areas, hidden, "projectAreas", (a) => a.name),
      } as T["projectAreas"];
    }
  }

  if (result.suggestions && typeof result.suggestions === "object") {
    const sg = result.suggestions as {
      claude_md_additions?: Array<{ addition: string }>;
      features_to_try?: Array<{ feature: string }>;
      usage_patterns?: Array<{ title: string }>;
    };
    const filtered: Record<string, unknown> = { ...sg };
    if (sg.claude_md_additions && Array.isArray(sg.claude_md_additions)) {
      filtered.claude_md_additions = filterList(
        sg.claude_md_additions,
        hidden,
        "suggestions",
        (a) => a.addition.slice(0, 48),
      );
    }
    if (sg.features_to_try && Array.isArray(sg.features_to_try)) {
      filtered.features_to_try = filterList(
        sg.features_to_try,
        hidden,
        "suggestions",
        (f) => f.feature,
      );
    }
    if (sg.usage_patterns && Array.isArray(sg.usage_patterns)) {
      filtered.usage_patterns = filterList(
        sg.usage_patterns,
        hidden,
        "suggestions",
        (p) => p.title,
      );
    }
    result.suggestions = filtered as T["suggestions"];
  }

  if (result.onTheHorizon && typeof result.onTheHorizon === "object") {
    const oh = result.onTheHorizon as {
      opportunities?: Array<{ title: string }>;
    };
    if (oh.opportunities && Array.isArray(oh.opportunities)) {
      result.onTheHorizon = {
        ...oh,
        opportunities: filterList(
          oh.opportunities,
          hidden,
          "onTheHorizon",
          (o) => o.title,
        ),
      } as T["onTheHorizon"];
    }
  }

  return result;
}

/**
 * Shape used by list-feed filtering. Same as filterReportForResponse's input,
 * plus the knowledge that we never want showcase bytes (readme_markdown,
 * hero_base64) to ship in list responses — cards don't render them, and
 * shipping them would make the homepage/top feeds multi-MB once users start
 * uploading with --include-skills.
 */

/**
 * Filter a report for a list feed (homepage, /top, /api/search, etc.).
 * Applies the same hidden-item stripping as filterReportForResponse, then
 * additionally drops the heavy showcase fields (readme_markdown, hero_base64,
 * hero_mime_type) from every visible skill. Preserves name/calls/source/
 * description/category so cards still render correctly.
 *
 * List feeds never pass includeHidden — hidden items must be stripped for
 * privacy, and the showcase byte drop is for response-size sanity.
 */
export function filterReportForListFeed<
  T extends {
    harnessData?: unknown;
    hiddenHarnessSections?: string[] | null;
    impressiveWorkflows?: unknown;
    frictionAnalysis?: unknown;
    projectAreas?: unknown;
    suggestions?: unknown;
    onTheHorizon?: unknown;
  },
>(report: T): T {
  const filtered = filterReportForResponse(report, {
    viewerIsOwner: false,
    includeHidden: false,
  });

  const harnessData = toListFeedHarnessData(
    stripShowcaseFieldsFromHarnessData(filtered.harnessData),
  );
  if (harnessData === filtered.harnessData) {
    return filtered;
  }

  return {
    ...filtered,
    harnessData,
  } as T;
}

function stripShowcaseFieldsFromHarnessData(data: unknown): unknown {
  if (!isRecord(data)) return data;

  if (isRecord(data.tools)) {
    const tools: Record<string, unknown> = { ...data.tools };
    let changed = false;

    for (const toolKey of ["claude-code", "codex"]) {
      const stripped = stripShowcaseFieldsFromHarnessSlice(tools[toolKey]);
      if (stripped !== tools[toolKey]) {
        tools[toolKey] = stripped;
        changed = true;
      }
    }

    return changed ? { ...data, tools } : data;
  }

  return stripShowcaseFieldsFromHarnessSlice(data);
}

function toListFeedHarnessData(data: unknown): unknown {
  if (!isRecord(data) || !isRecord(data.tools)) return data;

  const envelope = normalizeHarnessEnvelope(data);
  return envelope?.tools["claude-code"] ?? data;
}

function stripShowcaseFieldsFromHarnessSlice(data: unknown): unknown {
  if (!isRecord(data) || !Array.isArray(data.skillInventory)) return data;

  let changed = false;
  const skillInventory = data.skillInventory.map((skill) => {
    if (!isRecord(skill)) return skill;

    // Only strip if showcase fields are actually present — avoids unnecessary
    // object allocation for reports without --include-skills data.
    if (
      skill.readme_markdown == null &&
      skill.hero_base64 == null &&
      skill.hero_mime_type == null
    ) {
      return skill;
    }

    changed = true;
    return {
      ...skill,
      readme_markdown: null,
      hero_base64: null,
      hero_mime_type: null,
    };
  });

  return changed ? { ...data, skillInventory } : data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
