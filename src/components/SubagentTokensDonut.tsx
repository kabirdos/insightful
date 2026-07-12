"use client";

import type { HarnessData } from "@/types/insights";
import TokenBreakdownDonut from "./TokenBreakdownDonut";

/** Per-subagent token spend (last 30 days). Null/empty map → renders null. */
export default function SubagentTokensDonut({
  harnessData,
}: {
  harnessData: HarnessData;
}) {
  return (
    <TokenBreakdownDonut
      data={harnessData.perSubagentTokens}
      perModelTokens={harnessData.perModelTokens}
      title="By subagent"
      unit="subagents"
    />
  );
}
