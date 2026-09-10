-- الثيم صورةٌ تُرفع فتصير خلفية التطبيق، والتميمة شعارٌ يُعلَّق تحت صورة العرض.
ALTER TABLE "StoreItem" ADD COLUMN "mediaId" TEXT;
CREATE UNIQUE INDEX "StoreItem_mediaId_key" ON "StoreItem"("mediaId");
ALTER TABLE "StoreItem"
  ADD CONSTRAINT "StoreItem_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "charmId" TEXT;
ALTER TABLE "User"
  ADD CONSTRAINT "User_charmId_fkey"
  FOREIGN KEY ("charmId") REFERENCES "StoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
