-- المدينة المكتشفة منفصلةٌ عن المكتوبة: الأولى للحظة الوصول، والثانية لصاحبها.
ALTER TABLE "User" ADD COLUMN "lastCity" TEXT;
ALTER TABLE "User" ADD COLUMN "cityLocked" BOOLEAN NOT NULL DEFAULT false;
-- ما كان محفوظاً يصير نقطةَ البداية، فلا يُكتب «وصل إلى» لمن لم يتحرّك.
UPDATE "User" SET "lastCity" = "city";
