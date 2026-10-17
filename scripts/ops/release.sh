#!/usr/bin/env bash
# نشرٌ كاملٌ بأمرٍ واحد من root — للكونسول وللجوّال حيث الأوامر الطويلة
# تُكتب حرفاً حرفاً:
#
#   sudo -iu athar git -C app pull origin main && bash /home/athar/app/scripts/ops/release.sh
#
# السحبُ قبله لا داخله: سكربتٌ يسحب نفسه يُكمل بنسخته القديمة.
# البناءُ بـathar (`deploy.sh`)، وإعادةُ التشغيل وCaddy بـroot — athar بلا sudo.
set -euo pipefail

say() { printf "\n\033[1;33m▸ %s\033[0m\n" "$1"; }
[ "$(id -u)" = 0 ] || { echo "شغّله كـroot"; exit 1; }

APP=/home/athar/app

sudo -iu athar bash -lc "cd ~/app && SKIP_RESTART=1 scripts/ops/deploy.sh"

say "إعادةُ التشغيل"
systemctl restart athar-web athar-site athar-api

say "Caddy"
# يُفحص قبل أن يُنسخ: إعدادٌ معطوب لا يحلّ محلّ العامل.
caddy validate --config "$APP/scripts/ops/Caddyfile" --adapter caddyfile
cp "$APP/scripts/ops/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy

say "الحالة"
sleep 3
systemctl is-active athar-web athar-site athar-api caddy || true

say "فحصٌ سريع"
ok=1
check() {
  # الإقلاعُ يأخذ ثوانيَ: يُعاد السؤالُ حتى نصف دقيقة قبل أن يُعدّ فشلاً.
  for _ in $(seq 15); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$2" || true)
    [ "$code" = 200 ] && break
    sleep 2
  done
  printf "   %s: %s\n" "$1" "$code"
  [ "$code" = 200 ] || ok=0
}
check "التطبيق" http://127.0.0.1:3000/app/login
check "الموقع " http://127.0.0.1:3001/
check "الخادم " http://127.0.0.1:4000/health

if [ "$ok" = 1 ]; then
  printf "\n\033[1;32m✔ تمّ النشر\033[0m\n"
else
  printf "\n\033[1;31m✘ خدمةٌ لم تردّ — journalctl -u athar-api -n 40 --no-pager\033[0m\n"
  exit 1
fi
