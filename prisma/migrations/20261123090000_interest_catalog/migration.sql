-- تصنيفاتُ الاهتمامات وبنودُها من اللوحة (القاعدة ٣٧٥)، مبذورةً بالقائمة التي كانت في الكود بمعرّفاتها نفسها.
CREATE TABLE "InterestGroup" ("id" TEXT NOT NULL, "emoji" TEXT NOT NULL, "label" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "InterestGroup_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Interest" ("id" TEXT NOT NULL, "groupId" TEXT NOT NULL, "label" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "Interest_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Interest_groupId_idx" ON "Interest"("groupId");
ALTER TABLE "Interest" ADD CONSTRAINT "Interest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InterestGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "InterestGroup" VALUES ('music', '🎵', 'الموسيقى', 0) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('music.pop', 'music', 'البوب', 0),
  ('music.rock', 'music', 'الروك', 1),
  ('music.rap', 'music', 'الراب', 2),
  ('music.hiphop', 'music', 'الهيب هوب', 3),
  ('music.tarab', 'music', 'الطرب العربي', 4),
  ('music.khaleeji', 'music', 'الموسيقى الخليجية', 5),
  ('music.jazz', 'music', 'الجاز', 6)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('fun', '🎬', 'الترفيه', 1) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('fun.movies', 'fun', 'الأفلام', 0),
  ('fun.series', 'fun', 'المسلسلات', 1),
  ('fun.anime', 'fun', 'الأنمي', 2),
  ('fun.comedy', 'fun', 'الكوميديا', 3),
  ('fun.drama', 'fun', 'الدراما', 4),
  ('fun.horror', 'fun', 'الرعب', 5),
  ('fun.scifi', 'fun', 'الخيال العلمي', 6),
  ('fun.games', 'fun', 'الألعاب', 7)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('art', '📷', 'الفن والإبداع', 2) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('art.photo', 'art', 'التصوير', 0),
  ('art.drawing', 'art', 'الرسم', 1),
  ('art.design', 'art', 'التصميم', 2),
  ('art.writing', 'art', 'الكتابة', 3),
  ('art.poetry', 'art', 'الشعر', 4),
  ('art.content', 'art', 'صناعة المحتوى', 5),
  ('art.editing', 'art', 'المونتاج', 6)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('travel', '✈️', 'السفر', 3) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('travel.travel', 'travel', 'السفر', 0),
  ('travel.cities', 'travel', 'استكشاف المدن', 1),
  ('travel.camping', 'travel', 'التخييم', 2),
  ('travel.adventure', 'travel', 'المغامرات', 3),
  ('travel.roadtrips', 'travel', 'الرحلات البرية', 4),
  ('travel.beaches', 'travel', 'الشواطئ', 5),
  ('travel.nature', 'travel', 'الطبيعة', 6),
  ('travel.climbing', 'travel', 'تسلق الجبال', 7)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('cars', '🏍️', 'المركبات', 4) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('cars.motorbikes', 'cars', 'الدراجات النارية', 0),
  ('cars.sports', 'cars', 'السيارات الرياضية', 1),
  ('cars.classic', 'cars', 'السيارات الكلاسيكية', 2),
  ('cars.modified', 'cars', 'السيارات المعدلة', 3),
  ('cars.racing', 'cars', 'السباقات', 4),
  ('cars.offroad', 'cars', 'الدفع الرباعي', 5)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('sport', '⚽', 'الرياضة', 5) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('sport.football', 'sport', 'كرة القدم', 0),
  ('sport.basketball', 'sport', 'كرة السلة', 1),
  ('sport.tennis', 'sport', 'التنس', 2),
  ('sport.swimming', 'sport', 'السباحة', 3),
  ('sport.running', 'sport', 'الجري', 4),
  ('sport.cycling', 'sport', 'ركوب الدراجات', 5),
  ('sport.boxing', 'sport', 'الملاكمة', 6),
  ('sport.fitness', 'sport', 'اللياقة البدنية', 7)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('life', '☕', 'الطعام ونمط الحياة', 6) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('life.coffee', 'life', 'القهوة', 0),
  ('life.tea', 'life', 'الشاي', 1),
  ('life.cooking', 'life', 'الطبخ', 2),
  ('life.restaurants', 'life', 'المطاعم', 3),
  ('life.sweets', 'life', 'الحلويات', 4),
  ('life.fashion', 'life', 'الموضة', 5),
  ('life.perfume', 'life', 'العطور', 6),
  ('life.watches', 'life', 'الساعات', 7)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('mind', '📚', 'المعرفة والثقافة', 7) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('mind.reading', 'mind', 'القراءة', 0),
  ('mind.history', 'mind', 'التاريخ', 1),
  ('mind.philosophy', 'mind', 'الفلسفة', 2),
  ('mind.psychology', 'mind', 'علم النفس', 3),
  ('mind.languages', 'mind', 'اللغات', 4),
  ('mind.cultures', 'mind', 'الثقافات', 5),
  ('mind.heritage', 'mind', 'الآثار', 6),
  ('mind.museums', 'mind', 'المتاحف', 7)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('animals', '🐾', 'الحيوانات', 8) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('animals.cats', 'animals', 'القطط', 0),
  ('animals.birds', 'animals', 'الطيور', 1),
  ('animals.horses', 'animals', 'الخيول', 2),
  ('animals.wild', 'animals', 'الحيوانات البرية', 3)
ON CONFLICT DO NOTHING;
INSERT INTO "InterestGroup" VALUES ('hobby', '🧩', 'الهوايات', 9) ON CONFLICT DO NOTHING;
INSERT INTO "Interest" VALUES
  ('hobby.chess', 'hobby', 'الشطرنج', 0),
  ('hobby.puzzles', 'hobby', 'الألغاز', 1),
  ('hobby.collecting', 'hobby', 'جمع المقتنيات', 2),
  ('hobby.pets', 'hobby', 'الحيوانات', 3),
  ('hobby.plants', 'hobby', 'النباتات', 4),
  ('hobby.farming', 'hobby', 'الزراعة', 5),
  ('hobby.crafts', 'hobby', 'الأعمال اليدوية', 6),
  ('hobby.boardgames', 'hobby', 'الألعاب اللوحية', 7)
ON CONFLICT DO NOTHING;
