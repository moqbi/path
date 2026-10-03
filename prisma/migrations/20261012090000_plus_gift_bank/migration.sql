-- أيّامُ آثار+ المُهداة تُحفظ ولا تُدمج في تاريخ المتجر (القاعدة ٢٣٤)
ALTER TABLE "User" ADD COLUMN "plusGiftDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "plusGiftUntil" TIMESTAMP(3);
