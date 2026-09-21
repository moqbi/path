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

say "البناء: الويب ثمّ الخادم"
npx next build
pnpm --filter @athar/api build 2>/dev/null || echo "   (لا خطوةَ بناءٍ للخادم — يعمل بـtsx)"

say "إعادةُ التشغيل"
sudo systemctl restart athar-web athar-api
sleep 3
systemctl is-active athar-web athar-api

say "فحصٌ سريع"
curl -fsS -o /dev/null -w "   الويب: %{http_code}\n" http://127.0.0.1:3000/login
curl -fsS -o /dev/null -w "   الخادم: %{http_code}\n" http://127.0.0.1:4000/health || true
