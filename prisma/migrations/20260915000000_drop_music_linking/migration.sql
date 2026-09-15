-- ربطُ حساب الموسيقى أُلغي: لا OAuth ولا مفاتيح ولا متغيّرات بيئة.
-- اللحظة الموسيقية تبقى برابطٍ يُلصق (oEmbed)، والحقول التي كانت تنتظر
-- الربط تذهب — لا عمودٌ يُكتب على أمل ميزةٍ قادمة.
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "musicProvider",
  DROP COLUMN IF EXISTS "musicAccountName",
  DROP COLUMN IF EXISTS "musicAccessToken",
  DROP COLUMN IF EXISTS "musicRefreshToken",
  DROP COLUMN IF EXISTS "musicTokenExpires";

DROP TYPE IF EXISTS "MusicProvider";
