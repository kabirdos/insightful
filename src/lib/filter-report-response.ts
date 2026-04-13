/**
 * Server-side report filtering: strips hidden harness data and narrative
 * section items before sending to non-owner viewers.
 *
 * Fixes the pre-existing privacy leak where GET /api/insights/[slug]
 * returned harnessData unfiltered for section-level hides added via edit.
 */

import type { HarnessData } from "@/types/insights";
import { stripHiddenHarnessData } from "./harness-section-visibility";
import { hideSetFromArray, filterList } from "./item-visibility";

/**
 * The shape of a narrative section that contains filterable sub-lists.
 * We only filter sections that have arrays as sub-properties.
 */

interface FilterOptions {
  viewerIsOwner: boolean;
  includeHidden: boolean;
}

/**
 * Filter a report's data for the response. Returns a new object with hidden
 * data stripped. When viewerIsOwner && includeHidden, returns data untouched.
 */
export function filterReportForResponse<
  T extends {
    harnessData?: unknown;
    hiddenHarnessSections?: string[] | null;
    impressiveWorkflows?: unknown;
    frictionAnalysis?: unknown;
    projectAreas?: unknown;
    suggestions?: unknown;
    onTheHorizon?: unknown;
  },
>(report: T, options: FilterOptions): T {
  const { viewerIsOwner, includeHidden } = options;
  const hiddenSections = report.hiddenHarnessSections ?? [];

  // Owner with includeHidden=true gets unfiltered data (for edit page)
  if (viewerIsOwner && includeHidden) return report;

  // Nothing to filter
  if (hiddenSections.length === 0) return report;

  const hidden = hideSetFromArray(hiddenSections);
  const result = { ...report };

  // Filter harnessData (the main privacy fix)
  if (result.harnessData && typeof result.harnessData === "object") {
    result.harnessData = stripHiddenHarnessData(
      result.harnessData as HarnessData,
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

  if (
    !filtered.harnessData ||
    typeof filtered.harnessData !== "object" ||
    !Array.isArray(
      (filtered.harnessData as { skillInventory?: unknown }).skillInventory,
    )
  ) {
    return filtered;
  }

  const hd = filtered.harnessData as {
    skillInventory: Array<{
      readme_markdown?: string | null;
      hero_base64?: string | null;
      hero_mime_type?: string | null;
      [key: string]: unknown;
    }>;
  };

  const skillInventory = hd.skillInventory.map((skill) => {
    // Only strip if showcase fields are actually present — avoids unnecessary
    // object allocation for reports without --include-skills data
    if (
      skill.readme_markdown == null &&
      skill.hero_base64 == null &&
      skill.hero_mime_type == null
    ) {
      return skill;
    }
    return {
      ...skill,
      readme_markdown: null,
      hero_base64: null,
      hero_mime_type: null,
    };
  });

  return {
    ...filtered,
    harnessData: { ...hd, skillInventory },
  } as T;
}
