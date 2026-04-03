-- Add enhanced stat fields to InsightReport
ALTER TABLE "InsightReport" ADD COLUMN IF NOT EXISTS "linesAdded" INTEGER;
ALTER TABLE "InsightReport" ADD COLUMN IF NOT EXISTS "linesRemoved" INTEGER;
ALTER TABLE "InsightReport" ADD COLUMN IF NOT EXISTS "fileCount" INTEGER;
ALTER TABLE "InsightReport" ADD COLUMN IF NOT EXISTS "dayCount" INTEGER;
ALTER TABLE "InsightReport" ADD COLUMN IF NOT EXISTS "msgsPerDay" DOUBLE PRECISION;
