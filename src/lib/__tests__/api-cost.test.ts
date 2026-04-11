import { describe, expect, it } from "vitest";
import {
  estimateApiCostUsd,
  lookupModelRate,
  __testing__,
} from "../api-cost";

const { blendedRate, FALLBACK_RATE } = __testing__;

describe("lookupModelRate", () => {
  it("matches Opus 4.6 specifically (not the generic Opus fallback)", () => {
    const rate = lookupModelRate("claude-opus-4-6");
    expect(rate.label).toBe("Claude Opus 4.6");
    expect(rate.inputUsdPerMTok).toBe(5);
    expect(rate.outputUsdPerMTok).toBe(25);
  });

  it("matches Sonnet 4.6", () => {
    const rate = lookupModelRate("claude-sonnet-4-6");
    expect(rate.label).toBe("Claude Sonnet 4.6");
    expect(rate.inputUsdPerMTok).toBe(3);
    expect(rate.outputUsdPerMTok).toBe(15);
  });

  it("matches Haiku 4.5", () => {
    const rate = lookupModelRate("claude-haiku-4-5");
    expect(rate.label).toBe("Claude Haiku 4.5");
    expect(rate.inputUsdPerMTok).toBe(1);
    expect(rate.outputUsdPerMTok).toBe(5);
  });

  it("matches legacy Opus 4 / 4.1 at the higher \\$15/\\$75 rate", () => {
    expect(lookupModelRate("claude-opus-4-20250514").inputUsdPerMTok).toBe(15);
    expect(lookupModelRate("claude-opus-4-1").inputUsdPerMTok).toBe(15);
  });

  it("falls back to Sonnet rate for unknown model names", () => {
    const rate = lookupModelRate("totally-unknown-model");
    // FALLBACK_RATE is Sonnet 4.6 pricing
    expect(rate.inputUsdPerMTok).toBe(3);
    expect(rate.outputUsdPerMTok).toBe(15);
  });

  it("matches plain 'sonnet' to a Sonnet rate", () => {
    expect(lookupModelRate("sonnet").label).toMatch(/sonnet/i);
  });

  it("matches plain 'opus' to LEGACY Opus pricing (\\$15/\\$75) — never undercount", () => {
    const rate = lookupModelRate("opus");
    expect(rate.inputUsdPerMTok).toBe(15);
    expect(rate.outputUsdPerMTok).toBe(75);
  });

  it("matches Haiku 3.5 at \\$0.80/\\$4 (legacy)", () => {
    const a = lookupModelRate("claude-3-5-haiku-20241022");
    const b = lookupModelRate("haiku-3-5");
    expect(a.inputUsdPerMTok).toBe(0.8);
    expect(a.outputUsdPerMTok).toBe(4);
    expect(b.label).toBe("Claude Haiku 3.5");
  });

  it("matches Haiku 3 at \\$0.25/\\$1.25 (very legacy)", () => {
    const rate = lookupModelRate("claude-3-haiku-20240307");
    expect(rate.inputUsdPerMTok).toBe(0.25);
    expect(rate.outputUsdPerMTok).toBe(1.25);
  });

  it("matches Sonnet 3.7 / 3.5 at \\$3/\\$15", () => {
    expect(lookupModelRate("claude-3-7-sonnet").inputUsdPerMTok).toBe(3);
    expect(lookupModelRate("sonnet-3-5").inputUsdPerMTok).toBe(3);
  });

  it("matches Opus 3 at the legacy \\$15/\\$75 rate", () => {
    expect(lookupModelRate("claude-3-opus").inputUsdPerMTok).toBe(15);
  });
});

