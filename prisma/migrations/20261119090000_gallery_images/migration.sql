-- صورُ قاعة المعرض (القاعدة ٣٥٠): نقشُ الجدار والأرضيّة وإطارُ الصورة.
ALTER TABLE "StoreItem" ADD COLUMN "hallWallMediaId" TEXT;
ALTER TABLE "StoreItem" ADD COLUMN "hallFloorMediaId" TEXT;
ALTER TABLE "StoreItem" ADD COLUMN "hallFrameMediaId" TEXT;

CREATE UNIQUE INDEX "StoreItem_hallWallMediaId_key" ON "StoreItem"("hallWallMediaId");
CREATE UNIQUE INDEX "StoreItem_hallFloorMediaId_key" ON "StoreItem"("hallFloorMediaId");
CREATE UNIQUE INDEX "StoreItem_hallFrameMediaId_key" ON "StoreItem"("hallFrameMediaId");

ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_hallWallMediaId_fkey" FOREIGN KEY ("hallWallMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_hallFloorMediaId_fkey" FOREIGN KEY ("hallFloorMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_hallFrameMediaId_fkey" FOREIGN KEY ("hallFrameMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
