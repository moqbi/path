-- «تجهيز الكتاب» لمشتركي آثار+ (القاعدة ٣٧٨).
CREATE TABLE "BookPrefs" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "cover" TEXT NOT NULL DEFAULT 'night',
    "title" TEXT,
    "dedication" TEXT,
    "sections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookPrefs_pkey" PRIMARY KEY ("userId","year")
);
ALTER TABLE "BookPrefs" ADD CONSTRAINT "BookPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
