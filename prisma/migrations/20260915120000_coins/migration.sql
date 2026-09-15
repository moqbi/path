-- النقاط عملةُ المتجر الوحيدة.
--
-- كان الرصيد والأسعار بالهللات، والآن بالنقاط — والصرف ١ نقطة = ٣
-- هللات (١٠٠٠ نقطة = ٣٠ ر.س، وهي قيمة رصيد آثار+ الشهري نفسها). فكل
-- سعرٍ قائم يُقسَم على ثلاثة ويُقرَّب، وكل رصيدٍ قائم كذلك: لا أحد يخسر
-- ما يملك ولا يربح في التحويل.

ALTER TABLE "User" RENAME COLUMN "storeCredit" TO "coins";
UPDATE "User" SET "coins" = ROUND("coins" / 3.0);

ALTER TABLE "StoreItem" RENAME COLUMN "priceHalalas" TO "priceCoins";
UPDATE "StoreItem" SET "priceCoins" = ROUND("priceCoins" / 3.0);

ALTER TABLE "Purchase" RENAME COLUMN "paidHalalas" TO "paidCoins";
UPDATE "Purchase" SET "paidCoins" = ROUND("paidCoins" / 3.0);

CREATE TABLE "CoinPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "priceHalalas" INTEGER NOT NULL,
    "sku" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinPack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoinTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT,
    "coins" INTEGER NOT NULL,
    "paidHalalas" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'STORE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTopUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoinTopUp_eventId_key" ON "CoinTopUp"("eventId");
CREATE INDEX "CoinTopUp_userId_createdAt_idx" ON "CoinTopUp"("userId", "createdAt");

ALTER TABLE "CoinTopUp" ADD CONSTRAINT "CoinTopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinTopUp" ADD CONSTRAINT "CoinTopUp_packId_fkey" FOREIGN KEY ("packId") REFERENCES "CoinPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- الباقات الثلاث الأولى. تُعدَّل وتُزاد من اللوحة بعد ذلك، و`sku` يبقى
-- فارغاً حتى يُنشأ المنتج في المتجرين فلا تُعرض باقةٌ لا تُشترى.
INSERT INTO "CoinPack" ("id", "name", "coins", "priceHalalas", "sortOrder") VALUES
  ('pack_500',  '٥٠٠ نقطة',   500,  1500, 1),
  ('pack_1000', '١٠٠٠ نقطة', 1000,  3000, 2),
  ('pack_2000', '٢٠٠٠ نقطة', 2000,  6000, 3);
