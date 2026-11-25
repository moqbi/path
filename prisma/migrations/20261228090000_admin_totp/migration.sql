-- التحقّقُ الثنائيّ للّوحة وبابُ الجوّال إليها (القاعدة ٤٩٣).
ALTER TYPE "EmailTokenKind" ADD VALUE 'ADMIN';
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpStep" INTEGER;
