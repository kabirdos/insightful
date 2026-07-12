"use client";

import type { HarnessData } from "@/types/insights";
import TokenBreakdownDonut from "./TokenBreakdownDonut";

/** Per-repository token spend (last 30 days). Null/empty map → renders null. */
export default function RepoTokensDonut({
  harnessData,
}: {
  harnessData: HarnessData;
}) {
  return (
    <TokenBreakdownDonut
      data={harnessData.perRepoTokens}
      perModelTokens={harnessData.perModelTokens}
      title="By repository"
      unit="repos"
    />
  );
}
