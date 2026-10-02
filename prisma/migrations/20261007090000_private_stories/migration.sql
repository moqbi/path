-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "private" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StoryAudience" (
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StoryAudience_pkey" PRIMARY KEY ("storyId","userId")
);

-- CreateIndex
CREATE INDEX "StoryAudience_userId_idx" ON "StoryAudience"("userId");

-- AddForeignKey
ALTER TABLE "StoryAudience" ADD CONSTRAINT "StoryAudience_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAudience" ADD CONSTRAINT "StoryAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

