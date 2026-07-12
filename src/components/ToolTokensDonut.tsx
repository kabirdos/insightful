"use client";

import type { HarnessData } from "@/types/insights";
import TokenBreakdownDonut from "./TokenBreakdownDonut";

/** Per-tool token spend (last 30 days). Null/empty map → renders null. */
export default function ToolTokensDonut({
  harnessData,
}: {
  harnessData: HarnessData;
}) {
  return (
    <TokenBreakdownDonut
      data={harnessData.perToolTokens}
      perModelTokens={harnessData.perModelTokens}
      title="By tool"
      unit="tools"
    />
  );
}
