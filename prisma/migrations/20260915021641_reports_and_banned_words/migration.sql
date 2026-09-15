-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('MOMENT', 'STORY', 'MESSAGE', 'USER');

-- CreateEnum
CREATE TYPE "ReportState" AS ENUM ('OPEN', 'KEPT', 'REMOVED');

-- DropIndex
DROP INDEX "StoreItem_categoryId_sortOrder_idx";

-- DropIndex
DROP INDEX "User_tagId_idx";

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "target" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "snippet" TEXT,
    "state" "ReportState" NOT NULL DEFAULT 'OPEN',
    "handledAt" TIMESTAMP(3),
    "handledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannedWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "hard" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_state_createdAt_idx" ON "Report"("state", "createdAt");

-- CreateIndex
CREATE INDEX "Report_reportedId_idx" ON "Report"("reportedId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_target_targetId_key" ON "Report"("reporterId", "target", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BannedWord_word_key" ON "BannedWord"("word");

-- CreateIndex
CREATE INDEX "BannedWord_hard_idx" ON "BannedWord"("hard");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
