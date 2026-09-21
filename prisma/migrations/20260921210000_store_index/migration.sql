-- المتجر يُقرأ مرتَّباً ومفلتراً في كل فتحة.
CREATE INDEX "StoreItem_hidden_sortOrder_idx" ON "StoreItem"("hidden", "sortOrder");
