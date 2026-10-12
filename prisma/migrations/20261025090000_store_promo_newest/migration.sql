-- صورةُ بطاقة الإعلان (القاعدة ٢٧٢).
ALTER TABLE "StoreItem" ADD COLUMN "promoMediaId" TEXT;
CREATE UNIQUE INDEX "StoreItem_promoMediaId_key" ON "StoreItem"("promoMediaId");
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_promoMediaId_fkey" FOREIGN KEY ("promoMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- الأحدثُ أوّلاً — بقرار المالك: كان الصنفُ الجديد يأخذ آخرَ ترتيب فيظهر في آخر
-- المتجر. يُرقَّم ما في المتجر من الأحدث إلى الأقدم مرّةً، وما يُضاف بعدها يأخذ
-- الأوّلَ ويُزاح غيرُه.
UPDATE "StoreItem" AS s SET "sortOrder" = r.n
FROM (SELECT "id", (row_number() OVER (ORDER BY "createdAt" DESC))::int AS n FROM "StoreItem") AS r
WHERE s."id" = r."id";
