-- إيصالات الرسائل: متى وصلت، ومتى عُدّلت.
-- القراءة كانت موجودة (readAt)، والتسليم يُكتب حين يفتح المستلم شاشاته،
-- فالرسائل القديمة المقروءة تُعدّ مسلَّمة بالضرورة.
ALTER TABLE "Message" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);

UPDATE "Message" SET "deliveredAt" = "readAt" WHERE "readAt" IS NOT NULL;
