-- ثوبُ الكتاب كاملاً (القاعدة ٤٠٦): صورةُ الورق وصورةُ الخاتمة.
ALTER TABLE "StoreItem" ADD COLUMN "bookPaperMediaId" TEXT;
ALTER TABLE "StoreItem" ADD COLUMN "bookEndMediaId" TEXT;
CREATE UNIQUE INDEX "StoreItem_bookPaperMediaId_key" ON "StoreItem"("bookPaperMediaId");
CREATE UNIQUE INDEX "StoreItem_bookEndMediaId_key" ON "StoreItem"("bookEndMediaId");
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_bookPaperMediaId_fkey" FOREIGN KEY ("bookPaperMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_bookEndMediaId_fkey" FOREIGN KEY ("bookEndMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- الأغلفةُ الثلاثة الأولى بورقٍ وخاتمةٍ من ألوانها — ما لم يُعدّله المشرفُ بعدُ.
UPDATE "StoreItem" SET "bookSkin" = '{"bg":"#EBCF9F","bg2":"#C98E5A","ink":"#3A2414","accent":"#9C4A22","pattern":"dunes","paper":"#F8EFDF","paperInk":"#3A2414","paperAccent":"#9C4A22","endBg":"#C98E5A","endInk":"#2E1B0E"}'
  WHERE "id" = 'bookcoverdunes0000000001' AND "bookSkin" = '{"bg":"#EBCF9F","bg2":"#C98E5A","ink":"#3A2414","accent":"#9C4A22","pattern":"dunes"}';
UPDATE "StoreItem" SET "bookSkin" = '{"bg":"#1B2C5C","bg2":"#070B1F","ink":"#F5F0E6","accent":"#E9C46A","pattern":"stars","paper":"#F5F2EA","paperInk":"#1B2C5C","paperAccent":"#A67C1E","endBg":"#0B1230","endInk":"#F5F0E6"}'
  WHERE "id" = 'bookcoverstars0000000001' AND "bookSkin" = '{"bg":"#1B2C5C","bg2":"#070B1F","ink":"#F5F0E6","accent":"#E9C46A","pattern":"stars"}';
UPDATE "StoreItem" SET "bookSkin" = '{"bg":"#146070","bg2":"#07303A","ink":"#F1F7F6","accent":"#7FD8CF","pattern":"waves","paper":"#F2F7F6","paperInk":"#0F3B46","paperAccent":"#1A7A88","endBg":"#07303A","endInk":"#F1F7F6"}'
  WHERE "id" = 'bookcoverwaves0000000001' AND "bookSkin" = '{"bg":"#146070","bg2":"#07303A","ink":"#F1F7F6","accent":"#7FD8CF","pattern":"waves"}';
