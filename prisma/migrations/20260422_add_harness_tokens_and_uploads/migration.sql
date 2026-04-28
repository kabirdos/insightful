-- Add HarnessToken and HarnessUpload models for the insight-harness direct-POST
-- upload path. Tokens are split-format (public selector + bcrypt'd secret) and
-- HarnessUpload backs both X-Upload-Id idempotency and rate-limit counters.
-- Additive only: existing rows are unaffected.

-- CreateTable HarnessToken
CREATE TABLE "HarnessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "hashedSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "HarnessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable HarnessUpload
CREATE TABLE "HarnessUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "slug" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarnessUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (unique selector)
CREATE UNIQUE INDEX "HarnessToken_selector_key" ON "HarnessToken"("selector");

-- CreateIndex
CREATE INDEX "HarnessToken_userId_revokedAt_idx" ON "HarnessToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "HarnessToken_userId_createdAt_idx" ON "HarnessToken"("userId", "createdAt");

-- CreateIndex (unique idempotency key)
CREATE UNIQUE INDEX "HarnessUpload_userId_uploadId_key" ON "HarnessUpload"("userId", "uploadId");

-- CreateIndex
CREATE INDEX "HarnessUpload_userId_createdAt_idx" ON "HarnessUpload"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "HarnessToken" ADD CONSTRAINT "HarnessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarnessUpload" ADD CONSTRAINT "HarnessUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
