-- الهدية: شراءٌ يدفعه واحد ويملكه آخر. نحفظ المُهدي في الشراء نفسه
-- فيُقرأ منه إشعار «أهداك…» بلا جدول ثانٍ يُصان.
ALTER TABLE "Purchase" ADD COLUMN "giftedById" TEXT;

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_giftedById_fkey"
  FOREIGN KEY ("giftedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Purchase_giftedById_createdAt_idx" ON "Purchase"("giftedById", "createdAt");
