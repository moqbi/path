-- الملصقات (القاعدة ٢٩١) والمناسبات الوطنيّة (القاعدة ٢٩٢).
-- CreateEnum
CREATE TYPE "CalendarKind" AS ENUM ('GREGORIAN', 'HIJRI');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "stickerId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "stickerId" TEXT;

-- CreateTable
CREATE TABLE "NationalDay" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "greeting" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "calendar" "CalendarKind" NOT NULL DEFAULT 'GREGORIAN',
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NationalDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickerPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StickerPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sticker" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NationalDay_country_idx" ON "NationalDay"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Sticker_mediaId_key" ON "Sticker"("mediaId");

-- CreateIndex
CREATE INDEX "Sticker_packId_sortOrder_idx" ON "Sticker"("packId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_packId_fkey" FOREIGN KEY ("packId") REFERENCES "StickerPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- مناسباتُ المملكة الأولى — صفوفٌ تُعدَّل وتُخفى من اللوحة كغيرها.
INSERT INTO "NationalDay" ("id", "name", "greeting", "country", "calendar", "month", "day") VALUES
  ('nd_founding',   'يوم التأسيس',        'يوم التأسيس — يوم بدينا',               'SA', 'GREGORIAN', 2, 22),
  ('nd_flag',       'يوم العلم',          'يوم العلم — رايتنا عالية',              'SA', 'GREGORIAN', 3, 11),
  ('nd_national',   'اليوم الوطني',       'اليوم الوطني — كل عام والوطن بخير',      'SA', 'GREGORIAN', 9, 23),
  ('nd_hijri_year', 'رأس السنة الهجرية',  'كل عام وأنتم بخير — سنة هجرية سعيدة',   'ALL', 'HIJRI', 1, 1),
  ('nd_ramadan',    'أول رمضان',          'مبارك عليكم الشهر',                     'ALL', 'HIJRI', 9, 1),
  ('nd_fitr',       'عيد الفطر',          'عيدكم مبارك — عساكم من عواده',          'ALL', 'HIJRI', 10, 1),
  ('nd_arafah',     'يوم عرفة',           'يوم عرفة — خير يوم طلعت فيه الشمس',     'ALL', 'HIJRI', 12, 9),
  ('nd_adha',       'عيد الأضحى',         'عيد أضحى مبارك — عساكم من عواده',       'ALL', 'HIJRI', 12, 10);
