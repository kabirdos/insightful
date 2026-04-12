/**
 * API cost estimation helper.
 *
 * Computes an estimated USD cost for Claude API usage given a per-model
 * token breakdown. Falls back to a reasonable Sonnet-blended rate when
 * the breakdown is missing.
 *
 * Pricing source: Anthropic published API pricing, verified
 * 2026-04-11 against https://platform.claude.com/docs/en/docs/about-claude/models/all-models
 * (Latest models comparison + Legacy models tables). Each model has
 * separate input and output token rates per million tokens (MTok).
 *
 * NOTE: harness reports ship a single token-count number per model,
 * NOT a split of input vs output. To convert that into USD we apply a
 * fixed blended rate per model derived from a 70/30 input/output mix
 * (see INPUT_RATIO below). 70/30 is a reasonable approximation for
 * typical Claude Code workloads, where prompts (file reads, context,
 * tool descriptions) significantly dominate generated output. This is
 * documented in the helper's signature so callers know it's an
 * estimate, not a billable invoice.
 */

/** Fraction of tokens assumed to be input vs output for the blended rate. */
const INPUT_RATIO = 0.7;
const OUTPUT_RATIO = 1 - INPUT_RATIO; // 0.3

/** Rate per 1M tokens, in USD, split by input and output. */
interface ModelRate {
  /** Regex matched against the model name as it appears in harness data. */
  match: RegExp;
  /** Cost in USD per 1M input tokens. */
  inputUsdPerMTok: number;
  /** Cost in USD per 1M output tokens. */
  outputUsdPerMTok: number;
  /** Human-readable label, used for debug / future surfacing. */
  label: string;
}

/**
 * Rate table. ORDER MATTERS — earlier entries are checked first, so
 * always list more specific patterns (e.g. "opus-4-6") above more
 * general ones (e.g. "opus").
 *
 * Source: Anthropic pricing page and the All Models docs page,
 * verified 2026-04-11 against the published rates. The "current
 * generation" 4.6 models are significantly cheaper than the older
 * 4 / 4.1 generation (Opus 4 was \$15/\$75 vs Opus 4.6's \$5/\$25).
 *
 * Real harness data tends to use either short names ("sonnet", "opus",
 * "haiku") or full API ids ("claude-sonnet-4-6", "claude-opus-4-1",
 * "claude-3-5-haiku-20241022"). Patterns below are written to handle
 * both shapes.
 */
const MODEL_RATES: ModelRate[] = [
  // ── Current generation (4.6 / 4.5) ───────────────────────────
  {
    match: /opus[-_.\s]?4[-_.\s]?6/i,
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
    label: "Claude Opus 4.6",
  },
  {
    match: /opus[-_.\s]?4[-_.\s]?5/i,
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
    label: "Claude Opus 4.5",
  },
  {
    match: /sonnet[-_.\s]?4[-_.\s]?6/i,
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    label: "Claude Sonnet 4.6",
  },
  {
    match: /sonnet[-_.\s]?4[-_.\s]?5/i,
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    label: "Claude Sonnet 4.5",
  },
  {
    match: /haiku[-_.\s]?4[-_.\s]?5/i,
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    label: "Claude Haiku 4.5",
  },

  // ── Earlier 4.x generation ───────────────────────────────────
  {
    match: /opus[-_.\s]?4[-_.\s]?1/i,
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
    label: "Claude Opus 4.1",
  },
  {
    match: /opus[-_.\s]?4(?![-_.\s]?\d)/i,
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
    label: "Claude Opus 4",
  },
  {
    match: /sonnet[-_.\s]?4(?![-_.\s]?\d)/i,
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    label: "Claude Sonnet 4",
  },

  // ── Sonnet 3.x (legacy) ─────────────────────────────────────
  {
    match: /sonnet[-_.\s]?3[-_.\s]?7/i,
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    label: "Claude Sonnet 3.7",
  },
  {
    match: /sonnet[-_.\s]?3[-_.\s]?5/i,
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    label: "Claude Sonnet 3.5",
  },

  // ── Haiku 3.x (legacy) ──────────────────────────────────────
  // IMPORTANT: more specific patterns must come BEFORE generic
  // /haiku/i so they win the match.
  {
    match:
      /(?:claude[-_.\s]?)?3[-_.\s]?5[-_.\s]?haiku|haiku[-_.\s]?3[-_.\s]?5/i,
    inputUsdPerMTok: 0.8,
    outputUsdPerMTok: 4,
    label: "Claude Haiku 3.5",
  },
  {
    match: /(?:claude[-_.\s]?)?3[-_.\s]?haiku|haiku[-_.\s]?3(?![-_.\s]?\d)/i,
    inputUsdPerMTok: 0.25,
    outputUsdPerMTok: 1.25,
    label: "Claude Haiku 3",
  },

  // ── Opus 3 (very legacy) ────────────────────────────────────
  {
    match: /opus[-_.\s]?3/i,
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
    label: "Claude Opus 3",
  },

  // ── Generic / unspecified family fallbacks ──────────────────
  // If a record just says "opus", default to legacy Opus 4 pricing
  // (the more expensive variant) so we don't undercount cost.
  {
    match: /opus/i,
    inputUsdPerMTok: 15,
    outputUsdPerMTok: 75,
    label: "Opus (generic)",
  },
  {
    match: /sonnet/i,
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    label: "Sonnet (generic)",
  },
  // Generic "haiku" — assume CURRENT generation (Haiku 4.5). If a
  // record actually meant Haiku 3 / 3.5 it should ideally use the
  // explicit name above. This is a small overestimate at worst, which
  // is better than undercounting (per the issue's guidance).
  {
    match: /haiku/i,
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    label: "Haiku (generic)",
  },
];

