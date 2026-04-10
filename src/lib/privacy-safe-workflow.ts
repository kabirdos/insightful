import type { HarnessSkillEntry } from "@/types/insights";

const SAFE_COMMAND_PATTERN = /^[a-z0-9._-]+(?: [a-z0-9._-]+)?$/i;
const RISKY_CUSTOM_SKILL_PATTERN =
  /(https?:\/\/|\/|\\|@[a-z0-9._-]+|[A-Z]{2,}-\d+|#[0-9]+|\.tsx?\b|\.jsx?\b|\.md\b|\.json\b)/i;

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Parse a skill key of the form `plugin:shortname`. Returns
 * `{ plugin: "custom", shortName: raw }` when there's no colon.
 * Duplicated from WorkflowDiagram.tsx to avoid a circular dep.
 */
export function parseSkillKey(key: string): {
  plugin: string;
  shortName: string;
} {
  const colonIdx = key.indexOf(":");
  if (colonIdx === -1) return { plugin: "custom", shortName: key };
  return {
    plugin: key.slice(0, colonIdx),
    shortName: key.slice(colonIdx + 1),
  };
}

function shortSkillName(name: string): string {
  return parseSkillKey(name).shortName;
}

export function sanitizeWorkflowSkillName(
  name: string,
  source: string = "unknown",
): string {
  const trimmed = shortSkillName(name.trim());
  if (!trimmed) return "workflow skill";
  if (source === "plugin" || source === "command") return trimmed;
  if (RISKY_CUSTOM_SKILL_PATTERN.test(trimmed)) return "custom workflow skill";
  return trimmed;
}

export function sanitizeWorkflowCommandName(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return "shell command";
  if (SAFE_COMMAND_PATTERN.test(trimmed)) return trimmed;
  const first = trimmed.split(/\s+/)[0];
  return SAFE_COMMAND_PATTERN.test(first) ? first : "shell command";
}

export function getSafeSkillHighlights(
  skillInventory: HarnessSkillEntry[],
  limit = 4,
): string[] {
  return unique(
    skillInventory
      .filter((skill) => skill.calls > 0)
      .sort((a, b) => b.calls - a.calls)
      .map((skill) => sanitizeWorkflowSkillName(skill.name, skill.source)),
  ).slice(0, limit);
}

export function getSafeCommandHighlights(
  cliTools: Record<string, number>,
  limit = 4,
): string[] {
  return unique(
    Object.entries(cliTools)
      .sort((a, b) => b[1] - a[1])
      .map(([command]) => sanitizeWorkflowCommandName(command)),
  ).slice(0, limit);
}

/**
 * Render a single `plugin:shortname` key as a privacy-safe label.
 * Known plugin sources are trusted; custom skills are run through
 * the risky-pattern check so file paths, URLs, ticket IDs, etc.
 * are masked to `custom workflow skill`.
 */
export function safeSkillKeyLabel(key: string): string {
  const { plugin } = parseSkillKey(key);
  return sanitizeWorkflowSkillName(
    key,
    plugin === "custom" ? "unknown" : "plugin",
  );
}

/**
 * Join a workflow sequence using sanitized labels. Used for the
 * "Strongest path" pill and insight copy in WorkflowDiagram.
 */
export function safeSequenceLabel(sequence: string[]): string {
  return sequence.map(safeSkillKeyLabel).join(" → ");
}
