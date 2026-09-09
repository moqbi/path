-- إزالة الحضور المؤقت، وإلغاء موافقة الإشارة، وإضافة المحادثات الخاصة وربط الموسيقى.

-- ١) الحضور المؤقت: تُحذف لحظاته قبل تغيير التعداد، وإلا رفض Postgres إزالة
--    قيمة ما زالت مستعملة — وهذا ما كان سيُفشل النشر على الخادم.
DELETE FROM "Moment" WHERE "kind" = 'PRESENCE';

DROP TABLE IF EXISTS "Joining";

CREATE TYPE "MomentKind_new" AS ENUM ('PHOTO', 'PLACE', 'THOUGHT', 'MUSIC', 'SLEEP', 'FRIEND_ADDED');
ALTER TABLE "Moment" ALTER COLUMN "kind" TYPE "MomentKind_new" USING ("kind"::text::"MomentKind_new");
DROP TYPE "MomentKind";
ALTER TYPE "MomentKind_new" RENAME TO "MomentKind";

ALTER TABLE "Moment" DROP COLUMN IF EXISTS "expiresAt";
ALTER TABLE "Moment" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "Moment" ADD COLUMN "lng" DOUBLE PRECISION;

-- ٢) الإشارة «مع فلان» تظهر بلا موافقة: اللحظة في صفحة كاتبها وحده.
DROP INDEX IF EXISTS "MomentTag_userId_approved_idx";
ALTER TABLE "MomentTag" DROP COLUMN IF EXISTS "approved";
CREATE INDEX "MomentTag_userId_idx" ON "MomentTag"("userId");

-- ٣) ربط حساب الموسيقى للنشر التلقائي.
CREATE TYPE "MusicProvider" AS ENUM ('SPOTIFY', 'ANGHAMI');
ALTER TABLE "User" ADD COLUMN "musicProvider" "MusicProvider";
ALTER TABLE "User" ADD COLUMN "musicAccountName" TEXT;
ALTER TABLE "User" ADD COLUMN "musicAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "musicRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "musicTokenExpires" TIMESTAMP(3);

-- ٤) المحادثات الخاصة بين طرفين.
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_aId_bId_key" ON "Conversation"("aId", "bId");
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_aId_fkey" FOREIGN KEY ("aId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_bId_fkey" FOREIGN KEY ("bId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
