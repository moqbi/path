-- رقمُ الجوال ومزامنةُ جهات الاتصال أُلغيا بقرار المالك — الأعمدةُ تذهب معهما.
DROP TABLE IF EXISTS "PhoneCode";
DROP INDEX IF EXISTS "User_phone_key";
DROP INDEX IF EXISTS "User_phoneHash_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneVerifiedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "phoneSkippedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "findByPhone";
