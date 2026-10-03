-- إهداءُ آثار+ لصديق (القاعدة ٢٣٤).
CREATE TABLE "PlusGift" (
    "id" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "PlusGift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlusGift_eventId_key" ON "PlusGift"("eventId");
CREATE INDEX "PlusGift_giverId_status_createdAt_idx" ON "PlusGift"("giverId", "status", "createdAt");
CREATE INDEX "PlusGift_recipientId_status_doneAt_idx" ON "PlusGift"("recipientId", "status", "doneAt");

ALTER TABLE "PlusGift" ADD CONSTRAINT "PlusGift_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlusGift" ADD CONSTRAINT "PlusGift_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
