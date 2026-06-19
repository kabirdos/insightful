-- AlterTable
-- Additive: new array column with an empty default. No existing data is read
-- or modified, so this is safe to apply on a live table. Mirrors the existing
-- "hiddenHarnessSections" column so narrative-section hides become reversible
-- (the section's JSON column is left intact; this array only suppresses display).
ALTER TABLE "InsightReport" ADD COLUMN     "hiddenNarrativeSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
