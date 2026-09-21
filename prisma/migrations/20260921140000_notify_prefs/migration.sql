-- تفضيلات التنبيهات: حقلٌ لكل نوع، والوضع الهادئ بالدقائق من منتصف الليل.
ALTER TABLE "User"
  ADD COLUMN "notifyDm" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyFriend" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyReaction" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyComment" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyStoreNew" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyStoreDeals" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "quietFrom" INTEGER,
  ADD COLUMN "quietTo" INTEGER;
