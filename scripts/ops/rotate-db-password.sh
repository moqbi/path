#!/usr/bin/env bash
# تدويرُ كلمة مرور القاعدة — بـroot، بلا أن تظهر الكلمة على الشاشة.
#
# ثلاثةُ مواضع تحمل الكلمة ولا بدّ أن تتغيّر معاً، وإلّا سقط التطبيق
# بـ«Authentication failed»:
#   ١. دورُ Postgres نفسُه.
#   ٢. تجزئتُها في `/etc/pgbouncer/userlist.txt` — المجمّع يصادق بها.
#   ٣. `DATABASE_URL` و`DIRECT_URL` في `.env` (المجمّع ٦٤٣٢، والمباشر ٥٤٣٢).
#
# وسكربتٌ لا كتلةٌ تُلصق: الطرفيّة تتداخل أسطرُها فتُنفَّذ ناقصة، فتتغيّر
# الكلمة في القاعدة وحدها ويبقى `.env` على القديمة — وهو عطلٌ وقع فعلاً.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "يُشغَّل بـroot"; exit 1; }

USER_NAME="${DB_USER:-athar}"
ENV_FILE="${ENV_FILE:-/home/athar/app/.env}"
[ -f "$ENV_FILE" ] || { echo "لا أجد $ENV_FILE"; exit 1; }

say() { printf "\n\033[1;33m▸ %s\033[0m\n" "$1"; }

# بلا `/+=`: الكلمة تدخل في عنوانٍ (URL)، وهذه الثلاثة لها معنى فيه.
NEW="$(openssl rand -base64 24 | tr -d '/+=')"

say "١/٥ الدور في Postgres"
sudo -u postgres psql -qc "ALTER ROLE \"$USER_NAME\" PASSWORD '$NEW';"

say "٢/٥ تجزئتُها في PgBouncer"
HASH="$(sudo -u postgres psql -qtA -c "SELECT rolpassword FROM pg_authid WHERE rolname='$USER_NAME'")"
printf '"%s" "%s"\n' "$USER_NAME" "$HASH" > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt

say "٣/٥ العنوانان في .env"
# نسخةٌ قبل الكتابة: ملفُّ البيئة لا يُكتب فوقه بلا رجعة.
cp -a "$ENV_FILE" "$ENV_FILE.bak-$(date -u +%Y%m%dT%H%M%SZ)"
owner="$(stat -c '%U:%G' "$ENV_FILE")"
sed -i -E "s#(postgresql://${USER_NAME}:)[^@]*(@)#\1${NEW}\2#g" "$ENV_FILE"
# `sed -i` يُنشئ الملفّ من جديد فتصير ملكيّتُه root — وحسابُ التطبيق
# يقرأ هذا الملفّ، فتُعاد كما كانت.
chown "$owner" "$ENV_FILE"

say "٤/٥ إعادةُ التشغيل"
systemctl restart pgbouncer
systemctl restart athar-api athar-web athar-site

say "٥/٥ التحقّق — المباشر ثمّ المجمّع"
direct="$(grep -oP '(?<=DIRECT_URL=").*(?=")' "$ENV_FILE")"
pooled="$(grep -oP '(?<=DATABASE_URL=").*(?=")' "$ENV_FILE")"
ok=1
sudo -u postgres psql "$direct" -qtAc 'select count(*) from "User"' \
  && echo "   ✅ Postgres مباشرةً (٥٤٣٢)" || { echo "   ❌ Postgres"; ok=0; }
sudo -u postgres psql "$pooled" -qtAc 'select count(*) from "User"' \
  && echo "   ✅ PgBouncer (٦٤٣٢)" || { echo "   ❌ PgBouncer"; ok=0; }

echo
[ "$ok" -eq 1 ] && echo "   تمّت. والكلمة في .env وحده — لم تُطبع هنا." \
                || echo "   لم تتمّ. النسخةُ القديمة بجانب .env بلاحقة .bak-*"
