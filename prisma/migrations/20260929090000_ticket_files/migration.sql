-- مرفقاتُ رسائل الدعم وطلبات الوظائف، ونوعُ الرسالة.
ALTER TABLE "SupportTicket" ADD COLUMN "topic" TEXT;

CREATE TABLE "TicketFile" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "key" TEXT,
    "bytes" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketFile_ticketId_idx" ON "TicketFile"("ticketId");

ALTER TABLE "TicketFile" ADD CONSTRAINT "TicketFile_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
