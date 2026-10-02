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
| الإطلاق (حتى ~٢٠ ألف مسجَّل) | ٨ vCPU / ١٦ GB / ١٦٠ GB NVMe | كلّ شيء على خادمٍ واحد بمريح |
| **القائم اليوم** (Vultr فرانكفورت) | ٤ GB / ١٠٠ GB | يكفي الإطلاق والتجربة، ويضيق عند بضعة آلافٍ نشطين: Postgres وخدمتا Node وRedis في أربعة غيغا. والرامُ أوّلُ ما ينفد، فراقب `free -m` |
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

## ٢ب. إغلاق Render

بعد النقل تصير القاعدةُ على الخادم هي الحيّة، وتبقى قاعدةُ Render نسخةً
جامدة — **إلّا أن يظلّ بابٌ يكتب فيها**. وأشهرُها ويبهوك RevenueCat:
عنوانٌ لم يُحدَّث يبعث كلَّ عمليّة شراءٍ إلى الخادم القديم، فيدفع
المستخدم ولا يُفعَّل اشتراكه ولا تصل نقاطه — ولا يظهر خطأٌ في أيّ شاشة.

فقبل أن يُغلَق شيء، يُقارَن الاثنان قراءةً فقط:

```bash
RENDER_DATABASE_URL="postgresql://…render.com/…?sslmode=require" \
DIRECT_URL="postgresql://athar:…@127.0.0.1:5432/athar" \
  scripts/ops/compare-render.sh
```

ثمّ بالترتيب:

1. في RevenueCat → Integrations → Webhook: العنوان
   `https://atharmts.com/v1/webhooks/revenuecat`.
2. أيّ عنوانٍ آخر سُجّل عند طرفٍ خارجيّ على `*.onrender.com` — عودةُ
   مزوّدٍ، أو تنبيهٌ، أو مهمّةٌ مجدولة — يُحوَّل إلى النطاق.
3. تُقارَن القاعدتان بالأمر أعلاه، ولا يُطفأ شيءٌ حتى يتّضح أنّ الخادم
   أحدث.
4. تُوقَف خدمتا Render ثمّ تُحذف القاعدة — **بعد نسخةٍ منها عندك**.

> **و`migrate-from-render.sh` ليس أداةَ هذه المرحلة**: `--clean` فيه
> تمحو ما على الخادم وتضع نسخة Render مكانه. صحيحٌ يوم النقل والقاعدة
> فارغة، وخسارةٌ بعده. ولذلك يقف اليوم إن وجد مستخدمين ولا يمضي إلّا
> بـ`OVERWRITE=yes`.

---

## ٣. التنصيب

**سكربتٌ واحد يفعل كلَّ ما في هذا القسم** — والخطواتُ بعده مشروحةٌ لمن
أراد أن يقرأ ما يجري أو يصلح خطوةً بعينها:

```bash
# على الخادم، بـroot، مرّةً واحدة
curl -fsSL https://raw.githubusercontent.com/moqbi/path/main/scripts/ops/bootstrap.sh -o bootstrap.sh
SSH_KEY="ssh-ed25519 AAAA… اسمك" bash bootstrap.sh
```

يفعل بالترتيب: مستخدمٌ بلا كلمة مرور، وقفلُ SSH على المفاتيح، وجدارُ
نار، وfail2ban، وتحديثاتٌ أمنيّة تلقائية، ثمّ Node 22 وPostgres 16
وPgBouncer وRedis وCaddy، ثمّ **ضبطُ Postgres على حجم رام الخادم
فعلياً** (يقرأ `/proc/meminfo` ولا يكتب رقماً)، ثمّ القاعدةُ ومستخدمُها
بكلمةٍ عشوائية يطبعها لك في النهاية.

ثمّ النقلُ والنشر:

```bash
# بـathar، من جذر المستودع
RENDER_DATABASE_URL="postgresql://…render.com/…?sslmode=require" DIRECT_URL="postgresql://athar:…@127.0.0.1:5432/athar" ADMIN_EMAILS="you@example.com"   scripts/ops/migrate-from-render.sh

# وهذه بـroot: ما يُكتب في /etc ليس لحساب التطبيق
cp /home/athar/app/scripts/ops/athar-*.service /home/athar/app/scripts/ops/athar-*.timer /etc/systemd/system/
cp /home/athar/app/scripts/ops/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload && systemctl enable athar-web athar-site athar-api
systemctl enable --now athar-backup.timer

# والنشرُ بـathar
sudo -iu athar bash -lc "cd ~/app && scripts/ops/deploy.sh"
systemctl reload caddy
```

