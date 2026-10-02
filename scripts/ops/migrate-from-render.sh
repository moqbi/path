#!/usr/bin/env bash
# نقلُ القاعدة من Render إلى الخادم.
#
# يُشغَّل بـ`athar` على الخادم، ومعه `RENDER_DATABASE_URL` (الرابط
# الخارجيّ من لوحة Render) و`DIRECT_URL` (قاعدتنا بلا مجمّع).
#
# **والاستعادة تسبقها نسخة**: قاعدةٌ فيها شيءٌ لا تُستبدل قبل أن تُحفظ.
# **والمجمّعُ يُتخطّى**: `pg_restore` يفتح اتّصالاتٍ طويلة ويُنشئ أنواعاً،
# ووضعُ المعاملات في PgBouncer يقطعها في منتصفها.
set -euo pipefail

: "${RENDER_DATABASE_URL:?ضع رابط قاعدة Render الخارجيّ}"
: "${DIRECT_URL:?ضع رابط القاعدة المحلّيّة (منفذ 5432 لا 6432)}"

stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
dump="/tmp/render-${stamp}.dump"

say() { printf "\n\033[1;33m▸ %s\033[0m\n" "$1"; }

say "١/٦ نسخةٌ من Render"
pg_dump "$RENDER_DATABASE_URL" -Fc --no-owner --no-acl -f "$dump"
ls -lh "$dump"

say "٢/٦ صفوفُ المصدر — تُقارَن بعد الاستعادة"
before=$(psql "$RENDER_DATABASE_URL" -qtA -c "
  select (select count(*) from \"User\")   || '/' ||
         (select count(*) from \"Moment\") || '/' ||
         (select count(*) from \"Media\")" 2>/dev/null || echo "?")
echo "   مستخدمون/لحظات/ملفّات: $before"

say "٣/٦ نسخةٌ احتياطيّة لما عندنا قبل أن نكتب فوقه"
here=$(psql "$DIRECT_URL" -qtA -c 'select count(*) from "User"' 2>/dev/null || echo 0)
if [ "$here" -gt 0 ]; then
  pg_dump "$DIRECT_URL" -Fc -f "/tmp/before-restore-${stamp}.dump"
  echo "   حُفظت في /tmp/before-restore-${stamp}.dump"
else
  echo "   القاعدة فارغة — لا شيء يُحفظ"
fi

# **والاستعادة تمحو ما هنا**: `--clean` تُسقط الجداول ثمّ تكتب مكانها.
#
# وهذا صحيحٌ مرّةً واحدة — يوم النقل، والقاعدة هنا فارغة. أمّا بعده
# فالقاعدةُ هنا هي الحيّة: فيها حساباتٌ سُجّلت ولحظاتٌ نُشرت ومشترياتٌ
# دُفع ثمنها بعد النقل، وليس منها شيءٌ في Render. فتشغيلُ السكربت ثانيةً
# «لننقلها» يرجع بالتطبيق إلى يوم النقل ويذهب ما بعده.
#
# فإن كان هنا مستخدمون، لا يمضي إلّا بإذنٍ صريح — ومن أذِن فليقرأ
# العددين أوّلاً.
if [ "$here" -gt 0 ] && [ "${OVERWRITE:-}" != "yes" ]; then
  cat <<EOF

  ✋ القاعدة هنا ليست فارغة: $here مستخدماً، وفي Render $before.

     الاستعادة تمحو ما هنا وتضع مكانه نسخةَ Render. فإن كنت قد نقلت
     من قبل، فما هنا أحدثُ — ونقلٌ ثانٍ خسارةٌ لا ربح.

     وإن كان في Render شيءٌ حديثٌ ليس هنا (مشترياتٌ ذهب ويبهوكها إليه
     مثلاً) فذاك يُنقل صفوفاً بعينها لا بمسحِ القاعدة كلّها.

     ومن أراد المسح فعلاً — والنسخة محفوظة في
     /tmp/before-restore-${stamp}.dump — يعيد الأمر بـ:

         OVERWRITE=yes $0

EOF
  exit 1
fi

say "٤/٦ الاستعادة"
pg_restore -d "$DIRECT_URL" --no-owner --no-acl --clean --if-exists "$dump"

say "٥/٦ العميل ثمّ الهجرات"
cd "$(dirname "$0")/../.."
# `generate` قبل كلّ شيء: `boot-defaults` يستورد العميل المولَّد، ومستودعٌ
# حديثُ النسخ لا يحمله — فيسقط بـ«Cannot find module».
npx prisma generate
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy

say '٦/٦ الأدوار — فخُّ الترقية (boot-defaults)'
# البذرةُ محروسةٌ بقاعدةٍ فارغة، فقاعدةٌ منقولةٌ عامرة قد تترك الجميع
# بلا دورٍ فتُقفل اللوحة في وجه صاحبها. الرفعُ هنا صريحٌ لا مشروط.
# و`ADMIN_EMAILS` لازمةٌ هنا: بلا قائمةٍ صريحة لا يُرقّى إلا حسابُ
# العرض، فتبقى اللوحةُ مغلقةً على صاحبها.
: "${ADMIN_EMAILS:?ضع بريدك في ADMIN_EMAILS وإلّا بقيت اللوحة مغلقة}"
DATABASE_URL="$DIRECT_URL" ADMIN_EMAILS="$ADMIN_EMAILS" npx tsx scripts/boot-defaults.ts

echo
psql "$DIRECT_URL" -c '
  select (select count(*) from "User")   as users,
         (select count(*) from "Moment") as moments,
         (select count(*) from "Media")  as media,
         (select count(*) from "User" where role = '"'"'ADMIN'"'"') as admins;'
echo "   وكان في المصدر: $before"
echo
echo "   إن تطابقت الأعداد فقد تمّ. وإن لم تتطابق فلا تُطفئ Render بعد."
