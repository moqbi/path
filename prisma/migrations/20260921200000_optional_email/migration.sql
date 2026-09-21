-- من دخل بسناب لا بريدَ له: سناب لا تعطي بريداً، ويربطه هو من الإعدادات.
-- والقيدُ الفريد يبقى — Postgres يقبل فراغاتٍ كثيرة تحته.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
