-- الاهتمامات (القاعدة ٣٧٤): معرّفاتٌ من قائمةٍ مغلقة، ومتى اختيرت أو تُخطّيت.
ALTER TABLE "User" ADD COLUMN "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "interestsAt" TIMESTAMP(3);
