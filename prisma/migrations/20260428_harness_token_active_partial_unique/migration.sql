-- Defensive dedup: if any environment already has two active tokens for the same user
-- (the state the prior race could have produced), revoke all but the "best" per user
-- before adding the partial unique index. Ranking prefers the actually-usable token:
--   1. Already-expired rows lose first (CASE puts them at the bottom).
--   2. Among non-expired, recently-used wins (`lastUsedAt DESC NULLS LAST`).
--   3. Tie-break on `createdAt DESC` so a fresh-but-unused row beats an older unused one.
-- This is a no-op in production today since the HarnessToken model is brand new and empty.
UPDATE "HarnessToken"
SET "revokedAt" = NOW()
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "userId"
        ORDER BY
          CASE WHEN "expiresAt" < NOW() THEN 1 ELSE 0 END,
          "lastUsedAt" DESC NULLS LAST,
          "createdAt" DESC
      ) AS rn
    FROM "HarnessToken"
    WHERE "revokedAt" IS NULL
  ) t
  WHERE t.rn > 1
);

-- At-most-one-active-token-per-user invariant. The schema cannot express the WHERE clause
-- in Prisma 6.19.3's DSL, so this index lives here only. Do not run `prisma db pull` —
-- it will silently drop this constraint.
CREATE UNIQUE INDEX "HarnessToken_userId_active_unique"
  ON "HarnessToken" ("userId")
  WHERE "revokedAt" IS NULL;
