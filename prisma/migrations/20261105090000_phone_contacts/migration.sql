-- رقمُ الجوال المؤكَّد ومزامنةُ جهات الاتصال (القاعدة ٢٩٧).
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneHash" TEXT;
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "phoneSkippedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "findByPhone" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");

CREATE TABLE "PhoneCode" (
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhoneCode_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "PhoneCode" ADD CONSTRAINT "PhoneCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
