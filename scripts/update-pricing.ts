#!/usr/bin/env tsx
/**
 * Refresh the Anthropic pricing snapshot used by src/lib/api-cost.ts.
 *
 * Source: LiteLLM's community-maintained price table
 *   https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
 *
 * Run: `pnpm pricing:update` (or `npx tsx scripts/update-pricing.ts`).
 * Commit the resulting src/lib/pricing-snapshot.json.
 *
 * The snapshot is keyed by the label strings used in api-cost.ts's
 * MODEL_RATES table, so the loader can overlay numeric rates onto the
 * existing regex-based lookup without changing any matching logic.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

// Maps our ModelRate.label → the LiteLLM model IDs to pull rates from.
// First ID that exists in the upstream table wins. Keep in sync with
// src/lib/api-cost.ts MODEL_RATES.
const LABEL_TO_LITELLM_IDS: Record<string, string[]> = {
  "Claude Opus 4.6": ["claude-opus-4-6"],
  "Claude Opus 4.5": ["claude-opus-4-5", "claude-opus-4-5-20251101"],
  "Claude Sonnet 4.6": ["claude-sonnet-4-6"],
  "Claude Sonnet 4.5": ["claude-sonnet-4-5", "claude-sonnet-4-5-20250929"],
  "Claude Haiku 4.5": ["claude-haiku-4-5", "claude-haiku-4-5-20251001"],
  "Claude Opus 4.1": ["claude-opus-4-1"],
  "Claude Opus 4": ["claude-opus-4", "claude-opus-4-20250514"],
  "Claude Sonnet 4": ["claude-sonnet-4", "claude-sonnet-4-20250514"],
  "Claude Sonnet 3.7": [
    "claude-3-7-sonnet-latest",
    "claude-3-7-sonnet-20250219",
  ],
  "Claude Sonnet 3.5": [
    "claude-3-5-sonnet-latest",
    "claude-3-5-sonnet-20241022",
  ],
  "Claude Haiku 3.5": ["claude-3-5-haiku-latest", "claude-3-5-haiku-20241022"],
  "Claude Haiku 3": ["claude-3-haiku-20240307"],
  "Claude Opus 3": ["claude-3-opus-latest", "claude-3-opus-20240229"],
};

interface LiteLLMEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  litellm_provider?: string;
}

async function main() {
  const res = await fetch(LITELLM_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch LiteLLM pricing: ${res.status} ${res.statusText}`,
    );
  }
  const table = (await res.json()) as Record<string, LiteLLMEntry>;

  const rates: Record<
    string,
    { inputUsdPerMTok: number; outputUsdPerMTok: number; source: string }
  > = {};
  const missing: string[] = [];

  for (const [label, candidates] of Object.entries(LABEL_TO_LITELLM_IDS)) {
    // Require BOTH input and output costs to be finite, positive numbers.
    // A partial upstream entry (schema change, typo) would otherwise emit
    // a 0-output override that silently undercounts real cost.
    const match = candidates.find((id) => {
      const entry = table[id];
      return (
        entry &&
        Number.isFinite(entry.input_cost_per_token) &&
        Number.isFinite(entry.output_cost_per_token) &&
        (entry.input_cost_per_token ?? 0) > 0 &&
        (entry.output_cost_per_token ?? 0) > 0
      );
    });
    if (!match) {
      missing.push(label);
      continue;
    }
    const entry = table[match];
    // LiteLLM stores USD per single token; we store USD per million.
    rates[label] = {
      inputUsdPerMTok: (entry.input_cost_per_token as number) * 1_000_000,
      outputUsdPerMTok: (entry.output_cost_per_token as number) * 1_000_000,
      source: match,
    };
  }

  const snapshot = {
    pricingAsOf: new Date().toISOString().slice(0, 10),
    source: LITELLM_URL,
    rates,
  };

  const outPath = resolve(
    __dirname,
    "..",
    "src",
    "lib",
    "pricing-snapshot.json",
  );
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");

  console.log(`Wrote ${outPath}`);
  console.log(`pricingAsOf: ${snapshot.pricingAsOf}`);
  console.log(`Models captured: ${Object.keys(rates).length}`);
  if (missing.length) {
    console.warn(
      `Missing from LiteLLM (kept hardcoded fallback): ${missing.join(", ")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
