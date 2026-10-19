-- إهداءُ مجموعات الملصقات المدفوعة (القاعدة ٢٩٨).
ALTER TABLE "StickerPurchase" ADD COLUMN "giftedById" TEXT;
CREATE INDEX "StickerPurchase_giftedById_createdAt_idx" ON "StickerPurchase"("giftedById", "createdAt");
ALTER TABLE "StickerPurchase" ADD CONSTRAINT "StickerPurchase_giftedById_fkey" FOREIGN KEY ("giftedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
