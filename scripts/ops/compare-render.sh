#!/usr/bin/env bash
# أيّ القاعدتين أحدث؟ — قراءةٌ فقط، لا تكتب حرفاً.
#
# بعد النقل تصير القاعدةُ على الخادم هي الحيّة، وتبقى قاعدةُ Render
# نسخةً جامدة. إلّا أن يظلّ بابٌ يكتب فيها — وأشهرُها **ويبهوك
# RevenueCat**: عنوانٌ لم يُحدَّث يبعث كلَّ عمليّة شراءٍ إلى الخادم
# القديم، فيدفع المستخدم ولا يُفعَّل اشتراكه ولا تصل نقاطه.
#
# فهذا يقارن الاثنين قبل أن يُقرَّر شيء: ما عددُ الصفوف هنا وهناك، وما
# أحدثُ صفٍّ في كلٍّ منهما.
set -euo pipefail

: "${RENDER_DATABASE_URL:?ضع رابط قاعدة Render الخارجيّ}"
: "${DIRECT_URL:?ضع رابط القاعدة المحلّيّة (منفذ 5432 لا 6432)}"

read -r -d '' QUERY <<'SQL' || true
select
  (select count(*) from "User")        as users,
  (select count(*) from "Moment")      as moments,
  (select count(*) from "Purchase")    as purchases,
  (select count(*) from "CoinTopUp")   as topups,
  (select max("createdAt") from "User")      as last_user,
  (select max("createdAt") from "Moment")    as last_moment,
  (select max("createdAt") from "Purchase")  as last_purchase;
SQL

printf "\n\033[1;33m▸ Render\033[0m\n"
psql "$RENDER_DATABASE_URL" -x -c "$QUERY" 2>&1 || echo "  (لا تُقرأ — ربّما انتهت الخطّة أو حُذفت)"

printf "\n\033[1;33m▸ الخادم\033[0m\n"
psql "$DIRECT_URL" -x -c "$QUERY"

cat <<'EOF'

  اقرأ `last_purchase` في الاثنين قبل كلّ شيء:

  • أحدثُها على الخادم، وRender أقدم أو مساوٍ
    → لا شيء يُنقل. أغلق خدمتَي Render وقاعدتَها.

  • أحدثُها في Render
    → ويبهوك RevenueCat ما زال يبعث إليه: صحّح عنوانه أوّلاً إلى
      https://atharmts.com/v1/webhooks/revenuecat ثمّ انقل الصفوف
      الناقصة وحدها — لا بمسحِ القاعدة (`migrate-from-render.sh`
      يمحو ما هنا، وهو ليس لهذه الحال).

  • Render لا تُقرأ أصلاً
    → انتهت خطّتها المجّانيّة وحُذفت. وما فيها ذهب، فتأكّد من نسخك.

EOF
