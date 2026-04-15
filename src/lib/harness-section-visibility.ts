import type { HarnessData } from "@/types/insights";
import {
  hideSetFromArray,
  isSectionHidden,
  filterList,
  filterRecord,
  parseKeypath,
} from "./item-visibility";

export const HIDEABLE_HARNESS_SECTION_KEYS = [
  "heroStats",
  "activityHeatmap",
  "howIWork",
  "toolUsage",
  "workflowData",
  "skillInventory",
  "plugins",
  "cliTools",
  "gitPatterns",
  "permissionModes",
  "hookDefinitions",
  "agentDispatch",
  "languages",
  "mcpServers",
  "versions",
  "writeupSections",
  "harnessFiles",
] as const;

export type HideableHarnessSectionKey =
  (typeof HIDEABLE_HARNESS_SECTION_KEYS)[number];

const STRIPPABLE_HARNESS_DATA_KEYS = new Set<string>([
  "toolUsage",
  "workflowData",
  "skillInventory",
  "plugins",
  "cliTools",
  "gitPatterns",
  "permissionModes",
  "hookDefinitions",
  "agentDispatch",
  "languages",
  "mcpServers",
  "versions",
  "writeupSections",
  "harnessFiles",
]);

/**
 * Extract hidden section keys from a disabled-sections record.
 * Returns top-level keys for backward compat.
 */
export function getHiddenHarnessSections(
  disabledSections: Record<string, boolean>,
): HideableHarnessSectionKey[] {
  return HIDEABLE_HARNESS_SECTION_KEYS.filter((key) => disabledSections[key]);
}

/**
 * Extract ALL hidden keypaths (both section-level and item-level) from a
 * disabled-sections record. A keypath is valid if its topKey is in the
 * HIDEABLE_HARNESS_SECTION_KEYS allowlist.
 */
export function getHiddenKeypaths(
  disabledSections: Record<string, boolean>,
): string[] {
  const allowedTopKeys = new Set<string>(HIDEABLE_HARNESS_SECTION_KEYS);
  return Object.keys(disabledSections).filter((key) => {
    if (!disabledSections[key]) return false;
    const parsed = parseKeypath(key);
    if (!parsed) return false;
    return allowedTopKeys.has(parsed.topKey);
  });
}

export function isHarnessSectionHidden(
  hiddenSections: string[] | null | undefined,
  key: HideableHarnessSectionKey,
): boolean {
  return hiddenSections?.includes(key) ?? false;
}

/**
 * Strip hidden harness data from a HarnessData object.
 * Handles both section-level keys (e.g. "skillInventory") and item-level
 * keypaths (e.g. "skillInventory.superpowers-brainstorming").
 */
export function stripHiddenHarnessData(
  data: HarnessData,
  hiddenSections: readonly string[],
): HarnessData {
  if (!hiddenSections || hiddenSections.length === 0) return data;

  const hidden = hideSetFromArray(hiddenSections);

  const copy: HarnessData = {
    ...data,
    toolUsage: { ...(data.toolUsage ?? {}) },
    skillInventory: [...(data.skillInventory ?? [])],
    hookDefinitions: [...(data.hookDefinitions ?? [])],
    plugins: [...(data.plugins ?? [])],
    harnessFiles: [...(data.harnessFiles ?? [])],
    cliTools: { ...(data.cliTools ?? {}) },
    languages: { ...(data.languages ?? {}) },
    models: { ...(data.models ?? {}) },
    permissionModes: { ...(data.permissionModes ?? {}) },
    mcpServers: { ...(data.mcpServers ?? {}) },
    gitPatterns: {
      prCount: data.gitPatterns?.prCount ?? 0,
      commitCount: data.gitPatterns?.commitCount ?? 0,
      linesAdded: data.gitPatterns?.linesAdded ?? "0",
      branchPrefixes: { ...(data.gitPatterns?.branchPrefixes ?? {}) },
    },
    versions: [...(data.versions ?? [])],
    writeupSections: [...(data.writeupSections ?? [])],
  };

  // First pass: handle section-level (top-key) hides
  for (const key of hiddenSections) {
    if (!STRIPPABLE_HARNESS_DATA_KEYS.has(key)) continue;

    switch (key) {
      case "workflowData":
        copy.workflowData = null;
        break;
      case "skillInventory":
        copy.skillInventory = [];
        break;
      case "plugins":
        copy.plugins = [];
        break;
      case "cliTools":
        copy.cliTools = {};
        break;
      case "gitPatterns":
        copy.gitPatterns = {
          prCount: 0,
          commitCount: 0,
          linesAdded: "0",
          branchPrefixes: {},
        };
        break;
      case "permissionModes":
        copy.permissionModes = {};
        break;
      case "hookDefinitions":
        copy.hookDefinitions = [];
        break;
      case "agentDispatch":
        copy.agentDispatch = null;
        break;
      case "languages":
        copy.languages = {};
        break;
      case "mcpServers":
        copy.mcpServers = {};
        break;
      case "versions":
        copy.versions = [];
        break;
      case "writeupSections":
        copy.writeupSections = [];
        break;
      case "harnessFiles":
        copy.harnessFiles = [];
        break;
      case "toolUsage":
        copy.toolUsage = {};
        break;
    }
  }

  // Second pass: handle item-level keypaths (only for sections not already fully hidden)
  if (!isSectionHidden(hidden, "skillInventory")) {
    copy.skillInventory = filterList(
      copy.skillInventory,
      hidden,
      "skillInventory",
      (s) => s.name,
    );
  }
  if (!isSectionHidden(hidden, "plugins")) {
    copy.plugins = filterList(copy.plugins, hidden, "plugins", (p) => p.name);
  }
  if (!isSectionHidden(hidden, "hookDefinitions")) {
    copy.hookDefinitions = filterList(
      copy.hookDefinitions,
      hidden,
      "hookDefinitions",
      (h) => `${h.event}-${h.matcher}`,
    );
  }
  if (!isSectionHidden(hidden, "harnessFiles")) {
    copy.harnessFiles = filterList(
      copy.harnessFiles,
      hidden,
      "harnessFiles",
      (f) => f,
    );
  }
  if (!isSectionHidden(hidden, "writeupSections")) {
    copy.writeupSections = filterList(
      copy.writeupSections,
      hidden,
      "writeupSections",
      (w) => w.title,
    );
  }
  if (!isSectionHidden(hidden, "versions")) {
    copy.versions = filterList(copy.versions, hidden, "versions", (v) => v);
  }
  if (!isSectionHidden(hidden, "toolUsage")) {
    copy.toolUsage = filterRecord(copy.toolUsage, hidden, "toolUsage");
  }
  if (!isSectionHidden(hidden, "cliTools")) {
    copy.cliTools = filterRecord(copy.cliTools, hidden, "cliTools");
  }
  if (!isSectionHidden(hidden, "languages")) {
    copy.languages = filterRecord(copy.languages, hidden, "languages");
  }
  if (!isSectionHidden(hidden, "mcpServers")) {
    copy.mcpServers = filterRecord(copy.mcpServers, hidden, "mcpServers");
  }
  if (!isSectionHidden(hidden, "permissionModes")) {
    copy.permissionModes = filterRecord(
      copy.permissionModes,
      hidden,
      "permissionModes",
    );
  }
  if (copy.agentDispatch && !isSectionHidden(hidden, "agentDispatch")) {
    copy.agentDispatch = {
      ...copy.agentDispatch,
      types: filterRecord(copy.agentDispatch.types, hidden, "agentDispatch"),
      models: filterRecord(copy.agentDispatch.models, hidden, "agentDispatch"),
    };
  }

  return copy;
}
