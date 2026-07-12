import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TokenBreakdownDonut from "@/components/TokenBreakdownDonut";
import RepoTokensDonut from "@/components/RepoTokensDonut";
import type { HarnessData, HarnessModelTokenBreakdown } from "@/types/insights";

const b = (n: number): HarnessModelTokenBreakdown => ({
  input: n,
  output: n,
  cache_read: n,
  cache_create: n,
});

function render(
  data: Record<string, HarnessModelTokenBreakdown> | null | undefined,
): string {
  return renderToStaticMarkup(
    <TokenBreakdownDonut
      data={data}
      perModelTokens={{ "claude-sonnet-4-6": b(1_000_000) }}
      title="By repository"
      unit="repos"
    />,
  );
}

describe("TokenBreakdownDonut", () => {
  it("renders nothing for a null map (pre-2.12 report)", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });

  it("renders nothing for an empty map (zero attribution)", () => {
    expect(render({})).toBe("");
  });

  it("renders nothing when every entry sums to zero tokens", () => {
    expect(render({ repo: b(0) })).toBe("");
  });

  it("renders the title and a slice legend when data is present", () => {
    const html = render({ insightful: b(250_000), other: b(100_000) });
    expect(html).toContain("By repository");
    expect(html).toContain("insightful");
    // Token total shown in the donut center (1.4M = 4 × 350K).
    expect(html).toContain("1.4M");
  });

  it("collapses entries beyond topN into an Other bucket", () => {
    const data: Record<string, HarnessModelTokenBreakdown> = {};
    for (let i = 0; i < 10; i++) data[`repo${i}`] = b(1000 * (10 - i));
    const html = renderToStaticMarkup(
      <TokenBreakdownDonut
        data={data}
        perModelTokens={null}
        title="By repository"
        unit="repos"
        topN={8}
      />,
    );
    expect(html).toContain("Other (2)");
  });
});

describe("RepoTokensDonut wrapper", () => {
  const base = {} as HarnessData;

  it("returns null when its map is null", () => {
    const html = renderToStaticMarkup(
      <RepoTokensDonut
        harnessData={{ ...base, perRepoTokens: null, perModelTokens: null }}
      />,
    );
    expect(html).toBe("");
  });

  it("renders when its map has data", () => {
    const html = renderToStaticMarkup(
      <RepoTokensDonut
        harnessData={{
          ...base,
          perRepoTokens: { insightful: b(500_000) },
          perModelTokens: { "claude-sonnet-4-6": b(1_000_000) },
        }}
      />,
    );
    expect(html).toContain("By repository");
    expect(html).toContain("insightful");
  });
});
