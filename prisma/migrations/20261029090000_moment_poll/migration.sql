-- استطلاعُ المشرف على خاطرته (القاعدة ٢٨٩).
ALTER TABLE "Moment" ADD COLUMN "pollOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PollVote_momentId_userId_key" ON "PollVote"("momentId", "userId");

ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
