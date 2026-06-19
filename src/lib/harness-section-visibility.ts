import {
  normalizeHarnessEnvelope,
  type CodexHarnessData,
  type HarnessData,
  type HarnessToolKey,
  type HarnessToolsEnvelope,
} from "@/types/insights";
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
  "signaturePatterns",
  "howIWork",
  "workRhythm",
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
  "safety",
  "workSurfaces",
] as const;

export type HideableHarnessSectionKey =
  (typeof HIDEABLE_HARNESS_SECTION_KEYS)[number];

const STRIPPABLE_HARNESS_DATA_KEYS = new Set<string>([
  // concurrency + temporal are used only by the Work Rhythm card, so hiding the
  // section can fully strip them from non-owner payloads (unlike heroStats /
  // activityHeatmap / howIWork, whose data is shared across stat sections).
  "workRhythm",
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
  "safety",
  "workSurfaces",
]);

const TOOL_KEY_ORDER: HarnessToolKey[] = ["claude-code", "codex"];

export function buildCodexVisibilityKey(
  sectionKey: string,
  itemKey?: string,
): string {
  return itemKey
    ? `tools.codex.${sectionKey}.${itemKey}`
    : `tools.codex.${sectionKey}`;
}

function parseToolKeypath(keypath: string): {
  toolKey: HarnessToolKey;
  innerKeypath: string;
} | null {
  for (const toolKey of TOOL_KEY_ORDER) {
    const prefix = `tools.${toolKey}.`;
    if (!keypath.startsWith(prefix)) continue;

    const innerKeypath = keypath.slice(prefix.length);
    const parsed = parseKeypath(innerKeypath);
    if (!parsed) return null;
    if (
      !(HIDEABLE_HARNESS_SECTION_KEYS as readonly string[]).includes(
        parsed.topKey,
      )
    ) {
      return null;
    }

    return { toolKey, innerKeypath };
  }

  return null;
}

function hiddenSectionsForTool(
  hiddenSections: readonly string[],
  toolKey: HarnessToolKey,
  includeLegacyKeys: boolean,
): string[] {
  const keys: string[] = [];

  for (const key of hiddenSections) {
    const toolKeypath = parseToolKeypath(key);
    if (toolKeypath) {
      if (toolKeypath.toolKey === toolKey) keys.push(toolKeypath.innerKeypath);
      continue;
    }

    if (includeLegacyKeys) keys.push(key);
  }

  return keys;
}

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
    if (parseToolKeypath(key)) return true;
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
function stripHiddenLegacyHarnessData(
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
      case "workRhythm":
        copy.concurrency = null;
        copy.temporal = null;
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

function stripHiddenCodexHarnessData(
  data: CodexHarnessData,
  hiddenSections: readonly string[],
): CodexHarnessData {
  if (!hiddenSections || hiddenSections.length === 0) return data;

  const hidden = hideSetFromArray(hiddenSections);
  const copy: CodexHarnessData = {
    ...data,
    toolUsage: { ...(data.toolUsage ?? {}) },
    cliTools: { ...(data.cliTools ?? {}) },
    skillInventory: [...(data.skillInventory ?? [])],
    plugins: [...(data.plugins ?? [])],
    safety: {
      ...(data.safety ?? {}),
      approvalModes: [...(data.safety?.approvalModes ?? [])],
      trustLevels: [...(data.safety?.trustLevels ?? [])],
      rulesAllowlist: [...(data.safety?.rulesAllowlist ?? [])],
    },
    workflowData: data.workflowData ? { ...data.workflowData } : null,
    workSurfaces: {
      ...(data.workSurfaces ?? {}),
      desktopPresence: [...(data.workSurfaces?.desktopPresence ?? [])],
    },
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
      case "toolUsage":
        copy.toolUsage = {};
        break;
      case "safety":
        copy.safety = {
          approvalsReviewer: null,
          approvalModes: [],
          trustLevels: [],
          rulesAllowlist: [],
        };
        break;
      case "workSurfaces":
        copy.workSurfaces = { desktopPresence: [] };
        break;
    }
  }

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
  if (!isSectionHidden(hidden, "toolUsage")) {
    copy.toolUsage = filterRecord(copy.toolUsage, hidden, "toolUsage");
  }
  if (!isSectionHidden(hidden, "cliTools")) {
    copy.cliTools = filterRecord(copy.cliTools, hidden, "cliTools");
  }

  return copy;
}

function stripHiddenHarnessEnvelope(
  envelope: HarnessToolsEnvelope,
  hiddenSections: readonly string[],
): HarnessToolsEnvelope {
  const tools: HarnessToolsEnvelope["tools"] = {};
  const claude = envelope.tools["claude-code"];
  const codex = envelope.tools.codex;

  if (claude) {
    tools["claude-code"] = stripHiddenLegacyHarnessData(
      claude,
      hiddenSectionsForTool(hiddenSections, "claude-code", true),
    );
  }
  if (codex) {
    tools.codex = stripHiddenCodexHarnessData(
      codex,
      hiddenSectionsForTool(hiddenSections, "codex", false),
    );
  }

  return {
    ...envelope,
    tools,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEnvelopeShape(data: unknown): boolean {
  return isRecord(data) && isRecord(data.tools);
}

/**
 * Strip hidden harness data from legacy Claude harnesses, Codex harnesses, or
 * tools-map envelopes. Legacy hide keys apply to Claude slices; namespaced
 * `tools.<tool>.<section>` keys apply only to the matching tool slice.
 */
export function stripHiddenHarnessData(
  data: HarnessData,
  hiddenSections: readonly string[],
): HarnessData;
export function stripHiddenHarnessData(
  data: CodexHarnessData,
  hiddenSections: readonly string[],
): CodexHarnessData;
export function stripHiddenHarnessData(
  data: HarnessToolsEnvelope,
  hiddenSections: readonly string[],
): HarnessToolsEnvelope;
export function stripHiddenHarnessData<T>(
  data: T,
  hiddenSections: readonly string[],
): T;
export function stripHiddenHarnessData(
  data: unknown,
  hiddenSections: readonly string[],
): unknown {
  if (!hiddenSections || hiddenSections.length === 0) return data;

  if (isEnvelopeShape(data)) {
    const envelope = normalizeHarnessEnvelope(data);
    return envelope
      ? stripHiddenHarnessEnvelope(envelope, hiddenSections)
      : data;
  }

  const codexEnvelope = normalizeHarnessEnvelope(data);
  if (codexEnvelope?.tools.codex && !codexEnvelope.tools["claude-code"]) {
    return stripHiddenCodexHarnessData(
      codexEnvelope.tools.codex,
      hiddenSectionsForTool(hiddenSections, "codex", true),
    );
  }

  return stripHiddenLegacyHarnessData(data as HarnessData, hiddenSections);
}
