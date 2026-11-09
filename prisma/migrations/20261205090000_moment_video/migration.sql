-- مقطعُ اللحظة (القاعدة ٤٣٤): `mediaId` صورةُ غلافه و`videoId` المقطعُ نفسه.
ALTER TABLE "Moment" ADD COLUMN "videoId" TEXT;
CREATE UNIQUE INDEX "Moment_videoId_key" ON "Moment"("videoId");
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
