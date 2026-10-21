-- تعديلُ اللحظة والتعليق، وتنبيهُ القصّة والنوت (القاعدة ٣١٩).
ALTER TABLE "Moment" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN "editedAt" TIMESTAMP(3);

CREATE TABLE "StoryAlert" (
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryAlert_pkey" PRIMARY KEY ("userId","friendId")
);
CREATE INDEX "StoryAlert_friendId_idx" ON "StoryAlert"("friendId");
ALTER TABLE "StoryAlert" ADD CONSTRAINT "StoryAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryAlert" ADD CONSTRAINT "StoryAlert_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
