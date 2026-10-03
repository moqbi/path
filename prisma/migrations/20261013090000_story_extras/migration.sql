-- ملصقات القصة وصوتها وتفاعلات مشاهديها (القاعدة ٢٣٨).
ALTER TABLE "Story" ADD COLUMN "stickers" JSONB;
ALTER TABLE "Story" ADD COLUMN "audioMediaId" TEXT;
ALTER TABLE "Story" ADD COLUMN "audioSeconds" INTEGER;
CREATE UNIQUE INDEX "Story_audioMediaId_key" ON "Story"("audioMediaId");
ALTER TABLE "Story" ADD CONSTRAINT "Story_audioMediaId_fkey" FOREIGN KEY ("audioMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoryView" ADD COLUMN "reaction" "ReactionKind";
ALTER TABLE "StoryView" ADD COLUMN "reactedAt" TIMESTAMP(3);
