-- الملف يُرفع بالرابط المؤقّت ثم يُعتمد بعد فحص بايتاته.
-- ما قبل هذه الهجرة رُفع عبر الخادم وفُحص وقتها، فالافتراض «معتمد».
ALTER TABLE "Media" ADD COLUMN "ready" BOOLEAN NOT NULL DEFAULT true;

-- الغرض يُثبَّت وقت الطلب: حدود الحجم والصيغ تختلف بين صورةٍ وصوتٍ وفيديو،
-- وما وُقّع لصوتٍ لا يصلح لرفع فيديو تحت مفتاحه.
ALTER TABLE "Media" ADD COLUMN "purpose" TEXT;

-- المهجورة تُكنس: صفٌّ بقي غير معتمدٍ يعني رفعاً لم يتمّ.
CREATE INDEX "Media_ready_createdAt_idx" ON "Media" ("ready", "createdAt");
