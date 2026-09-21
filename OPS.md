# التشغيل على خادمٍ خاصّ — آثار مومنتس

البنية المقرَّرة: **خادم Hetzner واحد** يحمل التطبيق والقاعدة وRedis
وPgBouncer وCaddy، و**الملفّات تبقى في Cloudflare R2** (دلو `athar-media`،
إقليم WEUR) بلا تغيير.

هذا الملفّ خطواتُ التنفيذ. والقرارات التي يقوم عليها المنتج في
`CLAUDE.md`، وهجرةُ البيانات في `MIGRATION.md`.

---

## ١. ما يجري اليوم وما يتغيّر

| الطبقة | اليوم | بعد النقل |
|---|---|---|
| الويب والخادم | Render (خطّة `free`، فرانكفورت) | Hetzner VPS |
| القاعدة | Render Postgres 16 `athar-db`، خطّة `free` | Postgres 16 على الخادم نفسه |
| الملفّات | Cloudflare R2 `athar-media` (WEUR) | كما هي |
| الشهادة | Render | Caddy يجدّدها بنفسه |
| النطاق | `*.onrender.com` | `atharmts.com` |

> **عاجل**: قاعدة Render الحاليّة خطّتها `free` و**تنتهي في ٨ أكتوبر
> ٢٠٢٦**، والمجّانيّة تُحذف عند انتهائها لا تُجمّد. فالنقل — أو ترقية
> الخطّة — قرارُ هذا الأسبوع لا قرارُ ما بعد الإطلاق.

---

## ٢. مقاس الخادم

خادمٌ واحد يكفي الإطلاق ويكفي عشرات الآلاف. والانقسام يأتي حين يصير
Postgres والتطبيق يتنازعان المعالج نفسه، لا قبل ذلك.

| المرحلة | العتاد | لماذا |
|---|---|---|
| الإطلاق (حتى ~٢٠ ألف مسجَّل) | ٨ vCPU / ١٦ GB / ١٦٠ GB NVMe (من صنف CX/CPX) | كلّ شيء على خادمٍ واحد بمريح |
| نموّ (~٨٠ ألفاً) | معالجٌ **مخصَّص** ٨ / ٣٢ GB / ٢٤٠ GB (صنف CCX) | Postgres يكره المعالج المشترَك: تأخّرُ الاستعلام يتذبذب بلا سبب ظاهر |
| ٢٠٠ ألف | خادما تطبيق (٨ / ١٦ لكلٍّ) + خادم قاعدة مخصَّص (١٦ / ٦٤ / ٥٠٠ GB) | عند هذا الحدّ يفصل كلٌّ منهما عن الآخر |

قواعد تسري على كلّ المراحل:

- **القرص NVMe محلّيّ لا وحدة تخزينٍ شبكيّة**: أقراص Hetzner المنفصلة
  (Volumes) تمرّ بالشبكة، وPostgres يقيس عمره بزمن `fsync`.
- **الرام قبل الأنوية للقاعدة**: الفهارس كلّها لازم تجلس في الذاكرة.
- **الموقع فرانكفورت أو نورنبرغ**: دلو R2 في أوروبا الغربية، فيبقى
  الملفّ قريباً من الخادم الذي يقدّمه.
- **ولا إقليمَ لـHetzner في المملكة**. والبيانات هنا مواقعُ وصورٌ
  وعلاقات، وهي بياناتٌ شخصيّة تحت نظام حماية البيانات السعوديّ
  (`CLAUDE.md` ← اعتبارات نظاميّة). فإن لزم أن تبقى داخل المملكة،
  فالخطّة نفسها تُنفَّذ عند مزوّدٍ له مركزٌ في الرياض أو جدّة أو
  الدمّام — وليست هذه الخطوات مرتبطةً بـHetzner في شيء.

**والنطاق هو البند الذي يفاجئ**: الملفّات تمرّ بالتطبيق لا برابطٍ مباشر
(القاعدة ١٠٣). فكلّ صورةٍ تُقرأ مرّتين: من R2 إلى الخادم، ومن الخادم إلى
الجهاز. باقات Hetzner تُدخل ٢٠ تيرابايت خروجاً شهريّاً للخادم، وتُحاسب
على ما زاد. ضع **Cloudflare أمام النطاق بالوكيل مفعَّلاً** من اليوم
الأوّل: خبيئتُه تبتلع صور العرض المتكرّرة، وهي أكثر ما يُقرأ.

---

## ٣. التنصيب

أوبونتو ٢٤٫٠٤ LTS. كلّ ما يلي بـ`root` ما لم يُذكر غيره.

### ٣٫١ الأساس

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades postgresql-16 \
               pgbouncer redis-server git curl
