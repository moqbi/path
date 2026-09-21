#!/usr/bin/env bash
# نشرُ التطبيق: بناءٌ ثمّ إعادةُ تشغيلٍ لخدمتين.
#
# يُشغَّل بـ`athar` من جذر المستودع على الخادم، ويصلح للنشرة الأولى
# ولكل تحديثٍ بعدها: `git pull && scripts/ops/deploy.sh`.
#
# **والهجرات قبل التشغيل لا بعده**: خادمٌ جديد يقرأ عموداً لم يُنشأ بعد
# يسقط مع أوّل طلب.
set -euo pipefail

cd "$(dirname "$0")/../.."
say() { printf "\n\033[1;33m▸ %s\033[0m\n" "$1"; }

[ -f .env ] || { echo "لا ملفّ .env"; exit 1; }
set -a; . ./.env; set +a

say "الاعتماديات"
npm ci --include=dev
pnpm install --frozen-lockfile

say "العميل والهجرات"
npx prisma generate
DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" npx prisma migrate deploy

say "البناء: التطبيق ثمّ الموقع"
# التطبيق تحت `/app` (basePath)، والموقعُ العامّ على الجذر — مشروعان
# يُبنيان كلاهما، فنشرُ أحدهما وحده يترك الآخر على نسخةٍ قديمة.
npx next build
pnpm --filter @athar/web build
echo "   (لا خطوةَ بناءٍ للواجهة البرمجية — تعمل بـtsx)"

say "إعادةُ التشغيل"
sudo systemctl restart athar-web athar-site athar-api
sleep 4
systemctl is-active athar-web athar-site athar-api

say "فحصٌ سريع"
curl -fsS -o /dev/null -w "   التطبيق: %{http_code}\n" http://127.0.0.1:3000/app/login
curl -fsS -o /dev/null -w "   الموقع:  %{http_code}\n" http://127.0.0.1:3001/
curl -fsS -o /dev/null -w "   الخادم:  %{http_code}\n" http://127.0.0.1:4000/health || true
