-- Drop the global unique on slug. Belt-and-suspenders: handle both shapes,
-- since environments managed via prisma migrate enforce uniqueness as a
-- constraint while environments managed via db push or raw SQL may have it
-- as a bare unique index. IF EXISTS makes both no-ops when not applicable.
ALTER TABLE "InsightReport" DROP CONSTRAINT IF EXISTS "InsightReport_slug_key";
DROP INDEX IF EXISTS "InsightReport_slug_key";

-- Add a per-author composite unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "InsightReport_authorId_slug_key" ON "InsightReport"("authorId", "slug");
