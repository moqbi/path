#!/usr/bin/env bash
# تجهيزُ خادمٍ جديد من الصفر — أوبونتو ٢٤٫٠٤، يُشغَّل بـroot مرّةً واحدة.
#
# يفعل بالترتيب: مستخدمٌ بلا كلمة، وقفلُ SSH على المفاتيح، وجدارُ نار،
# وfail2ban، وتحديثاتٌ أمنيّة تلقائية، ثمّ Node وPostgres وPgBouncer
# وRedis وCaddy، ثمّ ضبطُ Postgres على حجم رام الخادم.
#
# **ولا يلمس التطبيق**: النقلُ والنشر في `migrate-from-render.sh`
# و`deploy.sh` — فخطوةٌ تفشل لا تُعيدك إلى الصفر.
set -euo pipefail

APP_USER="${APP_USER:-athar}"
DB_NAME="${DB_NAME:-athar}"
DB_USER="${DB_USER:-athar}"
SSH_KEY="${SSH_KEY:-}"          # محتوى المفتاح العامّ (ssh-ed25519 …)

say() { printf "\n\033[1;33m▸ %s\033[0m\n" "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "يُشغَّل بـroot"; exit 1; }
[ -n "$SSH_KEY" ] || { echo "ضع مفتاحك العامّ في SSH_KEY أوّلاً"; exit 1; }

say "تحديثُ النظام"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get upgrade -y -qq

say "الحزم"
apt-get install -y -qq ufw fail2ban unattended-upgrades postgresql-16 \
  postgresql-contrib pgbouncer redis-server git curl rclone gnupg ca-certificates

say "Node 22"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
apt-get install -y -qq nodejs
corepack enable && corepack prepare pnpm@latest --activate

say "Caddy"
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq && apt-get install -y -qq caddy

say "المستخدم $APP_USER"
id "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
echo "$SSH_KEY" > "/home/$APP_USER/.ssh/authorized_keys"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/authorized_keys"
chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
# ومفتاحُ root نفسُه: بابٌ احتياطيّ إن انكسر شيء.
install -d -m 700 /root/.ssh && echo "$SSH_KEY" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

say "صلاحيةٌ محدودة لـ$APP_USER"
# حسابُ التطبيق بلا كلمة مرور — فلا يستطيع `sudo` أن يسأله عنها.
# وبدل أن نعطيه المفتاحَ كلَّه: أمرانِ بعينهما بلا كلمة، وهما ما يحتاجه
# النشر. وكلُّ ما عداهما يُفعل بـroot عن قصد.
cat > /etc/sudoers.d/athar <<EOF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart athar-web athar-api, \
  /usr/bin/systemctl restart athar-web, /usr/bin/systemctl restart athar-api, \
  /usr/bin/systemctl reload caddy, /usr/bin/systemctl status athar-web athar-api
EOF
chmod 440 /etc/sudoers.d/athar
visudo -cf /etc/sudoers.d/athar >/dev/null

say "قفلُ SSH على المفاتيح"
cat > /etc/ssh/sshd_config.d/99-athar.conf <<'EOF'
# كلمةُ مرورٍ على منفذٍ مفتوح للعالم تُجرَّب آلافَ المرّات في اليوم.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 3
EOF
systemctl restart ssh

say "جدارُ النار"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable

say "fail2ban"
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled  = true
maxretry = 4
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban

say "تحديثاتٌ أمنيّة تلقائية"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

say "ضبطُ Postgres على حجم الرام"
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
SHARED=$((RAM_MB / 4)); CACHE=$((RAM_MB * 3 / 4))
cat > /etc/postgresql/16/main/conf.d/athar.conf <<EOF
# القاعدةُ على الخادم نفسه: تسمع على المحلّيّ وحده، فلا باب من العالم.
listen_addresses = 'localhost'
shared_buffers = ${SHARED}MB
effective_cache_size = ${CACHE}MB
work_mem = 8MB
maintenance_work_mem = 256MB
random_page_cost = 1.1          # NVMe لا قرصٌ دوّار
max_connections = 120           # المجمّع يحرسها
wal_compression = on
log_min_duration_statement = 500  # الاستعلامُ البطيء وحده يُكتب
EOF
systemctl restart postgresql

say "القاعدة والمستخدم"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
sudo -u postgres psql -qtA <<EOF
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE "$DB_USER" PASSWORD '$DB_PASS';
  END IF;
END \$\$;
EOF
sudo -u postgres psql -qtA -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb "$DB_NAME" --owner "$DB_USER"

say "PgBouncer"
cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
$DB_NAME = host=127.0.0.1 port=5432 dbname=$DB_NAME

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
admin_users = postgres
EOF
HASH=$(sudo -u postgres psql -qtA -c "SELECT rolpassword FROM pg_authid WHERE rolname='$DB_USER'")
printf '"%s" "%s"\n' "$DB_USER" "$HASH" > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt && chmod 600 /etc/pgbouncer/userlist.txt
systemctl enable --now pgbouncer && systemctl restart pgbouncer

say "Redis"
sed -i 's/^# *maxmemory .*/maxmemory 256mb/; s/^# *maxmemory-policy .*/maxmemory-policy allkeys-lru/' \
  /etc/redis/redis.conf
systemctl enable --now redis-server

say "تمّ"
cat <<EOF

   رابطُ القاعدة — انسخه إلى .env:

   DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:6432/$DB_NAME"

   والمباشر (للنسخ والاستعادة، بلا مجمّع):

   DIRECT_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"

   ثمّ: انقل المستودع، واملأ .env، وشغّل migrate-from-render.sh ثمّ deploy.sh

   وما يُكتب في /etc يُفعل بـroot لا بـ$APP_USER: وحداتُ systemd
   وCaddyfile تُنسخ مرّةً واحدة من جلسة root.

EOF
