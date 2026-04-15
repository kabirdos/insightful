/**
 * Pure default-computation helpers for the demo seed script.
 *
 * Lives in its own module (not seed-demos.ts) so the helpers can be
 * imported into unit tests without dragging in the PrismaClient
 * instantiation that seed-demos.ts does at module load.
 */

export interface ModelTokenBreakdown {
  input: number;
  output: number;
  cache_read: number;
  cache_create: number;
}

/**
 * Build a plausible 4-way perModelTokens breakdown from a total-throughput
 * target and per-model shares. Distribution matches what real Claude Code
 * reports produce: cache_read dominates at ~88%, input + output are a few
 * percent each, cache_create fills the rest. Keeps the per-model sum
 * consistent with totalTokens and gives the USD cost estimator realistic
 * Path 1 inputs.
 */
export function computeDefaultPerModelTokens(
  totalThroughput: number,
  modelShares: Record<string, number>,
): Record<string, ModelTokenBreakdown> {
  const totalShare = Object.values(modelShares).reduce((a, b) => a + b, 0) || 1;
  const entries = Object.entries(modelShares);
  const result: Record<string, ModelTokenBreakdown> = {};
  let runningTotal = 0;
  entries.forEach(([model, share], i) => {
    const isLast = i === entries.length - 1;
    const modelTotal = isLast
      ? Math.max(0, totalThroughput - runningTotal)
      : Math.round((share / totalShare) * totalThroughput);
    runningTotal += modelTotal;
    const input = Math.round(modelTotal * 0.015);
    const output = Math.round(modelTotal * 0.035);
    const cacheCreate = Math.round(modelTotal * 0.07);
    const cacheRead = Math.max(0, modelTotal - input - output - cacheCreate);
    result[model] = {
      input,
      output,
      cache_read: cacheRead,
      cache_create: cacheCreate,
    };
  });
  return result;
}

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

export interface DefaultProjectSeed {
  name: string;
  description: string;
  githubUrl: string | null;
  liveUrl: string | null;
}

/**
 * Deterministic demo Projects keyed by the user's slug (githubId without
 * the "demo-" prefix). Used by the demo seed script to populate each
 * demo user's project library with a small, plausible set.
 *
 * Returns an array so we can seed multiple projects per user. Order is
 * stable so reruns produce the same Project rows.
 *
 * A generic two-project fallback is returned for unknown slugs so the
 * helper never throws — seed scripts just need something to work with.
 */
export function defaultProjectSeedFor(userSlug: string): DefaultProjectSeed[] {
  const libraries: Record<string, DefaultProjectSeed[]> = {
    mika: [
      {
        name: "Payments Dashboard",
        description:
          "Internal Stripe admin UI — refunds, dispute triage, and revenue charts for the ops team.",
        githubUrl: "https://github.com/mika-tanaka/payments-dashboard",
        liveUrl: null,
      },
      {
        name: "Type-Safe Feature Flags",
        description:
          "Open-source TypeScript feature flag client with compile-time flag-key safety.",
        githubUrl: "https://github.com/mika-tanaka/ts-flags",
        liveUrl: "https://ts-flags.dev",
      },
    ],
    jordan: [
      {
        name: "Indie Launchpad",
        description:
          "Opinionated SaaS starter — auth, billing, email, and dashboard in one repo.",
        githubUrl: "https://github.com/jordan-reeves/indie-launchpad",
        liveUrl: "https://indielaunchpad.io",
      },
      {
        name: "Quiet Focus",
        description:
          "Pomodoro timer with ambient soundscapes. Ships on the App Store and the web.",
        githubUrl: null,
        liveUrl: "https://quietfocus.app",
      },
      {
        name: "Changelog Studio",
        description:
          "Tiny marketing site generator for product changelogs with MDX and OG images.",
        githubUrl: "https://github.com/jordan-reeves/changelog-studio",
        liveUrl: null,
      },
    ],
    priya: [
      {
        name: "Agent Router",
        description:
          "Custom skill that routes prompts to the right sub-agent based on detected intent.",
        githubUrl: "https://github.com/priya-sharma/agent-router",
        liveUrl: null,
      },
      {
        name: "Embedding Playground",
        description:
          "FastAPI service for comparing embedding models side-by-side with live visualisations.",
        githubUrl: "https://github.com/priya-sharma/embedding-playground",
        liveUrl: "https://embeddings.priya.dev",
      },
    ],
    marcus: [
      {
        name: "IncidentKit",
        description:
          "On-call runbook generator that turns Terraform modules into first-responder playbooks.",
        githubUrl: "https://github.com/marcus-chen/incidentkit",
        liveUrl: null,
      },
      {
        name: "Cluster Lens",
        description:
          "Read-only K8s dashboard tuned for incident triage, not cluster administration.",
        githubUrl: "https://github.com/marcus-chen/cluster-lens",
        liveUrl: "https://clusterlens.dev",
      },
    ],
    elena: [
      {
        name: "Studio Invoices",
        description:
          "Rails app for client invoicing, time tracking, and Stripe payouts. Handles multi-currency.",
        githubUrl: null,
        liveUrl: "https://studio-invoices.com",
      },
      {
        name: "Component Kitchen",
        description:
          "React component library used across Elena's freelance clients — Tailwind-styled, accessible.",
        githubUrl: "https://github.com/elena-volkov/component-kitchen",
        liveUrl: null,
      },
    ],
    sam: [
      {
        name: "My First Blog",
        description:
          "Personal blog built during my first months learning Claude Code. Lots of lessons captured here.",
        githubUrl: "https://github.com/sam-okafor/blog",
        liveUrl: "https://samokafor.dev",
      },
    ],
  };

  // Strip "demo-" prefix if someone passes the full githubId.
  const key = userSlug
    .replace(/^demo-/, "")
    .split("-")[0]
    .toLowerCase();

  return (
    libraries[key] ?? [
      {
        name: "Example Project",
        description: "A placeholder demo project.",
        githubUrl: "https://github.com/example/example",
        liveUrl: null,
      },
      {
        name: "Second Example",
        description: "Another placeholder with a live URL.",
        githubUrl: null,
        liveUrl: "https://example.com",
      },
    ]
  );
}
