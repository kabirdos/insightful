import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HeroStats from "@/components/HeroStats";
import type { HarnessStats } from "@/types/insights";

// Feature B7: the report hero surfaces an estimated API-cost stat — the
// "$X at API rates vs a flat plan" flex. It must reuse src/lib/api-cost.ts
// exactly as the homepage card and OG image do (so numbers agree across
// surfaces), use the literal "api cost / wk" label, and — critically — never
// render a bare "$0" for reports with no cost data (old / Codex-only reports).

const baseStats: HarnessStats = {
  totalTokens: 0,
  durationHours: 0,
  avgSessionMinutes: 0,
  skillsUsedCount: 0,
  hooksCount: 0,
  prCount: 0,
};

describe("HeroStats — estimated API cost", () => {
  it("renders the cost stat from a per-model token breakdown", () => {
    const html = renderToStaticMarkup(
      <HeroStats
        stats={{ ...baseStats, totalTokens: 100_000_000 }}
        dayCount={7}
        sessionCount={0}
        perModelTokens={{
          "claude-sonnet-4-6": {
            input: 100_000_000,
            output: 0,
            cache_read: 0,
            cache_create: 0,
          },
        }}
      />,
    );
    expect(html).toContain("api cost / wk");
    expect(html).toContain("$");
    expect(html).not.toContain("$0");
  });

  it("renders a fallback cost from a token total (agreeing with the homepage card)", () => {
    // Old reports ship a token total but no per-model breakdown. The homepage
    // card still shows an api-cost/wk via estimateApiCostUsd's fallback rate,
    // so the hero must too — otherwise the same report disagrees across pages.
    const html = renderToStaticMarkup(
      <HeroStats
        stats={{ ...baseStats, totalTokens: 10_000_000 }}
        dayCount={7}
        sessionCount={0}
      />,
    );
    expect(html).toContain("api cost / wk");
    expect(html).toContain("$");
    expect(html).not.toContain("$0");
  });

  it("omits the cost stat entirely when there is no cost data (no '$0')", () => {
    // No tokens, no models, no per-model breakdown → nothing to price.
    const html = renderToStaticMarkup(
      <HeroStats stats={baseStats} dayCount={7} sessionCount={12} />,
    );
    expect(html).not.toContain("api cost / wk");
    // A confident "$0" reads as a false claim; assert no currency at all.
    expect(html).not.toContain("$");
  });

  it("omits the cost stat when there is no day count to slice per-week", () => {
    // The label is "/wk"; without a day count we can't compute a weekly rate,
    // matching how the homepage omits every per-week stat in that case.
    const html = renderToStaticMarkup(
      <HeroStats
        stats={{ ...baseStats, totalTokens: 10_000_000 }}
        dayCount={null}
        sessionCount={0}
        perModelTokens={{
          "claude-sonnet-4-6": {
            input: 100_000_000,
            output: 0,
            cache_read: 0,
            cache_create: 0,
          },
        }}
      />,
    );
    expect(html).not.toContain("api cost / wk");
  });
});
