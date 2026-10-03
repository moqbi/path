-- الذكريات ومناسبات الصداقة وآثرك السنويّ (القاعدة ٢٣٥)
ALTER TABLE "User" ADD COLUMN "notifyMemories" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "memoriesPushedOn" TEXT;
ALTER TABLE "User" ADD COLUMN "memoriesDismissedOn" TEXT;
ALTER TABLE "User" ADD COLUMN "recapPushedYear" INTEGER;

ALTER TABLE "Friendship" ADD COLUMN "acceptedAt" TIMESTAMP(3);
UPDATE "Friendship" SET "acceptedAt" = "createdAt" WHERE "status" = 'ACCEPTED';

ALTER TABLE "Moment" ADD COLUMN "memoryOf" TIMESTAMP(3);
ALTER TABLE "Moment" ADD COLUMN "recapYear" INTEGER;