dpkg-reconfigure --priority=low unattended-upgrades

adduser --disabled-password --gecos "" athar

# جدار النار: الويب وSSH وحدهما. القاعدة لا تُفتح على العالم بحال.
ufw default deny incoming && ufw allow OpenSSH && ufw allow 80 && ufw allow 443
ufw enable
```

وفي لوحة Hetzner: فعّل جدارها أيضاً بنفس المنافذ — طبقتان أفضل من
واحدة، وخطأٌ في `ufw` لا يفتح الخادم كلّه.

و**الدخول بالمفاتيح وحدها**: في `/etc/ssh/sshd_config` اجعل
`PasswordAuthentication no` و`PermitRootLogin prohibit-password`.

### ٣٫٢ Node

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs        # ٢٢ كما في render.yaml
```

### ٣٫٣ Postgres

القاعدة على الخادم نفسه، فتسمع على `localhost` وحده ويُتّصل بها عبر
مقبس يونكس أو `127.0.0.1` — لا عنوان خارجيّ ولا شهادة بينهما.

```bash
sudo -u postgres createuser athar --pwprompt
sudo -u postgres createdb athar --owner athar
```

وفي `postgresql.conf` (الأرقام لخادمٍ ١٦ GB):

```
listen_addresses = 'localhost'
shared_buffers = 4GB                  # ربع الرام
effective_cache_size = 12GB           # ثلاثة أرباعها
work_mem = 16MB
maintenance_work_mem = 512MB
random_page_cost = 1.1                # NVMe لا قرصٌ دوّار
max_connections = 120                 # المجمّع يحرسها، فلا حاجة لأكثر
wal_compression = on
```

### ٣٫٤ PgBouncer

القاعدة صارت محلّيّة، فقيمةُ المجمّع لم تعد في زمن الشبكة بل في **سقف
الاتّصالات**: كلّ نسخة Prisma تفتح مجمّعها الخاصّ، ونسختان أو ثلاثٌ
تلتهم `max_connections` وتترك القاعدة ترفض الجميع.

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
athar = host=/var/run/postgresql dbname=athar

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
listen_addr = 127.0.0.1
listen_port = 6432
```

> **قبل الاعتماد عليه**: وضعُ `transaction` يمنع العبارات المُحضَّرة،
> وPrisma يستعملها. جرّب المسار كاملاً على الخادم بعد التركيب — إن ظهر
> `prepared statement "s0" already exists` فالعلاج إمّا `?pgbouncer=true`
> في الرابط وإمّا `pool_mode = session`. لا تكتشف هذا بعد الإطلاق.

### ٣٫٥ Redis

يسمع على `localhost`، ومهمّته ما يُكتب كثيراً ويُقرأ كثيراً ولا يستحقّ
صفّاً في القاعدة: ختمُ الحضور، وخبيئةُ الإشعارات، وحدُّ المعدّل. وفي
`/etc/redis/redis.conf`:

```
maxmemory 1gb
maxmemory-policy allkeys-lru
save ""                     # خبيئةٌ لا مخزنُ حقيقة: لا حاجة لحفظٍ على القرص
```

### ٣٫٦ Caddy والنطاق

```bash
apt install -y caddy
```

```
# /etc/caddy/Caddyfile
atharmts.com, www.atharmts.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

وفي Cloudflare: سجلّا `A` للجذر و`www` إلى عنوان الخادم، **بالوكيل
مفعَّلاً**، ووضع TLS = `Full (strict)` — فـCaddy يحمل شهادةً حقيقيّة.

### ٣٫٧ التطبيق

```bash
sudo -u athar -i
git clone https://github.com/moqbi/path.git /home/athar/app
cd /home/athar/app && npm ci && npx prisma generate && npm run build
```

`/etc/systemd/system/athar-web.service`:

```ini
[Unit]
After=network.target postgresql.service pgbouncer.service
[Service]
User=athar
WorkingDirectory=/home/athar/app
EnvironmentFile=/home/athar/app/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
```

ومثلُه لخادم الواجهة البرمجيّة (`apps/api`) على منفذٍ آخر حين يُنشر.
والهجرات تُشغَّل عند النشر لا عند الإقلاع:
`npx prisma migrate deploy`.

### ٣٫٨ البيئة

في `/home/athar/app/.env` (صلاحيّتُه `600`):

```
DATABASE_URL="postgresql://athar:***@127.0.0.1:6432/athar"
AUTH_SECRET="..."
SITE_URL="https://atharmts.com"
NEXT_PUBLIC_SITE_URL="https://atharmts.com"
R2_ACCOUNT_ID=...
R2_BUCKET="athar-media"
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
ADMIN_EMAILS="..."
REDIS_URL="redis://127.0.0.1:6379"

# البريد الصادر (بريفو): تأكيدُ البريد وإعادةُ ضبط كلمة المرور.
BREVO_API_KEY="..."
MAIL_FROM="noreply@atharmts.com"
```

