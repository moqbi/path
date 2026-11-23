-- تشارمٌ حصريٌّ لوسم (القاعدة ٤٧٩).
ALTER TABLE "StoreItem" ADD COLUMN "exclusiveTagId" TEXT;
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_exclusiveTagId_fkey" FOREIGN KEY ("exclusiveTagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StoreItem_exclusiveTagId_idx" ON "StoreItem"("exclusiveTagId");
