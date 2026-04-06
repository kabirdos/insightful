/**
 * Minimal shapes asserted by GET /api/insights and GET /api/insights/[slug].
 * These exist to make the v2 scalar fields a compile-time contract — if a
 * refactor ever drops one of these fields from a route response, TypeScript
 * will complain.
 */
import type { ChartData, SkillKey } from "./insights";

export interface InsightReportListItemContract {
  slug: string;
  detectedSkills: SkillKey[] | string[];
  dayCount: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  fileCount: number | null;
}

export interface InsightReportDetailContract extends InsightReportListItemContract {
  chartData: ChartData | null | unknown; // unknown because Prisma Json? is `any`/`JsonValue`
}
