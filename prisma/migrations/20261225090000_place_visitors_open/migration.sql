-- «أظهرني في من زار الموقع» (القاعدة ٤٨٥) — مفعّلٌ افتراضاً.
ALTER TABLE "User" ADD COLUMN "showInVisitors" BOOLEAN NOT NULL DEFAULT true;
