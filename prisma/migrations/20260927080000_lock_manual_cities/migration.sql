-- من كتب مدينته بيده قبل وجود `cityLocked` بقي غيرَ مقفول، فكتب التحديدُ
-- التلقائيّ فوقها عند أوّل دخول. والمكتوبُ باليد يُعرف بأنّه غيرُ آخرِ
-- مدينةٍ قرأها الجهاز (آخرُ لحظة «وصل إلى»)، فيُقفل.
UPDATE "User" u
SET "cityLocked" = true
WHERE u."city" IS NOT NULL
  AND u."cityLocked" = false
  AND u."city" IS DISTINCT FROM (
    SELECT m."text" FROM "Moment" m
    WHERE m."authorId" = u."id" AND m."kind" = 'CITY'
    ORDER BY m."createdAt" DESC
    LIMIT 1
  );
