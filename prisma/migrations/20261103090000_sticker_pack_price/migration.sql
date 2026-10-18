-- مجموعاتُ الملصقات: مع آثار+ (صفر) أو بالنقاط تُملَك (القاعدة ٢٩٤).
ALTER TABLE "StickerPack" ADD COLUMN "priceCoins" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StickerPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "paidCoins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StickerPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StickerPurchase_userId_packId_key" ON "StickerPurchase"("userId", "packId");

ALTER TABLE "StickerPurchase" ADD CONSTRAINT "StickerPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StickerPurchase" ADD CONSTRAINT "StickerPurchase_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StickerPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
