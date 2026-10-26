-- ثوبُ قاعة المعرض صنفٌ في المتجر (القاعدة ٣٤٨).
ALTER TYPE "StoreItemKind" ADD VALUE 'GALLERY';
ALTER TABLE "StoreItem" ADD COLUMN "hallSkin" TEXT;
ALTER TABLE "User" ADD COLUMN "hallId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "StoreItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