> **وحسابُ `athar` بلا كلمة مرور** عمداً (لا يُدخَل إليه إلا بمفتاح)،
> فـ`sudo` منه يسأل عن كلمةٍ لا وجود لها. ولهذا يُعطى في `bootstrap.sh`
> إذناً بلا كلمة لأمرين بعينهما — إعادةِ تشغيل الخدمتين وإعادةِ تحميل
> Caddy — وما عداهما يُفعل من جلسة root.

> **وثلاث خدماتٍ لا اثنتان** (القاعدة ١٢٢): `athar-site` على ٣٠٠١ يحمل
> صفحة الهبوط و`/contact` و`/delete-account` و`/u/*` واللوحة على الجذر،
> و`athar-web` على ٣٠٠٠ يحمل التطبيق تحت `/app`، و`athar-api` على ٤٠٠٠.
> و`basePath` يُدمج وقت البناء: تغييرُه يستلزم `deploy.sh` لا إعادةَ
> تشغيل.

> **وترتيبُ السحابة يهمّ**: يبقى سجلّا DNS **رماديَّين** (بلا وكيل) حتى
> يأخذ Caddy شهادته — التحدّي يمرّ بالمنفذ ٨٠ — ثمّ يُلوَّنان برتقاليّاً
> ووضعُ TLS على **Full (strict)**. وبالعكس تُقرأ الشهادةُ خطأً ٥٢٦.

### الخطوات مشروحةً

أوبونتو ٢٤٫٠٤ LTS. كلّ ما يلي بـ`root` ما لم يُذكر غيره.

### ٣٫١ الأساس

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades postgresql-16 \
               pgbouncer redis-server git curl ffmpeg
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

> **وخادمٌ قائمٌ من قبل هذا السطر ينقصه ffmpeg**: ثُبِّت في
> `bootstrap.sh` متأخّراً، فمن أقلع خادمه قبله يضيفها بيده —
> `apt install -y ffmpeg` ثمّ `systemctl restart athar-api`. وعلامتُها
> في السجلّ سطرٌ يقول `[media] ffprobe مفقود`، وأثرُها على المستخدم
> رسالةٌ صوتيّة وفيديو قصّةٍ يُردّان بـ«تعذّرت قراءة المقطع».

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
# إمّا مفتاحُ الواجهة (xkeysib) وإمّا مفتاحُ SMTP (xsmtpsib) — لا يتبادلان.
BREVO_API_KEY="..."
# SMTP_HOST="smtp-relay.brevo.com"
# SMTP_PORT="587"
# SMTP_USER="..."
# SMTP_PASS="xsmtpsib-..."
MAIL_FROM="noreply@atharmts.com"
SUPPORT_EMAIL="support@atharmts.com"

