-- تأكيد البريد وإعادة ضبط كلمة المرور: رمزٌ يُرسَل ويُستعمل مرّة.
CREATE TYPE "EmailTokenKind" AS ENUM ('VERIFY', 'RESET');

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "EmailToken" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "kind"      "EmailTokenKind" NOT NULL,
  -- التجزئة لا الرمز: قاعدةٌ مسروقة لا تُعطي مفاتيح الحسابات.
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");
CREATE INDEX "EmailToken_userId_kind_createdAt_idx" ON "EmailToken"("userId", "kind", "createdAt");
CREATE INDEX "EmailToken_expiresAt_idx" ON "EmailToken"("expiresAt");

ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
