-- AlterTable
-- Widen InsightReport.totalTokens from INT4 (max 2.15B) to BIGINT (max 9.2E18).
-- insight-harness v2.7.0 includes cache_read + cache_create tokens in the
-- total, so modern harness reports routinely exceed INT4 range (e.g. 5B+).
ALTER TABLE "InsightReport"
  ALTER COLUMN "totalTokens" TYPE BIGINT USING "totalTokens"::BIGINT;
