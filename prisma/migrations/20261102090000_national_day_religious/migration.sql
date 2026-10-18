-- المناسباتُ الإسلاميّة غيرُ الوطنيّة في التقويم (القاعدة ٢٩٢).
ALTER TABLE "NationalDay" ADD COLUMN "religious" BOOLEAN NOT NULL DEFAULT false;

-- ما بُذر قبلها: الهجريُّ للجميع إسلاميّ.
UPDATE "NationalDay" SET "religious" = true WHERE "country" = 'ALL' AND "calendar" = 'HIJRI';
