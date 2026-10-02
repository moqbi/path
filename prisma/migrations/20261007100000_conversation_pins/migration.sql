-- CreateTable
CREATE TABLE "ConversationPin" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationPin_pkey" PRIMARY KEY ("userId","conversationId")
);

-- AddForeignKey
ALTER TABLE "ConversationPin" ADD CONSTRAINT "ConversationPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationPin" ADD CONSTRAINT "ConversationPin_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

