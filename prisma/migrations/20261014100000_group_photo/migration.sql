ALTER TABLE "ChatGroup" ADD COLUMN "photoMediaId" TEXT;
CREATE UNIQUE INDEX "ChatGroup_photoMediaId_key" ON "ChatGroup"("photoMediaId");
ALTER TABLE "ChatGroup" ADD CONSTRAINT "ChatGroup_photoMediaId_fkey" FOREIGN KEY ("photoMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
