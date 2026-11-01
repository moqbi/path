-- موضعُ اللحظة لصاحبها وحده (القاعدة ٣٨١)، وما حُفظ قبلها بنقطته يُنسخ إليه.
ALTER TABLE "Moment" ADD COLUMN "ownLat" DOUBLE PRECISION, ADD COLUMN "ownLng" DOUBLE PRECISION;
UPDATE "Moment" SET "ownLat" = "lat", "ownLng" = "lng" WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL;
