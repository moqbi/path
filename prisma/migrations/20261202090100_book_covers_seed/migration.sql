-- ثلاثةُ أغلفةٍ أولى (القاعدة ٤٠٥): تُعدَّل أسعارُها وألوانُها من اللوحة.
-- في هجرةٍ ثانية: قيمةُ التعداد الجديدة لا تُستعمل في المعاملة التي أضافتها.
-- مختومةٌ بالإعلان: الجوّالُ القائم لا يعرف النوع، فلا جرسَ لصنفٍ لا يراه.
INSERT INTO "StoreItem" ("id", "kind", "name", "priceCoins", "spec", "bookSkin", "sortOrder", "announcedAt")
VALUES
  ('bookcoverdunes0000000001', 'BOOK', 'كثبان', 200,
   'linear-gradient(160deg, #EBCF9F, #C98E5A)',
   '{"bg":"#EBCF9F","bg2":"#C98E5A","ink":"#3A2414","accent":"#9C4A22","pattern":"dunes"}', 0, NOW()),
  ('bookcoverstars0000000001', 'BOOK', 'ليل الصحراء', 200,
   'linear-gradient(160deg, #1B2C5C, #070B1F)',
   '{"bg":"#1B2C5C","bg2":"#070B1F","ink":"#F5F0E6","accent":"#E9C46A","pattern":"stars"}', 0, NOW()),
  ('bookcoverwaves0000000001', 'BOOK', 'موج الخليج', 200,
   'linear-gradient(160deg, #146070, #07303A)',
   '{"bg":"#146070","bg2":"#07303A","ink":"#F1F7F6","accent":"#7FD8CF","pattern":"waves"}', 0, NOW());
