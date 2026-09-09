-- رقم العضوية: تسلسل في القاعدة، والصفوف القائمة تأخذ أرقامها بترتيب التسجيل.
CREATE SEQUENCE "User_memberNo_seq";

ALTER TABLE "User" ADD COLUMN "memberNo" INTEGER;

WITH ordered AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS rn FROM "User"
)
UPDATE "User" u SET "memberNo" = o.rn FROM ordered o WHERE u."id" = o."id";

SELECT setval('"User_memberNo_seq"', COALESCE((SELECT MAX("memberNo") FROM "User"), 0) + 1, false);

ALTER TABLE "User"
  ALTER COLUMN "memberNo" SET NOT NULL,
  ALTER COLUMN "memberNo" SET DEFAULT nextval('"User_memberNo_seq"');

ALTER SEQUENCE "User_memberNo_seq" OWNED BY "User"."memberNo";

CREATE UNIQUE INDEX "User_memberNo_key" ON "User"("memberNo");

-- الوسوم.
CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bg" TEXT NOT NULL,
  "fg" TEXT NOT NULL,
  "autoForPlus" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "tagId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_tagId_idx" ON "User"("tagId");
