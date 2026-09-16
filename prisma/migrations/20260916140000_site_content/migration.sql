-- محتوى الموقع العام من اللوحة: نصوصٌ وصورٌ وروابطُ تواصل.
--
-- النصّ صفٌّ يُنشأ عند أوّل تعديل لا عند البذر: الافتراضيّ في الكود،
-- فلا تُملأ القاعدة بمئة صفٍّ لم يمسسها أحد، وحذفُ الصفّ يردّ الافتراضيّ.
CREATE TABLE "SiteText" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteText_pkey" PRIMARY KEY ("key")
);

-- صور الموقع تُخزَّن كبقية الصور في `Media` (القاعدة ١٢ و١٠١) —
-- لا مسارٌ يُكتب في الكود ولا ملفٌّ يُرفع مع النشر.
CREATE TABLE "SiteImage" (
    "key" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteImage_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "SiteImage_mediaId_key" ON "SiteImage"("mediaId");

ALTER TABLE "SiteImage" ADD CONSTRAINT "SiteImage_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- روابط التواصل: صفوفٌ لا قائمةٌ في الكود — حسابٌ جديد يُضاف بلا نشر
-- نسخة، وحسابٌ يُغلق يُخفى بضغطة.
CREATE TABLE "SocialLink" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialLink_hidden_sortOrder_idx" ON "SocialLink"("hidden", "sortOrder");
