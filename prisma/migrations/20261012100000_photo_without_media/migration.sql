-- لحظةُ صورةٍ نُشرت بلا صورة كانت تُلبَس تدرّجاً عشوائيّاً فتنزل قالباً أصفر
-- فارغاً فوق نصّها — بقرار المالك تصير خاطرةً بنصّها. وما لا نصَّ له يبقى.
UPDATE "Moment"
   SET "kind" = 'THOUGHT', "imageSpec" = NULL
 WHERE "kind" = 'PHOTO'
   AND "mediaId" IS NULL
   AND "imageSpec" IS NOT NULL
   AND "text" IS NOT NULL
   AND btrim("text") <> '';
