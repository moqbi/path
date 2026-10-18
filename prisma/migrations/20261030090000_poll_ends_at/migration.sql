-- مدّةُ الاستطلاع (القاعدة ٢٩٠).
ALTER TABLE "Moment" ADD COLUMN "pollEndsAt" TIMESTAMP(3);

-- ما نُشر قبلها يُعطى ثلاثة أيامٍ من نشره.
UPDATE "Moment" SET "pollEndsAt" = "createdAt" + INTERVAL '3 days'
WHERE cardinality("pollOptions") > 0 AND "pollEndsAt" IS NULL;
