-- Drop the global unique constraint on slug
ALTER TABLE "InsightReport" DROP CONSTRAINT IF EXISTS "InsightReport_slug_key";

-- Add a per-author composite unique constraint
CREATE UNIQUE INDEX "InsightReport_authorId_slug_key" ON "InsightReport"("authorId", "slug");
