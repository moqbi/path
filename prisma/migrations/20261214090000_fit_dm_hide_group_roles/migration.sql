ALTER TABLE "StoreItem" ADD COLUMN "fit" TEXT;

-- حذفُ المحادثة لطرفه وحده (القاعدة ٤٧٥).
ALTER TABLE "Conversation" ADD COLUMN "aHiddenAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "bHiddenAt" TIMESTAMP(3);

-- رتبُ المجموعة وكتمُها وتعديلُ رسائلها (القاعدة ٤٧٥).
CREATE TYPE "GroupRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');
ALTER TABLE "ChatGroupMember" ADD COLUMN "role" "GroupRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "ChatGroupMember" ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroupMessage" ADD COLUMN "editedAt" TIMESTAMP(3);
