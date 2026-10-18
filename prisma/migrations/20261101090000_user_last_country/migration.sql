-- رمزُ دولة آخر موضعٍ قرأه الجهاز — مناسباتُ التقويم الوطنيّة منه (القاعدة ٢٩٢).
ALTER TABLE "User" ADD COLUMN "lastCountry" TEXT;

-- المناسباتُ الوطنيّة لبقيّة الدول في القائمة: من كان فيها يرى مناسباتِها.
INSERT INTO "NationalDay" ("id", "name", "greeting", "country", "calendar", "month", "day") VALUES
  ('nd_ae_national',  'عيد الاتحاد',         'عيد اتحاد سعيد — كل عام والإمارات بخير',  'AE', 'GREGORIAN', 12, 2),
  ('nd_kw_national',  'العيد الوطني',        'العيد الوطني — كل عام والكويت بخير',      'KW', 'GREGORIAN', 2, 25),
  ('nd_kw_liberation','يوم التحرير',         'يوم التحرير — كل عام والكويت بخير',       'KW', 'GREGORIAN', 2, 26),
  ('nd_qa_national',  'اليوم الوطني',        'اليوم الوطني — كل عام وقطر بخير',         'QA', 'GREGORIAN', 12, 18),
  ('nd_bh_national',  'العيد الوطني',        'العيد الوطني — كل عام والبحرين بخير',     'BH', 'GREGORIAN', 12, 16),
  ('nd_om_national',  'العيد الوطني',        'العيد الوطني — كل عام وعُمان بخير',       'OM', 'GREGORIAN', 11, 20),
  ('nd_eg_national',  'العيد القومي',        'العيد القومي — كل عام ومصر بخير',         'EG', 'GREGORIAN', 7, 23),
  ('nd_jo_national',  'عيد الاستقلال',       'عيد الاستقلال — كل عام والأردن بخير',     'JO', 'GREGORIAN', 5, 25)
ON CONFLICT ("id") DO NOTHING;
