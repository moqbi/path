-- «مود» و«سؤال» مكان «نمت» و«صحيت» في قوس النشر (القاعدة ٤٨٤).
ALTER TYPE "MomentKind" ADD VALUE 'MOOD';
ALTER TYPE "MomentKind" ADD VALUE 'QUESTION';

CREATE TABLE "Mood" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#F6B93B',
    "mediaId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mood_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Mood_mediaId_key" ON "Mood"("mediaId");
ALTER TABLE "Mood" ADD CONSTRAINT "Mood_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Moment" ADD COLUMN "moodId" TEXT, ADD COLUMN "answersPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_moodId_fkey" FOREIGN KEY ("moodId") REFERENCES "Mood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- عشرةُ مودات بإيموجي يرسمه كلُّ جهاز (يونيكود ١١ فما دون — القاعدة ٨٥ج)، والصورُ تُرفع من اللوحة.
INSERT INTO "Mood" ("id", "emoji", "name", "color", "sortOrder") VALUES
  ('mood_sad',     '😔', 'متضايق', '#7A8FB0', 0),
  ('mood_angry',   '😠', 'معصّب',  '#E8634F', 1),
  ('mood_sleepy',  '😴', 'نعسان',  '#7E95E6', 2),
  ('mood_calm',    '😌', 'رايق',   '#6FBF92', 3),
  ('mood_chill',   '😊', 'مروّق',  '#F6B93B', 4),
  ('mood_excited', '🤩', 'متحمس',  '#FF9A3C', 5),
  ('mood_missing', '🥰', 'مشتاق',  '#F07FA2', 6),
  ('mood_tired',   '😩', 'تعبان',  '#A39C92', 7),
  ('mood_sick',    '🤒', 'مريض',   '#8FB3B3', 8),
  ('mood_cold',    '🥶', 'بردان',  '#6FB7E6', 9);

-- «نوم» و«صحيت» خرجا من قوس النشر (القاعدة ٤٨٤): نصوصُهما في صفحة الهبوط بلا مكان.
DELETE FROM "SiteText" WHERE "key" IN ('post.sleep.title', 'post.sleep.tags', 'post.wake.title', 'post.wake.tags');

-- وجهُ النوم ذهب مع «نمت» (القاعدة ٤٨٤): ما بقي منه يصير الوجهَ الأوّل فلا يُرسم فراغاً.
UPDATE "Reaction" SET "kind" = 'SMILE' WHERE "kind" = 'SLEEPY';
