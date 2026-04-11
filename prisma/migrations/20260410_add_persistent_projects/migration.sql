-- Add user-owned Project model and ReportProject junction table.
-- ProjectLink is intentionally left in place for this migration; it is
-- dropped in a subsequent migration after consumers (upload flow,
-- API routes, components) have been migrated to the new model.

-- CreateTable Project
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "githubUrl" TEXT,
    "liveUrl" TEXT,
    "ogImage" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "favicon" TEXT,
    "siteName" TEXT,
    "metadataFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable ReportProject
CREATE TABLE "ReportProject" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "ReportProject_reportId_idx" ON "ReportProject"("reportId");

-- CreateIndex
CREATE INDEX "ReportProject_projectId_idx" ON "ReportProject"("projectId");

-- CreateIndex (unique)
CREATE UNIQUE INDEX "ReportProject_reportId_projectId_key" ON "ReportProject"("reportId", "projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportProject" ADD CONSTRAINT "ReportProject_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InsightReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportProject" ADD CONSTRAINT "ReportProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
