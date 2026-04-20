-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "githubUrl" TEXT,
    "twitterUrl" TEXT,
    "linkedinUrl" TEXT,
    "websiteUrl" TEXT,
    "setup" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightReport" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionCount" INTEGER,
    "messageCount" INTEGER,
    "commitCount" INTEGER,
    "dateRangeStart" TEXT,
    "dateRangeEnd" TEXT,
    "linesAdded" INTEGER,
    "linesRemoved" INTEGER,
    "fileCount" INTEGER,
    "dayCount" INTEGER,
    "msgsPerDay" DOUBLE PRECISION,
    "chartData" JSONB,
    "detectedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reportType" TEXT NOT NULL DEFAULT 'insights',
    "totalTokens" BIGINT,
    "durationHours" INTEGER,
    "avgSessionMinutes" DOUBLE PRECISION,
    "prCount" INTEGER,
    "autonomyLabel" TEXT,
    "harnessData" JSONB,
    "hiddenHarnessSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "atAGlance" JSONB,
    "interactionStyle" JSONB,
    "projectAreas" JSONB,
    "impressiveWorkflows" JSONB,
    "frictionAnalysis" JSONB,
    "suggestions" JSONB,
    "onTheHorizon" JSONB,
    "funEnding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "ReportProject" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionHighlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "parentId" TEXT,
    "sectionKey" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorAnnotation" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "InsightReport_authorId_slug_key" ON "InsightReport"("authorId", "slug");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "ReportProject_reportId_idx" ON "ReportProject"("reportId");

-- CreateIndex
CREATE INDEX "ReportProject_projectId_idx" ON "ReportProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportProject_reportId_projectId_key" ON "ReportProject"("reportId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionVote_userId_reportId_sectionKey_key" ON "SectionVote"("userId", "reportId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "SectionHighlight_userId_reportId_sectionKey_key" ON "SectionHighlight"("userId", "reportId", "sectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorAnnotation_reportId_sectionKey_key" ON "AuthorAnnotation"("reportId", "sectionKey");

-- AddForeignKey
ALTER TABLE "InsightReport" ADD CONSTRAINT "InsightReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportProject" ADD CONSTRAINT "ReportProject_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InsightReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportProject" ADD CONSTRAINT "ReportProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionVote" ADD CONSTRAINT "SectionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionVote" ADD CONSTRAINT "SectionVote_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InsightReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionHighlight" ADD CONSTRAINT "SectionHighlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionHighlight" ADD CONSTRAINT "SectionHighlight_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InsightReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InsightReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorAnnotation" ADD CONSTRAINT "AuthorAnnotation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InsightReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

