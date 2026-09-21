-- إخفاءُ الصنف عن المتجر بلا حذفه: ما دُفع ثمنه يبقى في إكسسوارات صاحبه.
ALTER TABLE "StoreItem" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
