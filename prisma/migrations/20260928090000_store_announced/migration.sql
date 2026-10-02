-- متى نُبِّه الناسُ بالصنف. وما في المتجر قبل هذه الهجرة يُختم الآن:
-- إعلانُ عشرات الأصناف القديمة دفعةً واحدة يوم النشر ضجيجٌ لا خبر.
ALTER TABLE "StoreItem" ADD COLUMN "announcedAt" TIMESTAMP(3);
UPDATE "StoreItem" SET "announcedAt" = CURRENT_TIMESTAMP;
