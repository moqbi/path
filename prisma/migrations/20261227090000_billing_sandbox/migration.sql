-- القاعدة ٤٩١: شراءُ الاختبار يُعرف فلا يُعدّ في التحليلات. فارغٌ لما سبق — لا يُخمَّن.
ALTER TABLE "CoinTopUp" ADD COLUMN "sandbox" BOOLEAN;
ALTER TABLE "BillingEvent" ADD COLUMN "sandbox" BOOLEAN;
ALTER TABLE "BillingEvent" ADD COLUMN "productId" TEXT;
