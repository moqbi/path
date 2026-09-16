-- صلاحية الإشراف على المحتوى.
--
-- تُمنح لمشرفٍ بعينه من اللوحة وتُسحب منه: من يملكها يقرأ لحظات أيّ
-- حساب بلا صداقة ويحذف ما يخالف منها، ومشرفٌ آخر لا يملكها. وهي زائدةٌ
-- على صلاحية اللوحة لا لازمةٌ عنها.
--
-- والافتراض `false`: ما يُفتح على لحظات الناس لا يُمنح بالنشر، يُمنح
-- بيد المالك واحداً واحداً. والمالك يملكها بدوره لا بهذا الحقل.
ALTER TABLE "User" ADD COLUMN "canModerate" BOOLEAN NOT NULL DEFAULT false;

-- سجلّ أفعال المشرفين: صلاحيةٌ بلا أثرٍ مكتوب لا يُسأل عنها أحد.
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "ownerId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "snippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModerationLog_adminId_createdAt_idx" ON "ModerationLog"("adminId", "createdAt");
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationLog" ADD CONSTRAINT "ModerationLog_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