# الدخول بمزوّد: معرّفاتُ العملاء، مفصولةً بفاصلة.
GOOGLE_CLIENT_IDS="...ios...,...android...,...web..."
APPLE_CLIENT_IDS="app.athar.mobile,app.athar.signin"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="...web..."
SNAP_CLIENT_ID="..."
```

> **ونطاقُ المرسِل يُثبَت في بريفو أوّلاً** (Senders & Domains): سجلّا
> DKIM وSPF على `atharmts.com`، وإلّا رُفض الإرسال أو ذهب إلى «المهملات».
> والرسائلُ تحمل روابط مطلقة، فبلا `SITE_URL` لا تُرسَل أصلاً.

> **وعنوانُ الخادم يُسجَّل في بريفو** (`app.brevo.com/security/authorised_ips`):
> مفتاحُها مقصورٌ على عناوين مسجَّلة، فترّد ٤٠١ بـ«unrecognised IP address»
> والمفتاحُ سليم. ويُسجَّل **العنوانان** — IPv4 وIPv6 — فالخادم يخرج
> بأيّهما حسب الوجهة، وأوّلُ ما جرّبناه خرج بالسادس.
> وهذا فخٌّ صامت: لا شيء يظهر للمستخدم إلا «تحقّق من بريدك»، والسببُ
> سطرٌ في `journalctl -u athar-web | grep '[mail]'` وحده. فإن أُعيد
> تنصيبُ الخادم أو تغيّر عنوانه، يُسجَّل الجديد قبل أن يُسأل «لماذا وقف
> البريد».

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

## ٤ب. المفاتيح: أيُّها أين

**لا يدخل المستودعَ منها شيء** (`.gitignore` يمنعها): مكانُها متغيّراتُ
البيئة على الخادم، وأسرارُ EAS في بناء الجوّال.

| الملفّ | لماذا | أين يوضع |
|---|---|---|
| `*-firebase-adminsdk-*.json` | إرسالُ الإشعارات من خادمنا إلى فايربيس | متغيّرُ بيئةٍ على الخادم (المحتوى كلُّه في سطرٍ واحد، أو مسارٌ إلى ملفٍّ خارج المستودع) |
| `google-services.json` | يعرّف تطبيقَ أندرويد بفايربيس | بناءُ الجوّال (سرُّ ملفٍّ في EAS) |
| `GoogleService-Info.plist` | مثلُه لآبل | بناءُ الجوّال |
| `AuthKey_XXXXXXXXXX.p8` | مفتاحُ آبل: إمّا الإشعارات (APNs) وإمّا «الدخول بحساب آبل» | متغيّرُ بيئة، ومعه معرّفُ المفتاح ومعرّفُ الفريق |

و**مفتاحُ آبل لا يُعرف من محتواه لأيِّ شيءٍ هو**: الملفّان متطابقان في
الشكل (مفتاحُ EC واحد)، والفرقُ في لوحة آبل وحدها — فيُسمّى كلٌّ منهما
بدوره حين يُحفظ، ويُكتب معه معرّفُه. ولا يُنزَّل مفتاحُ آبل مرّتين، فمن
أضاعه أنشأ غيرَه وأبطل القديم.

> ومفتاحٌ مرّ في محادثةٍ أو بريدٍ أو محفوظاتِ أداة يُعدّ مكشوفاً:
> يُستبدل من لوحته (فايربيس ← حسابات الخدمة ← مفتاحٌ جديد ثمّ حذفُ
> القديم) قبل أن يُوضع في الإنتاج. الاستبدالُ دقيقة، وأثرُ التسريب
> يبقى.

## ٤ج. التنبيهات

الخادم يرسل إلى خدمة Expo، وهي تعرف أيُّ رمزٍ لأيّ منصّة. فما يلزم
مرّةً واحدة:

```bash
# مفتاحُ آبل للتنبيهات (.p8) ومعه معرّفُه ومعرّفُ الفريق
eas credentials -p ios      # Push Notifications ← Upload

# حسابُ خدمة فايربيس (FCM v1) لأندرويد
eas credentials -p android  # FCM V1 service account key ← Upload
```

ولا مفتاحَ في خادمنا ولا في المستودع: الإرسال بلا استيثاقٍ إلى
`exp.host`، والرمزُ نفسه هو العنوان. ومن أراد إغلاق البابَ أكثر يضيف
«Expo Access Token» ويرسله في الرأس.

> **والمحاكي لا يستقبل تنبيهاً**: التجربة على جهازٍ حقيقيّ بنسخةٍ
> مبنيّة (`eas build`)، لا في Expo Go.

## ٥. النسخ الاحتياطيّة

خادمٌ واحد يعني أنّ النسخة الاحتياطيّة هي الفرق بين عطلٍ وكارثة.
ثلاث طبقات:

1. **`pg_dump` يوميّاً إلى R2** — والسكربتان جاهزان في المستودع:
   `scripts/ops/backup-db.sh` و`restore-db.sh`، ومعهما وحدتا systemd.

   ```bash
   apt install -y rclone
   rclone config   # نوع: s3 ← مزوّد: Cloudflare R2 ← المفاتيح نفسها
   systemctl enable --now athar-backup.timer
   ```

   و**الدلو غير دلو الملفّات** (`athar-backups` في أوروبا): خلطُهما
   يجعل خطأً في مسارٍ يمحو الاثنين. وبياناتُ النسخ بياناتٌ شخصية، فلا
   تُترك تهبط حيث يقع الافتراض.

   > **وفخُّ نطاق الاتحاد الأوروبيّ**: دلوٌ أُنشئ بـJurisdiction: EU
   > **لا يُرى على العنوان المعتاد** — لا في القوائم ولا بالقراءة.
   > عنوانُه `https://<account>.eu.r2.cloudflarestorage.com`، ودلو
   > الملفّات على `https://<account>.r2.cloudflarestorage.com`. فيُكتب
   > في إعداد `rclone` عنوانُ الاتحاد صراحةً، وإلّا ردّ «لا يوجد هذا
   > الدلو» والنسخُ لا تُرفع — ولا يُكتشف ذلك إلا يوم الحاجة.
   >
   > ولذلك يبقى `R2_ENDPOINT` في بيئة التطبيق على العنوان المعتاد:
   > الملفّات ليست في نطاق الاتحاد، والسكربتُ وحده يكلّم دلو النسخ.
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
