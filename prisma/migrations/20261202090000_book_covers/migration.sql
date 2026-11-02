-- أغلفةُ الكتاب في المتجر (القاعدة ٤٠٥).
ALTER TYPE "StoreItemKind" ADD VALUE 'BOOK';
ALTER TABLE "StoreItem" ADD COLUMN "bookSkin" TEXT;
