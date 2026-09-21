#!/usr/bin/env bash
# استعادةُ نسخة — تُجرَّب مرّةً عند التركيب ثمّ كلّ ثلاثة أشهر.
#
# **نسخةٌ لم تُستعَد ليست نسخة**: الفشلُ يُكتشف يوم الحاجة لا قبله.
# ولذلك تُستعاد إلى قاعدةٍ جانبيّة لا إلى القاعدة الحيّة.
set -euo pipefail

file="${1:?مسارُ ملفّ النسخة}"
target="${2:-athar_restore_test}"

createdb "$target" 2>/dev/null || true
pg_restore -d "$target" --no-owner --clean --if-exists "$file"

echo "— صفوفٌ في القاعدة المستعادة —"
psql -d "$target" -c 'select
  (select count(*) from "User")   as users,
  (select count(*) from "Moment") as moments,
  (select count(*) from "Media")  as media;'