describe("estimateApiCostUsd", () => {
  it("returns 0 for zero tokens with no breakdown", () => {
    expect(estimateApiCostUsd(undefined, 0)).toBe(0);
    expect(estimateApiCostUsd({}, 0)).toBe(0);
  });

  it("returns 0 when every model entry is zero or negative", () => {
    expect(estimateApiCostUsd({ sonnet: 0, opus: 0 }, 0)).toBe(0);
    expect(estimateApiCostUsd({ sonnet: -100 }, 0)).toBe(0);
  });

  it("computes a single-model Sonnet 4.6 cost correctly (1M tokens)", () => {
    const cost = estimateApiCostUsd({ "claude-sonnet-4-6": 1_000_000 });
    // 70/30 blended: 0.7 * 3 + 0.3 * 15 = 2.1 + 4.5 = 6.6
    expect(cost).toBeCloseTo(6.6, 5);
  });

  it("computes a multi-model Sonnet + Opus mix correctly", () => {
    // 1M Sonnet 4.6 + 500K Opus 4.6
    // Sonnet: 1.0 * 6.6 = 6.6
    // Opus 4.6 blended: 0.7*5 + 0.3*25 = 3.5 + 7.5 = 11.0 → 0.5 * 11 = 5.5
    // Total: 12.1
    const cost = estimateApiCostUsd({
      "claude-sonnet-4-6": 1_000_000,
      "claude-opus-4-6": 500_000,
    });
    expect(cost).toBeCloseTo(12.1, 5);
  });

  it("uses Sonnet 4.6 fallback rate when breakdown is missing entirely", () => {
    // 1.7M tokens, fallback rate (Sonnet 4.6 blended = 6.6)
    // → 1.7 * 6.6 = 11.22
    const cost = estimateApiCostUsd(undefined, 1_700_000);
    expect(cost).toBeCloseTo(11.22, 4);
    // Confirm we are NOT using a "cheapest possible" rate (e.g. Haiku)
    expect(cost).toBeGreaterThan(5);
  });

  it("uses fallback when models is an empty object", () => {
    const cost = estimateApiCostUsd({}, 1_000_000);
    expect(cost).toBeCloseTo(blendedRate(FALLBACK_RATE), 5);
  });

  it("realistic 1.7M-token mix lands in the \\$20–\\$80 sanity range", () => {
    // Roughly Craig's mix: ~50% Sonnet 4.6, ~30% Opus 4.6, ~20% Opus 4
    // (legacy). Some users still pin to legacy Opus 4 for code review,
    // and the issue's expected order-of-magnitude is "tens of dollars".
    //
    //   Sonnet 4.6: 850K tokens × 6.6/M  = 5.61
    //   Opus 4.6 :  510K tokens × 11.0/M = 5.61
    //   Opus 4   :  340K tokens × 36.0/M = 12.24
    //                                       ─────
    //                                       23.46
    const cost = estimateApiCostUsd({
      "claude-sonnet-4-6": 850_000,
      "claude-opus-4-6": 510_000,
      "claude-opus-4-20250514": 340_000,
    });
    expect(cost).toBeGreaterThan(20);
    expect(cost).toBeLessThan(80);
  });

  it("realistic Sonnet+Opus mix from issue example is at least an order of magnitude above the buggy \\$0.97", () => {
    // Earlier helper produced ~\$0.97 for 1.7M tokens. Confirm we are
    // now well above that even on a Sonnet-heavy mix.
    const cost = estimateApiCostUsd({
      "claude-sonnet-4-6": 1_200_000,
      "claude-opus-4-6": 500_000,
    });
    // Sonnet: 1.2 * 6.6 = 7.92
    // Opus  : 0.5 * 11  = 5.50
    // Total  ≈ 13.42
    expect(cost).toBeGreaterThan(10);
    expect(cost).toBeCloseTo(13.42, 2);
  });

  it("rescales percentage-encoded breakdowns to token counts", () => {
    // Some legacy seed data ships models as percent-of-total instead
    // of raw token counts. If the sum is far smaller than the known
    // total tokens, treat as proportions.
    const cost = estimateApiCostUsd(
      { "claude-sonnet-4-6": 70, "claude-opus-4-6": 30 },
      1_000_000,
    );
    // 700K Sonnet 4.6 + 300K Opus 4.6
    // Sonnet: 0.7 * 6.6 = 4.62
    // Opus  : 0.3 * 11  = 3.30
    // Total  = 7.92
    expect(cost).toBeCloseTo(7.92, 5);
  });

  it("rescales dispatch-count shaped breakdowns (seed-demos regression)", () => {
    // Some seeded demo reports ship models as small integer dispatch
    // counts (e.g. {sonnet: 890, opus: 240, haiku: 120}) while the
    // real totalTokens is in the millions. Codex flagged this as a
    // path that previously returned \$0.02 instead of tens of dollars.
    const cost = estimateApiCostUsd(
      {
        "claude-sonnet-4-6": 890,
        "claude-opus-4-6": 240,
        "claude-haiku-4-5": 120,
      },
      4_200_000,
    );
    // Sum = 1250, total tokens = 4.2M → 1250/4.2M ≈ 0.03% → rescale.
    // sonnet share 0.712, opus share 0.192, haiku share 0.096
    //
    // Sonnet tokens ≈ 2,990,400 × 6.6/M = 19.74
    // Opus    tokens ≈ 806,400   × 11 /M =  8.87
    // Haiku   tokens ≈ 403,200   × 2.2/M =  0.89
    // Total ≈ 29.50
    expect(cost).toBeGreaterThan(20);
    expect(cost).toBeLessThan(80);
  });

  it("1.7M token mix shaped as counts (850/510/340) with fallbackTotalTokens still hits \\$20-\\$80", () => {
    // Same ratio as Craig's realistic mix, but expressed as small
    // count-shaped values that have to be rescaled against the
    // declared 1.7M total tokens.
    const cost = estimateApiCostUsd(
      {
        "claude-sonnet-4-6": 850,
        "claude-opus-4-6": 510,
        "claude-opus-4-20250514": 340,
      },
      1_700_000,
    );
    expect(cost).toBeGreaterThan(20);
    expect(cost).toBeLessThan(80);
  });

  it("treats large summed values as raw token counts, NOT proportions", () => {
    // If models sums to a plausible fraction of totalTokens, treat
    // as raw token counts.
    const cost = estimateApiCostUsd(
      { "claude-sonnet-4-6": 800_000, "claude-opus-4-6": 200_000 },
      1_000_000,
    );
    // Sonnet: 0.8 * 6.6 = 5.28
    // Opus  : 0.2 * 11  = 2.20
    // Total  = 7.48
    expect(cost).toBeCloseTo(7.48, 5);
  });

  it("ignores non-numeric or NaN entries in the breakdown", () => {
    const cost = estimateApiCostUsd({
      "claude-sonnet-4-6": 1_000_000,
      // @ts-expect-error — testing runtime resilience
      bad: "not a number",
      worse: NaN,
    });
    expect(cost).toBeCloseTo(6.6, 5);
  });

  it("falls back for completely missing input", () => {
    expect(estimateApiCostUsd(undefined)).toBe(0);
    expect(estimateApiCostUsd(undefined, undefined as unknown as number)).toBe(
      0,
    );
  });

  it("Haiku-only workload is much cheaper than Sonnet (sanity check ratio)", () => {
    const haikuCost = estimateApiCostUsd({
      "claude-haiku-4-5": 1_000_000,
    });
    const sonnetCost = estimateApiCostUsd({
      "claude-sonnet-4-6": 1_000_000,
    });
    // Haiku 4.5: 0.7*1 + 0.3*5 = 0.7 + 1.5 = 2.2
    // Sonnet 4.6: 6.6
    expect(haikuCost).toBeCloseTo(2.2, 5);
    expect(haikuCost).toBeLessThan(sonnetCost);
  });
});
