-- من أضاف حساباً مفتوحاً يتابعه ولا يصادقه (القاعدة ٢٦٣).
ALTER TABLE "Friendship" ADD COLUMN "follow" BOOLEAN NOT NULL DEFAULT false;

-- ما قبله: صداقةٌ قُبلت تلقائياً لأنّ المُضاف حسابٌ مفتوح والمُضيفُ ليس كذلك.
UPDATE "Friendship" f SET "follow" = true
FROM "User" a, "User" r
WHERE f."addresseeId" = a.id AND f."requesterId" = r.id
  AND f.status = 'ACCEPTED' AND a."isOpen" = true AND r."isOpen" = false;

-- سطورُ أحداث المجموعة: الإضافةُ والإزالةُ والمغادرة (القاعدة ٢٦٤).
ALTER TABLE "GroupMessage" ADD COLUMN "system" BOOLEAN NOT NULL DEFAULT false;

-- بطاقةُ إعلان الصنف عند فتح التطبيق (القاعدة ٢٦٧).
ALTER TABLE "StoreItem" ADD COLUMN "promoAt" TIMESTAMP(3), ADD COLUMN "promoText" TEXT;
ALTER TABLE "User" ADD COLUMN "promoSeenAt" TIMESTAMP(3);
