-- برنامجُ الدعوات (القاعدة ٢٤٣).
ALTER TABLE "User" ADD COLUMN "invitedById" TEXT;
ALTER TABLE "User" ADD COLUMN "inviteRewards" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "User_invitedById_idx" ON "User"("invitedById");
ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PendingSignup" ADD COLUMN "inviterNo" INTEGER;

ALTER TABLE "CoinGrant" ADD COLUMN "invites" INTEGER;

CREATE TABLE "InviteProgram" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "every" INTEGER NOT NULL DEFAULT 10,
    "coins" INTEGER NOT NULL DEFAULT 500,
    "announcedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteProgram_pkey" PRIMARY KEY ("id")
);
