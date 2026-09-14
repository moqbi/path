-- رسالةٌ بصوتٍ أو صورة
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'VOICE', 'PHOTO');
ALTER TABLE "Message" ADD COLUMN "kind" "MessageKind" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "Message" ADD COLUMN "mediaId" TEXT;
ALTER TABLE "Message" ADD COLUMN "seconds" INTEGER;
CREATE UNIQUE INDEX "Message_mediaId_key" ON "Message"("mediaId");
ALTER TABLE "Message" ADD CONSTRAINT "Message_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- قصةٌ بفيديو وفلتر
ALTER TABLE "Story" ADD COLUMN "filter" TEXT;
ALTER TABLE "Story" ADD COLUMN "seconds" INTEGER;
