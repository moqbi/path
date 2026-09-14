-- مدى صلاحية المشرف
CREATE TYPE "AdminScope" AS ENUM ('NONE', 'STORE', 'ALL');
ALTER TABLE "User" ADD COLUMN "adminScope" "AdminScope" NOT NULL DEFAULT 'NONE';

-- ألوان الثيم كاملةً
ALTER TABLE "StoreItem" ADD COLUMN "palette" TEXT;

-- تذاكر الدعم
CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "reply" TEXT,
  "repliedAt" TIMESTAMP(3),
  "closed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");
CREATE INDEX "SupportTicket_closed_createdAt_idx" ON "SupportTicket"("closed", "createdAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
