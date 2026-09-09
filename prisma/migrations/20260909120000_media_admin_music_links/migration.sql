-- رفع الصور، ودور المشرف، وروابط الأغاني.

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Media_ownerId_createdAt_idx" ON "Media"("ownerId", "createdAt");
ALTER TABLE "Media" ADD CONSTRAINT "Media_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "avatarMediaId" TEXT;
ALTER TABLE "User" ADD COLUMN "coverMediaId" TEXT;
CREATE UNIQUE INDEX "User_avatarMediaId_key" ON "User"("avatarMediaId");
CREATE UNIQUE INDEX "User_coverMediaId_key" ON "User"("coverMediaId");
ALTER TABLE "User" ADD CONSTRAINT "User_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Moment" ADD COLUMN "mediaId" TEXT;
CREATE UNIQUE INDEX "Moment_mediaId_key" ON "Moment"("mediaId");
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Moment" ADD COLUMN "musicUrl" TEXT;
ALTER TABLE "Moment" ADD COLUMN "musicThumb" TEXT;
