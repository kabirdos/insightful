"use client";

import type { HarnessData } from "@/types/insights";
import TokenBreakdownDonut from "./TokenBreakdownDonut";

/** Per-skill token spend (last 30 days). Null/empty map → renders null. */
export default function SkillTokensDonut({
  harnessData,
}: {
  harnessData: HarnessData;
}) {
  return (
    <TokenBreakdownDonut
      data={harnessData.perSkillTokens}
      perModelTokens={harnessData.perModelTokens}
      title="By skill"
      unit="skills"
    />
  );
}
