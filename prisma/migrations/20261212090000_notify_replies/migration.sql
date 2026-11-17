-- الردود (القاعدة ٤٦٦): تنبيهٌ بتعليقٍ جديد على لحظةٍ علّقتُ عليها، مفعّلٌ افتراضاً.
ALTER TABLE "User" ADD COLUMN "notifyReplies" BOOLEAN NOT NULL DEFAULT true;
