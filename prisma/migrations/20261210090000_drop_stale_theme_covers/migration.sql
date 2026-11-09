-- غلافٌ نُسخ من ثيمٍ لم يعد ملبوساً يذهب (القاعدة ٤٤٤). الملفُّ يبقى بلا صاحب
-- فيكنسه `sweepOrphans` بكائنه بعد يوم (القاعدة ٤٢٥).
UPDATE "User"
SET "coverMediaId" = NULL, "coverItemId" = NULL, "coverY" = 50, "coverX" = 50, "coverZoom" = 100
WHERE "coverItemId" IS NOT NULL
  AND ("backgroundId" IS NULL OR "backgroundId" <> "coverItemId");
