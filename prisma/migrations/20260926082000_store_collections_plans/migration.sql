-- صلاحيةُ البلاغات، ولحظةُ منح الوسم.
ALTER TYPE "AdminScope" ADD VALUE 'REPORTS';
ALTER TYPE "MomentKind" ADD VALUE 'TAG_GRANTED';

-- مجموعاتُ المتجر داخل أنواعه.
CREATE TABLE "StoreCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "StoreItemKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreCollection_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StoreItem" ADD COLUMN "collectionId" TEXT;
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "StoreCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- مُدَدُ الشراء وأسعارُها، ونهايةُ ما اشتُري بمدّة.
CREATE TABLE "StoreItemPlan" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "priceCoins" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StoreItemPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreItemPlan_itemId_days_key" ON "StoreItemPlan"("itemId", "days");
ALTER TABLE "StoreItemPlan" ADD CONSTRAINT "StoreItemPlan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StoreItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Purchase" ADD COLUMN "expiresAt" TIMESTAMP(3);
