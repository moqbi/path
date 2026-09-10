-- المتجر يكبر من اللوحة: تصنيفات تُضاف وتُرتّب بلا نشر نسخة.
ALTER TYPE "StoreItemKind" ADD VALUE IF NOT EXISTS 'THEME';
ALTER TYPE "StoreItemKind" ADD VALUE IF NOT EXISTS 'CHARM';

CREATE TABLE "StoreCategory" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreCategory_slug_key" ON "StoreCategory"("slug");

ALTER TABLE "StoreItem" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "StoreItem" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StoreItem" ADD COLUMN "limited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StoreItem"
  ADD CONSTRAINT "StoreItem_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StoreItem_categoryId_sortOrder_idx" ON "StoreItem"("categoryId", "sortOrder");