> **ونطاقُ المرسِل يُثبَت في بريفو أوّلاً** (Senders & Domains): سجلّا
> DKIM وSPF على `atharmts.com`، وإلّا رُفض الإرسال أو ذهب إلى «المهملات».
> والرسائلُ تحمل روابط مطلقة، فبلا `SITE_URL` لا تُرسَل أصلاً.

و`EXPO_PUBLIC_SITE_URL="https://atharmts.com"` في بناء الجوّال. ولا
نطاقَ يُكتب في الكود (القاعدة ١٠٥).

---

## ٤. نقل البيانات من Render

```bash
# من جهازك، بالرابط الخارجيّ لقاعدة Render
pg_dump "postgresql://...frankfurt-postgres.render.com/...?sslmode=require" \
  -Fc -f athar.dump

scp athar.dump root@<ip>:/tmp/
sudo -u postgres pg_restore -d athar --no-owner --role=athar /tmp/athar.dump
```

ثمّ `npx prisma migrate deploy` ليستوي جدول الهجرات، وتأكّد من
`scripts/promote-admins.ts`: البذرة محروسةٌ بقاعدةٍ فارغة، فقاعدةٌ
عامرةٌ تُنقل قد تترك الجميع بلا دور — وهذا ما عطّل اللوحة على Render
من قبل (القاعدة ١٣).

**ولا تفتح الاتّصال الخارجيّ لقاعدة Render إلّا لحظة النقل**:
`ipAllowList` عندها فارغة الآن، أي لا اتّصال خارجيّ أصلاً.

---

## ٥. النسخ الاحتياطيّة

خادمٌ واحد يعني أنّ النسخة الاحتياطيّة هي الفرق بين عطلٍ وكارثة.
ثلاث طبقات:

1. **`pg_dump` يوميّاً إلى R2** (دلوٌ غير دلو الملفّات) عبر `rclone`،
   مع الاحتفاظ بثلاثين يوماً.
2. **أرشفة WAL** إن أردت استعادةً إلى لحظةٍ بعينها لا إلى ليلة أمس.
3. **لقطة Hetzner** للنظام كلّه — وهي **ليست** نسخةً آمنةً للقاعدة
   بذاتها (لقطةُ قاعدةٍ تعمل قد تخرج غير متّسقة)، فهي لاستعادة
   الخادم لا لاستعادة البيانات.

> ونسخةٌ لم تُستعَد ليست نسخة: جرّب الاستعادة على خادمٍ مؤقّت مرّةً
> عند التركيب، ثمّ كلّ ثلاثة أشهر.

---

## ٦. ثلاثة إصلاحات في الكود تسبق أيّ ترقيةٍ للعتاد

عند عشرات الآلاف من النشطين، هذه تكسر قبل أن يضيق الخادم:

1. **ختمُ الحضور** (القاعدة ٣١) يكتب في `User` مرّةً كلّ دقيقة لكلّ
   نشط. عند ٦٠ ألفاً = ألفُ كتابةٍ في الثانية على أكثر الجداول قراءةً،
   تُكبّر WAL وتُتعب `autovacuum`. مكانُه Redis، ويُنزَّل إلى القاعدة
   كلّ بضع دقائق.
2. **الملفّات تمرّ بالتطبيق** (القاعدة ١٠٣): هي بندُ النطاق الأكبر
   وأثقلُ ما على الخادم. البديل الذي يحفظ القاعدة: عاملٌ على حافّة
   Cloudflare يفحص الجلسة ويقدّم من R2 مباشرةً — يبقى الفحص ولا تحمل
   خوادمك البكسلات. وهو قرارُ المالك لأنّه يمسّ قاعدةً مكتوبة.
3. **الإشعارات تُشتقّ** (القاعدة ٢٥) في كلّ فتحة تبويب. تحتاج خبيئةً
   ٣٠–٦٠ ثانية في Redis، وإلّا صار تبويب الإشعارات أثقل من الخطّ
   الزمنيّ نفسه.

---

## ٧. المراقبة

أقلُّ ما يكفي: تنبيهٌ على امتلاء القرص (٨٠٪)، وعلى ارتفاع تأخّر
الاستعلامات، وعلى توقّف أيّ من الخدمات الأربع. و`log_min_duration_statement
= 500` في Postgres يكتب لك الاستعلامات البطيئة وحدها — منها يُعرف أين
ينقص فهرس، وهو أرخص من ترقية الخادم.
