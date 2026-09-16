-- الحظر المؤقّت: الحساب قائمٌ وبياناته كما هي، ويُمنع الدخول حتى وقتٍ
-- يحدّده المشرف. `null` = غير محظور، وتاريخٌ مضى يبقى فيقول إنّه حُظر
-- يوماً — وذلك يُقرأ عند البلاغ التالي.
ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "suspendedReason" TEXT;
