-- تعليقاتٌ بلا اسمٍ على القصص والنوت (القاعدة ٣٤٤).
CREATE TABLE "StatusComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT,
    "noteId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StatusComment_storyId_createdAt_idx" ON "StatusComment"("storyId", "createdAt");
CREATE INDEX "StatusComment_noteId_createdAt_idx" ON "StatusComment"("noteId", "createdAt");
CREATE INDEX "StatusComment_userId_createdAt_idx" ON "StatusComment"("userId", "createdAt");
ALTER TABLE "StatusComment" ADD CONSTRAINT "StatusComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusComment" ADD CONSTRAINT "StatusComment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusComment" ADD CONSTRAINT "StatusComment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "StatusNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
