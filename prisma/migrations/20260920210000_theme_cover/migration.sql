-- غلافٌ يأتي مع الثيم: من اشتراه لبس غلافَه، وله أن يغيّره بعدها.
ALTER TABLE "StoreItem" ADD COLUMN "coverMediaId" TEXT;

CREATE UNIQUE INDEX "StoreItem_coverMediaId_key" ON "StoreItem"("coverMediaId");

ALTER TABLE "StoreItem"
  ADD CONSTRAINT "StoreItem_coverMediaId_fkey"
  FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
