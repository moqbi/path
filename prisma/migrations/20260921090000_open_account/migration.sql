-- حسابٌ مفتوح: ملفُّه ولحظاتُه العامّة تُقرأ بلا صداقة، ويقبل الإضافة من الجميع.
ALTER TABLE "User" ADD COLUMN "isOpen" BOOLEAN NOT NULL DEFAULT false;
