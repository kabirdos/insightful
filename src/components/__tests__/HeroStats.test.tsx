import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HeroStats from "@/components/HeroStats";
import type {
  HarnessStats,
  HarnessModelTokenBreakdown,
} from "@/types/insights";

function makeStats(overrides: Partial<HarnessStats> = {}): HarnessStats {
  return {
    totalTokens: 0,
    durationHours: 0,
    avgSessionMinutes: 0,
    skillsUsedCount: 0,
    hooksCount: 0,
    prCount: 0,
    sessionCount: 100,
    commitCount: 0,
    ...overrides,
  };
}

function render(
  stats: HarnessStats,
  perModelTokens?: Record<string, HarnessModelTokenBreakdown> | null,
) {
  return renderToStaticMarkup(
    <HeroStats
      stats={stats}
      dayCount={30}
      sessionCount={stats.sessionCount ?? 0}
      perModelTokens={perModelTokens}
    />,
  );
}

describe("HeroStats token reframe", () => {
  it("headlines new-work tokens with a cache subtitle, not throughput", () => {
    const html = render(
      makeStats({
        totalTokens: 4_237_000_000, // 4-way throughput (cache-dominated)
        newTokens: 40_000_000, // input + output — the honest headline
        cacheReadTokens: 4_000_000_000,
        cacheReadRatio: 100,
      }),
    );
    expect(html).toContain("40.0M"); // headline = new work
    expect(html).not.toContain("4.2B"); // NOT the throughput total
    expect(html).toContain("100:1 cached");
    expect(html).toContain("4.0B reads");
  });

  it("hides the lifetime banner when there is no per-model data", () => {
    const html = render(
      makeStats({
        totalTokens: 4_237_000_000,
        newTokens: 40_000_000,
      }),
    );
    expect(html).not.toContain("Lifetime Tokens");
  });

  it("falls back to the throughput total for older reports (no newTokens)", () => {
    const html = render(makeStats({ totalTokens: 6_600_000 }));
    expect(html).toContain("6.6M"); // legacy headline
    expect(html).not.toContain("cached"); // no cache subtitle
    expect(html).not.toContain("Lifetime Tokens"); // no per-model data
  });

  it("derives the lifetime banner from per-model new-work tokens", () => {
    const html = render(
      makeStats({
        totalTokens: 4_237_000_000,
        newTokens: 40_000_000,
        cacheReadTokens: 4_000_000_000,
        cacheReadRatio: 100,
      }),
      {
        "claude-opus": {
          input: 60_000_000,
          output: 40_000_000, // lifetime new = 100M
          cache_read: 10_000_000_000, // lifetime ratio = 100:1
          cache_create: 0,
        },
      },
    );
    expect(html).toContain("Lifetime Tokens");
    expect(html).toContain("100M"); // lifetime new work
    expect(html).toContain("10.0B reads"); // lifetime cache-read volume
    expect(html).toContain("in last 30 days"); // 30-day new-work footnote
  });
});
