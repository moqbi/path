-- نظامُ التذاكر (القاعدة ٤٨٠): رقمٌ لكلّ تذكرة، ومحادثةٌ بعد رسالتها، وإغلاقٌ نهائيّ.

-- AlterEnum
ALTER TYPE "EmailTokenKind" ADD VALUE 'WEB';

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "number" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStaff" BOOLEAN NOT NULL,
    "staffId" TEXT,
    "body" TEXT NOT NULL,
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_fromStaff_pushedAt_idx" ON "TicketMessage"("fromStaff", "pushedAt");

-- الأرقامُ بترتيب الوصول لا بترتيب الصفوف على القرص، والمتسلسلةُ تكمل بعدها.
UPDATE "SupportTicket" t SET "number" = r.n
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "SupportTicket") r
WHERE t."id" = r."id";
SELECT setval(pg_get_serial_sequence('"SupportTicket"', 'number'), COALESCE(MAX("number"), 0) + 1, false) FROM "SupportTicket";

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- الردُّ القديم أوّلُ سطرٍ من الموظّف، مختوماً بالجرس فلا يُقرع لما قُرئ من قبل.
INSERT INTO "TicketMessage" ("id", "ticketId", "fromStaff", "body", "pushedAt", "createdAt")
SELECT 'tm' || "id", "id", true, "reply", now(), COALESCE("repliedAt", "createdAt")
FROM "SupportTicket" WHERE "reply" IS NOT NULL;

UPDATE "SupportTicket" SET "lastAt" = COALESCE("repliedAt", "createdAt");
