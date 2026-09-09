-- الجمهور: الدائرة كلها، أو تصنيف منها، أو أشخاص بأعيانهم.
CREATE TYPE "Audience" AS ENUM ('CIRCLE', 'GROUP', 'PICKED');

-- الملف الشخصي والخصوصية.
ALTER TABLE "User"
  ADD COLUMN "handle" TEXT,
  ADD COLUMN "viewGroupId" TEXT,
  ADD COLUMN "interactGroupId" TEXT,
  ADD COLUMN "shareLocation" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyOnTag" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- التصنيفات.
CREATE TABLE "FriendGroup" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FriendGroup_ownerId_name_key" ON "FriendGroup"("ownerId", "name");
CREATE INDEX "FriendGroup_ownerId_idx" ON "FriendGroup"("ownerId");
ALTER TABLE "FriendGroup" ADD CONSTRAINT "FriendGroup_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "FriendGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- الحظر.
CREATE TABLE "Block" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey"
  FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey"
  FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- جمهور اللحظة.
ALTER TABLE "Moment"
  ADD COLUMN "audience" "Audience" NOT NULL DEFAULT 'CIRCLE',
  ADD COLUMN "audienceGroupId" TEXT;
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_audienceGroupId_fkey"
  FOREIGN KEY ("audienceGroupId") REFERENCES "FriendGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MomentViewer" (
  "id" TEXT NOT NULL,
  "momentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "MomentViewer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MomentViewer_momentId_userId_key" ON "MomentViewer"("momentId", "userId");
CREATE INDEX "MomentViewer_userId_idx" ON "MomentViewer"("userId");
ALTER TABLE "MomentViewer" ADD CONSTRAINT "MomentViewer_momentId_fkey"
  FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MomentViewer" ADD CONSTRAINT "MomentViewer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
