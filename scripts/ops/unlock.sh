#!/usr/bin/env bash
# نجدةٌ حين يُقفل SSH على صاحبه — يُشغَّل من **لوحة المزوّد ← Console**
# بـroot، فهي لا تمرّ بـSSH.
#
# يفكّ حظر fail2ban، ويتأكّد أنّ المنفذ مفتوحٌ في الجدار، ويطبع الحال.
set -euo pipefail

MY_IP="${1:-}"

echo "▸ حالُ الجدار"
ufw status verbose | head -12
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
echo

echo "▸ حالُ fail2ban"
fail2ban-client status sshd 2>/dev/null || echo "   (لا حارسَ يعمل)"
echo

if [ -n "$MY_IP" ]; then
  echo "▸ فكُّ الحظر عن $MY_IP"
  fail2ban-client set sshd unbanip "$MY_IP" 2>/dev/null || echo "   (لم يكن محظوراً)"
  # ولا يُحظر ثانيةً: يُضاف إلى الموثوقين ويُعاد التحميل.
  if ! grep -q "$MY_IP" /etc/fail2ban/jail.local 2>/dev/null; then
    sed -i "s|^ignoreip = .*|& $MY_IP|" /etc/fail2ban/jail.local
    systemctl reload fail2ban
  fi
else
  echo "▸ لفكّ الحظر عن عنوانك: bash unlock.sh <عنوانك>"
  echo "   واعرفه من جهازك بـ: curl ifconfig.me"
fi
echo

echo "▸ هل يسمع SSH؟"
ss -tlnp | grep -E ':22\b' || echo "   ✗ لا شيء على ٢٢ — شغّل: systemctl restart ssh"
echo
echo "▸ المفاتيح المثبَّتة لـroot"
wc -l < /root/.ssh/authorized_keys 2>/dev/null || echo "   ✗ لا ملفّ مفاتيح لـroot"
