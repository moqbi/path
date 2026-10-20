-- صورةٌ متحرّكة من GIPHY على النوت (القاعدة ٣١٥).
ALTER TABLE "StatusNote" ADD COLUMN "gifId" TEXT;
ALTER TABLE "StatusNote" ADD COLUMN "gifW" INTEGER;
ALTER TABLE "StatusNote" ADD COLUMN "gifH" INTEGER;
