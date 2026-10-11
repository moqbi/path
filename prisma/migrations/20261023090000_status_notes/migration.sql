-- النوت (القاعدة ٢٦٩): فقاعةٌ فوق صورة صاحبها، يوماً ثمّ تذهب.
CREATE TABLE "StatusNote" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT,
    "trackId" TEXT,
    "trackTitle" TEXT,
    "trackArtist" TEXT,
    "trackCover" TEXT,
    "trackStart" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatusNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StatusNote_authorId_idx" ON "StatusNote"("authorId");
CREATE INDEX "StatusNote_expiresAt_idx" ON "StatusNote"("expiresAt");
ALTER TABLE "StatusNote" ADD CONSTRAINT "StatusNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusNote" ADD CONSTRAINT "StatusNote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FriendGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NoteView" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listenedAt" TIMESTAMP(3),
    "reaction" "ReactionKind",
    "reactedAt" TIMESTAMP(3),
    CONSTRAINT "NoteView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NoteView_noteId_userId_key" ON "NoteView"("noteId", "userId");
CREATE INDEX "NoteView_userId_idx" ON "NoteView"("userId");
ALTER TABLE "NoteView" ADD CONSTRAINT "NoteView_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "StatusNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteView" ADD CONSTRAINT "NoteView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
