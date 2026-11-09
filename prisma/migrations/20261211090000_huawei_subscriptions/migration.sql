-- اشتراكاتُ آثار+ من متجر هواوي (القاعدة ٤٤٦).
CREATE TABLE "HuaweiSubscription" (
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseToken" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuaweiSubscription_pkey" PRIMARY KEY ("subscriptionId")
);
CREATE INDEX "HuaweiSubscription_expiresAt_idx" ON "HuaweiSubscription"("expiresAt");
CREATE INDEX "HuaweiSubscription_userId_idx" ON "HuaweiSubscription"("userId");
ALTER TABLE "HuaweiSubscription" ADD CONSTRAINT "HuaweiSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
