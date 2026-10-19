-- أيّامُ النشاط للوحة التحليلات (القاعدة ٣٠٧).
CREATE TABLE "DailyActive" (
    "day" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "DailyActive_pkey" PRIMARY KEY ("day","userId")
);

CREATE INDEX "DailyActive_day_idx" ON "DailyActive"("day");

ALTER TABLE "DailyActive" ADD CONSTRAINT "DailyActive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ما قبل الجدول تقريبٌ من آثارٍ مؤكَّدة: طرفا كلّ صفٍّ في سجلّ الوصول (يومُ أوّله
-- ويومُ آخره — وما بينهما مجهول)، ثمّ يومُ كلّ ما كتبه الحساب بيده.
-- والتوقيتُ يومُ الرياض (+٣).
INSERT INTO "DailyActive" ("day", "userId", "source")
SELECT DISTINCT ("firstAt" + interval '3 hours')::date, "userId", CASE WHEN "device" = '' THEN 'web' ELSE 'app' END
FROM "AccessEvent"
ON CONFLICT DO NOTHING;

INSERT INTO "DailyActive" ("day", "userId", "source")
SELECT DISTINCT ("lastAt" + interval '3 hours')::date, "userId", CASE WHEN "device" = '' THEN 'web' ELSE 'app' END
FROM "AccessEvent"
ON CONFLICT DO NOTHING;

INSERT INTO "DailyActive" ("day", "userId")
SELECT DISTINCT d, u FROM (
  SELECT ("createdAt" + interval '3 hours')::date AS d, "authorId" AS u FROM "Moment"
  UNION SELECT ("createdAt" + interval '3 hours')::date, "userId" FROM "Comment"
  UNION SELECT ("createdAt" + interval '3 hours')::date, "userId" FROM "Reaction"
  UNION SELECT ("createdAt" + interval '3 hours')::date, "senderId" FROM "Message"
  UNION SELECT ("lastSeenAt" + interval '3 hours')::date, "id" FROM "User" WHERE "lastSeenAt" IS NOT NULL
) AS done
WHERE u IS NOT NULL
ON CONFLICT DO NOTHING;
