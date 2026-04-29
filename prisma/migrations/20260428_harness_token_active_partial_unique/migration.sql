-- Enforce "at most one active HarnessToken per user" at the database
-- level. The application code in src/lib/harness-tokens.ts revokes
-- prior active tokens before inserting a new one, but a transaction
-- alone cannot prevent two concurrent mints from both finding zero
-- rows to revoke and then both inserting fresh active rows. A
-- Postgres partial unique index closes that race.
--
-- Prisma 6's schema DSL does not express a `WHERE` clause on
-- `@@unique`, so this constraint lives in SQL only. The matching
-- comment in prisma/schema.prisma documents that the DB enforces it.
CREATE UNIQUE INDEX "HarnessToken_userId_active_unique"
  ON "HarnessToken" ("userId")
  WHERE "revokedAt" IS NULL;
