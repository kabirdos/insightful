-- CreateIndex
-- Covers the token-rank count queries in the report GET route (filter on
-- visibility + isDraft, range/existence-check on totalTokens). Additive: a
-- plain CREATE INDEX takes a brief lock but is safe at the current table
-- size, and reads/writes are unaffected by the new index existing.
CREATE INDEX "InsightReport_visibility_isDraft_totalTokens_idx" ON "InsightReport"("visibility", "isDraft", "totalTokens");
