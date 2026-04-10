import type { HarnessData } from "@/types/insights";

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

export function getHiddenHarnessSections(
  disabledSections: Record<string, boolean>,
): HideableHarnessSectionKey[] {
  return HIDEABLE_HARNESS_SECTION_KEYS.filter((key) => disabledSections[key]);
}

export function isHarnessSectionHidden(
  hiddenSections: string[] | null | undefined,
  key: HideableHarnessSectionKey,
): boolean {
  return hiddenSections?.includes(key) ?? false;
}

export function stripHiddenHarnessData(
  data: HarnessData,
  hiddenSections: readonly string[],
): HarnessData {
  const copy: HarnessData = {
    ...data,
    toolUsage: { ...data.toolUsage },
    skillInventory: [...data.skillInventory],
    hookDefinitions: [...data.hookDefinitions],
    plugins: [...data.plugins],
    harnessFiles: [...data.harnessFiles],
    cliTools: { ...data.cliTools },
    languages: { ...data.languages },
    models: { ...data.models },
    permissionModes: { ...data.permissionModes },
    mcpServers: { ...data.mcpServers },
    gitPatterns: {
      ...data.gitPatterns,
      branchPrefixes: { ...data.gitPatterns.branchPrefixes },
    },
    versions: [...data.versions],
    writeupSections: [...data.writeupSections],
  };

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

  return copy;
}
