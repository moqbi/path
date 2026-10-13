-- النوت تُنشر أغنيتُها كاملةً أو مقصوصة (القاعدة ٢٧٧).
ALTER TABLE "StatusNote" ADD COLUMN "trackSeconds" INTEGER NOT NULL DEFAULT 20;

-- والقصّةُ تأخذ أغنيتَها من دِيزر كالنوت.
ALTER TABLE "Story" ADD COLUMN "trackId" TEXT;
ALTER TABLE "Story" ADD COLUMN "trackTitle" TEXT;
ALTER TABLE "Story" ADD COLUMN "trackArtist" TEXT;
ALTER TABLE "Story" ADD COLUMN "trackCover" TEXT;
ALTER TABLE "Story" ADD COLUMN "trackStart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Story" ADD COLUMN "trackSeconds" INTEGER;
ALTER TABLE "Story" ADD COLUMN "videoMuted" BOOLEAN NOT NULL DEFAULT false;
