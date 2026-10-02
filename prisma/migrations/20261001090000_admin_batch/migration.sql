-- المجموعة المختلطة: نوعٌ فارغ (القاعدة ١٩٧).
ALTER TABLE "StoreCollection" ALTER COLUMN "kind" DROP NOT NULL;

-- منحُ النقاط من اللوحة (القاعدة ١٩٨).

-- CreateTable
CREATE TABLE "CoinGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "note" TEXT,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pushedAt" TIMESTAMP(3),

    CONSTRAINT "CoinGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinGrant_userId_createdAt_idx" ON "CoinGrant"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinGrant_pushedAt_idx" ON "CoinGrant"("pushedAt");

-- AddForeignKey
ALTER TABLE "CoinGrant" ADD CONSTRAINT "CoinGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinGrant" ADD CONSTRAINT "CoinGrant_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

