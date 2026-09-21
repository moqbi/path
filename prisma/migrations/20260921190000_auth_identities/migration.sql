-- الدخول بمزوّد: هويّةٌ عند آبل أو قوقل أو سناب تشير إلى حسابٍ عندنا.
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'SNAP');

-- ومن دخل بمزوّدٍ لا كلمةَ مرورٍ له حتى يضعها.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "AuthIdentity" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "provider"  "AuthProvider" NOT NULL,
  -- معرّفُ المستخدم عند المزوّد لا بريدُه: البريد يتغيّر والمعرّف لا.
  "subject"   TEXT NOT NULL,
  "email"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthIdentity_provider_subject_key" ON "AuthIdentity"("provider", "subject");
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
