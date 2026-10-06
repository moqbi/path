-- الجنسُ لصيغة خطاب الكتاب وحدها (القاعدة ٢٦٠) — اختياريّ، وفارغُه مذكّرٌ كما كان.
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');
ALTER TABLE "User" ADD COLUMN "gender" "Gender";
