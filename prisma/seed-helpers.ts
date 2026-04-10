/**
 * Pure default-computation helpers for the demo seed script.
 *
 * Lives in its own module (not seed-demos.ts) so the helpers can be
 * imported into unit tests without dragging in the PrismaClient
 * instantiation that seed-demos.ts does at module load.
 */

export interface DefaultAgentDispatch {
  totalAgents: number;
  types: Record<string, number>;
  models: Record<string, number>;
  backgroundPct: number;
  customAgents: string[];
}

/**
 * Auto-populate `agentDispatch` for demo users whose `detectedSkills`
 * include `parallel_agents` or `subagents`. Returns null otherwise so
 * the demo data matches what the real harness extractor produces for
 * single-agent users.
 *
 * `models` here is dispatch counts (how many agents ran on each
 * model), NOT token totals — the harness UI renders these as counts
 * in the dispatch panel.
 */
export function computeDefaultAgentDispatch(
  detectedSkills: string[],
  sessions: number,
): DefaultAgentDispatch | null {
  const usesAgents = detectedSkills.some((s) =>
    ["parallel_agents", "subagents"].includes(s),
  );
  if (!usesAgents) return null;
  const totalAgents = Math.max(6, Math.round(sessions * 0.12));
  return {
    totalAgents,
    types: {
      "general-purpose": Math.round(totalAgents * 0.55),
      "code-reviewer": Math.round(totalAgents * 0.25),
      explore: Math.round(totalAgents * 0.2),
    },
    models: {
      sonnet: Math.round(totalAgents * 0.6),
      opus: Math.round(totalAgents * 0.4),
    },
    backgroundPct: 35,
    customAgents: [],
  };
}

/**
 * Derive a per-event fire-count map from a list of hook definitions.
 * Used as a default when seed callers don't override `hookFrequency`.
 * Each event gets a deterministic, unique-ish count so the harness
 * UI's "fired N times" labels look real.
 */
export function computeDefaultHookFrequency(
  hookDefs: Array<{ event: string }>,
): Record<string, number> {
  return Object.fromEntries(hookDefs.map((h, i) => [h.event, 40 + i * 17]));
}

/**
 * Default branch prefix counts derived from total commit count. Used
 * when seed callers don't override `branchPrefixes`. The percentages
 * (40/25/15) match the rough distribution we see in real harness
 * reports across the corpus.
 */
export function computeDefaultBranchPrefixes(
  commits: number,
): Record<string, number> {
  return {
    "feat/": Math.round(commits * 0.4),
    "fix/": Math.round(commits * 0.25),
    "chore/": Math.round(commits * 0.15),
  };
}
