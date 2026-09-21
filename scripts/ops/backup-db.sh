#!/usr/bin/env bash
# نسخةُ القاعدة اليوميّة إلى R2.
#
# نسخةٌ على الخادم نفسه ليست نسخة: قرصٌ يذهب يأخذها معه. فتُرفع إلى
# دلوٍ غير دلو الملفّات — خلطُهما يجعل خطأً في مسارٍ يمحو الاثنين.
#
# ويُحتفظ بثلاثين يوماً: ما قبلها يُحذف، فالمساحة لا تكبر بلا سقف.
set -euo pipefail

: "${DATABASE_URL:?لا DATABASE_URL}"
: "${R2_REMOTE:=r2}"                 # اسمُ المضيف في إعداد rclone
: "${R2_BACKUP_BUCKET:=athar-backups}"
: "${KEEP_DAYS:=30}"

stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
file="/tmp/athar-${stamp}.dump"

# `-Fc` صيغةٌ مضغوطةٌ تُستعاد انتقائياً، لا نصٌّ يُعاد تشغيله كاملاً.
pg_dump "$DATABASE_URL" -Fc -f "$file"

rclone copyto "$file" "${R2_REMOTE}:${R2_BACKUP_BUCKET}/db/athar-${stamp}.dump"
rm -f "$file"

# وحذفُ القديم بعد رفع الجديد لا قبله: انقطاعٌ في المنتصف يُبقي نسخة.
rclone delete "${R2_REMOTE}:${R2_BACKUP_BUCKET}/db" --min-age "${KEEP_DAYS}d"

echo "تمّت نسخة ${stamp}"