/**
 * Default fallback rate when no model name matches and no breakdown
 * is available — use Sonnet 4.6 (the dominant Claude Code model as of
 * this writing). NOT the cheapest possible rate.
 */
const FALLBACK_RATE: ModelRate = {
  match: /.*/,
  inputUsdPerMTok: 3,
  outputUsdPerMTok: 15,
  label: "Sonnet (fallback)",
};

/**
 * Convert a ModelRate into a single blended USD-per-MTok number,
 * applying the INPUT_RATIO / OUTPUT_RATIO assumption.
 */
function blendedRate(rate: ModelRate): number {
  return (
    rate.inputUsdPerMTok * INPUT_RATIO + rate.outputUsdPerMTok * OUTPUT_RATIO
  );
}

/** Look up the rate entry for a given model name. */
export function lookupModelRate(modelName: string): ModelRate {
  const found = MODEL_RATES.find((m) => m.match.test(modelName));
  return found ?? FALLBACK_RATE;
}

/** 4-way per-model token breakdown from stats-cache modelUsage. */
interface ModelTokenBreakdown {
  input: number;
  output: number;
  cache_read: number;
  cache_create: number;
}

/**
 * Estimate the API cost in USD using the best available data.
 *
 * Tries three paths in order of accuracy:
 *   1. **4-way breakdown** (`perModelTokens`): exact per-type rates
 *      (input, output, cache read at 90% discount, cache create at 25% premium)
 *   2. **Simple model map** (`modelTokens`): input+output only, blended rate
 *   3. **Fallback total**: single number with Sonnet 4.6 blended rate
 */
export function estimateApiCostUsd(
  modelTokens: Record<string, number> | undefined,
  fallbackTotalTokens: number = 0,
  perModelTokens?: Record<string, ModelTokenBreakdown> | null,
): number {
  // Path 1: 4-way per-model breakdown — most accurate
  if (perModelTokens && typeof perModelTokens === "object") {
    const entries = Object.entries(perModelTokens).filter(
      ([, v]) => v && typeof v === "object",
    );
    if (entries.length > 0) {
      let total = 0;
      for (const [name, breakdown] of entries) {
        const rate = lookupModelRate(name);
        const inp = breakdown.input ?? 0;
        const out = breakdown.output ?? 0;
        const cr = breakdown.cache_read ?? 0;
        const cc = breakdown.cache_create ?? 0;
        if (inp + out + cr + cc <= 0) continue;
        total +=
          (inp / 1_000_000) * rate.inputUsdPerMTok +
          (out / 1_000_000) * rate.outputUsdPerMTok +
          (cr / 1_000_000) * rate.inputUsdPerMTok * 0.1 + // cache reads: 90% discount
          (cc / 1_000_000) * rate.inputUsdPerMTok * 1.25; // cache creation: 25% premium
      }
      if (total > 0) return total;
    }
  }

  // Path 2: simple per-model counts (input+output combined)
  if (modelTokens && typeof modelTokens === "object") {
    const entries = Object.entries(modelTokens).filter(
      ([name, tokens]) =>
        typeof name === "string" &&
        typeof tokens === "number" &&
        Number.isFinite(tokens) &&
        tokens > 0,
    );

    if (entries.length > 0) {
      const sum = entries.reduce((acc, [, v]) => acc + v, 0);
      const looksLikeProportion =
        fallbackTotalTokens > 0 && sum > 0 && sum < fallbackTotalTokens * 0.1;

      const scaled: Array<[string, number]> = looksLikeProportion
        ? entries.map(([name, share]) => [
            name,
            (share / sum) * fallbackTotalTokens,
          ])
        : entries;

      let total = 0;
      for (const [name, tokens] of scaled) {
        const rate = lookupModelRate(name);
        total += (tokens / 1_000_000) * blendedRate(rate);
      }
      if (total > 0) return total;
    }
  }

  // Path 3: fallback — Sonnet 4.6 blended rate over total tokens
  if (fallbackTotalTokens > 0) {
    return (fallbackTotalTokens / 1_000_000) * blendedRate(FALLBACK_RATE);
  }
  return 0;
}

/** Exported for tests. */
export const __testing__ = {
  INPUT_RATIO,
  OUTPUT_RATIO,
  MODEL_RATES,
  FALLBACK_RATE,
  blendedRate,
};
