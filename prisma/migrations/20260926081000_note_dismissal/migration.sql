-- حذفُ الإشعارات: ختمٌ لـ«احذف الكل»، وجدولٌ لما حُذف واحداً واحداً.
ALTER TABLE "User" ADD COLUMN "notesClearedAt" TIMESTAMP(3);

CREATE TABLE "NoteDismissal" (
    "userId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoteDismissal_pkey" PRIMARY KEY ("userId","noteId")
);

ALTER TABLE "NoteDismissal" ADD CONSTRAINT "NoteDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
