-- جرسُ مجموعات الملصقات الجديدة وبطاقةُ إعلانها (القاعدة ٣٣٥).
ALTER TABLE "StickerPack" ADD COLUMN "announcedAt" TIMESTAMP(3);
ALTER TABLE "StickerPack" ADD COLUMN "promoAt" TIMESTAMP(3);

-- ما في القاعدة قبلها مختومٌ: مجموعاتٌ قديمة دفعةً واحدة ضجيجٌ لا خبر (كالقاعدة ١٧٧).
UPDATE "StickerPack" SET "announcedAt" = "createdAt";
