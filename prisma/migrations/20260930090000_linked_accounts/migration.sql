-- غلافُ الثيم يُعرف مصدرُه (القاعدة ١٩٣)
ALTER TABLE "User" ADD COLUMN "coverItemId" TEXT;

-- سياقُ البلاغ على رسالة (القاعدة ١٩٥)
ALTER TABLE "Report" ADD COLUMN "context" JSONB;

-- الحساباتُ المرتبطة (القاعدة ١٩٤)
CREATE TABLE "AccessEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "device" TEXT NOT NULL DEFAULT '',
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AccessEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccessEvent_userId_ip_device_key" ON "AccessEvent"("userId", "ip", "device");
CREATE INDEX "AccessEvent_ip_idx" ON "AccessEvent"("ip");
CREATE INDEX "AccessEvent_device_idx" ON "AccessEvent"("device");
CREATE INDEX "AccessEvent_lastAt_idx" ON "AccessEvent"("lastAt");
ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
