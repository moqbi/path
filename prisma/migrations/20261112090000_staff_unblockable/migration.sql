-- المشرفُ لا يُحظر (القاعدة ٣١٨): ما سبق من حظرٍ على المالك وممنوحي اللوحة كلّها يُرفع.
DELETE FROM "Block"
WHERE "blockedId" IN (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' OR "adminScope" = 'ALL');
