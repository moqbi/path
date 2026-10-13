-- «من حولك»: تنبيهُ من فتحها قريباً منك — مطفأٌ حتى يُفعَّل (القاعدة ٢٨٢).
ALTER TABLE "User" ADD COLUMN "notifyNearby" BOOLEAN NOT NULL DEFAULT false;
