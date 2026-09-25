-- متى انتهى آخرُ اشتراكٍ في آثار+: منه تُعرض نافذةُ التجديد مرّةً لكل انتهاء.
ALTER TABLE "User" ADD COLUMN "plusEndedAt" TIMESTAMP(3);
