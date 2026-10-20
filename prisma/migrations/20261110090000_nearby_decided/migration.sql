-- «من حولك» يُفعَّل وحده بأوّل فتحٍ للرادار (القاعدة ٣٠٩). ومن فعّله بيده قبلها حُسم أمرُه.
ALTER TABLE "User" ADD COLUMN "nearbyDecidedAt" TIMESTAMP(3);
UPDATE "User" SET "nearbyDecidedAt" = NOW() WHERE "notifyNearby" = true;
