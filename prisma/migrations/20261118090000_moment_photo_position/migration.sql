-- موضعُ كلّ صورةٍ في اللحظة متعدّدة الصور (القاعدة ٣٤٨).
ALTER TABLE "MomentPhoto" ADD COLUMN "x" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "MomentPhoto" ADD COLUMN "y" INTEGER NOT NULL DEFAULT 50;
