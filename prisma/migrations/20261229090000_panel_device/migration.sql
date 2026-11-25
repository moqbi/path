-- القاعدة ٤٩٣: جوّالٌ مرّ بالتحقّق من زرّ اللوحة يُوثق به اثنتي عشرة ساعة.
ALTER TABLE "User" ADD COLUMN "panelDevice" TEXT;
ALTER TABLE "User" ADD COLUMN "panelUntil" TIMESTAMP(3);
ALTER TABLE "EmailToken" ADD COLUMN "device" TEXT;
