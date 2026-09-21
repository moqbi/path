-- ما تحمله الحزمة من أصناف.
CREATE TABLE "BundleItem" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BundleItem_bundleId_itemId_key" ON "BundleItem"("bundleId", "itemId");
CREATE INDEX "BundleItem_itemId_idx" ON "BundleItem"("itemId");

ALTER TABLE "BundleItem"
  ADD CONSTRAINT "BundleItem_bundleId_fkey"
  FOREIGN KEY ("bundleId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BundleItem"
  ADD CONSTRAINT "BundleItem_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
