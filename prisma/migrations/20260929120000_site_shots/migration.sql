-- لقطاتُ «من داخل التطبيق» في صفحة الهبوط — تُدار من لوحة الموقع.
CREATE TABLE "SiteShot" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteShot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteShot_mediaId_key" ON "SiteShot"("mediaId");
CREATE INDEX "SiteShot_hidden_sortOrder_idx" ON "SiteShot"("hidden", "sortOrder");

ALTER TABLE "SiteShot" ADD CONSTRAINT "SiteShot_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
