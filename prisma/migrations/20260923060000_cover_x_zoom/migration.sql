-- موضعُ الغلاف في الاتجاهين وقُربُه — كان عمودياً وحده.
-- قيمٌ افتراضية لا تغيّر ما يراه أحدٌ اليوم: الوسطُ أفقياً وبلا تكبير.
ALTER TABLE "User" ADD COLUMN "coverX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "User" ADD COLUMN "coverZoom" INTEGER NOT NULL DEFAULT 100;
