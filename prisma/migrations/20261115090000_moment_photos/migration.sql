-- الصورُ بعد الأولى في لحظة الصور (القاعدة ٣٤٣).
CREATE TABLE "MomentPhoto" (
    "id" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "MomentPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MomentPhoto_mediaId_key" ON "MomentPhoto"("mediaId");
CREATE INDEX "MomentPhoto_momentId_position_idx" ON "MomentPhoto"("momentId", "position");
ALTER TABLE "MomentPhoto" ADD CONSTRAINT "MomentPhoto_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MomentPhoto" ADD CONSTRAINT "MomentPhoto_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
