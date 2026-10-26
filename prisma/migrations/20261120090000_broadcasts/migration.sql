-- تنبيهاتُ المشرف لكلّ مستخدم (القاعدة ٣٦٣).
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cardTitle" TEXT NOT NULL,
    "cardBody" TEXT NOT NULL,
    "mediaId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pushedAt" TIMESTAMP(3),
    "sentCount" INTEGER,
    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Broadcast_mediaId_key" ON "Broadcast"("mediaId");
CREATE INDEX "Broadcast_pushedAt_idx" ON "Broadcast"("pushedAt");

ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
