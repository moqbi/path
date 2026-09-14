-- الملفات تنتقل إلى Cloudflare R2: مفتاح الكائن، والبايتات تبقى لما رُفع قبلها
ALTER TABLE "Media" ADD COLUMN "key" TEXT;
ALTER TABLE "Media" ALTER COLUMN "bytes" DROP NOT NULL;
