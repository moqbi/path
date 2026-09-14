# نقل الويب إلى التطبيقات — ورقة العمل

## القاعدة

**كل ما في `src/` (الويب) يُنقل إلى `apps/mobile` بحذافيره. لا ارتجال،
ولا تبسيط، ولا «نسخةٌ مختصرة».**

كل شاشة، وكل مكوّن، وكل حركة، وكل خلفية، وكل نصٍّ يراه المستخدم — يُقرأ
من ملف الويب ويُنقل كما هو. إن تعذّر شيءٌ تقنياً في React Native (مثل
`mask-image` أو فلاتر CSS) فيُحاكى بأقرب وسيلةٍ **مكافئة عددياً** لا
بتقريبٍ بالنظر، ويُكتب سبب ذلك في تعليقٍ فوقه.

قبل كتابة أيّ شاشة: **افتح ملف الويب المقابل واقرأه كاملاً.**

## الحالة

### منقول ويعمل
| الويب | التطبيق |
| --- | --- |
| `src/components/moment-card.tsx` | `components/moment-card.tsx` |
| `src/components/moment-bar.tsx` | `components/moment-bar.tsx` |
| `src/components/reactions.tsx` | `components/reactions.tsx` + `components/reactors.tsx` |
| `src/components/composer-fan.tsx` | `components/composer-fan.tsx` |
| `src/components/timeline-head.tsx` | داخل `app/(tabs)/index.tsx` |
| `src/components/stories.tsx` | `components/stories.tsx` |
| `src/components/receipt.tsx` | `components/receipt.tsx` |
| `src/app/page.tsx` | `app/(tabs)/index.tsx` |
| `src/app/circle/page.tsx` | `app/(tabs)/circle.tsx` — **ناقص**: المقترحون، التصنيفات، الإخراج، الحظر |
| `src/app/notifications/page.tsx` | `app/(tabs)/notifications.tsx` |
| `src/app/store/page.tsx` + `grid.tsx` | `app/(tabs)/store.tsx` + `components/store-grid.tsx` |
| `src/app/me/page.tsx` | `app/(tabs)/me.tsx` — **ناقص**: نافذة الصورة، الإكسسوارات، ضبط الغلاف |
| `src/app/compose/form.tsx` | `app/compose.tsx` |
| `src/app/m/[id]/page.tsx` | `app/m/[id].tsx` |
| `src/app/u/[id]/page.tsx` | `app/u/[id].tsx` — **ناقص**: الإهداء، المحادثة، الحظر |
| `src/app/messages/page.tsx` | `app/messages.tsx` |
| `src/app/messages/[id]/` | `app/dm/[id].tsx` |
| `src/app/stories/[id]/viewer.tsx` | `app/stories/[id].tsx` |
| `src/components/story-composer.tsx` | `app/stories/new.tsx` |
| `src/app/subscribe/page.tsx` | `app/subscribe.tsx` |
| `src/app/login/form.tsx` | `app/login.tsx` |
| `src/components/avatar-menu.tsx` | `components/avatar-menu.tsx` |
| `src/app/me/edit-sheet.tsx` + `cover.tsx` + `images.tsx` + `edit/form.tsx` | `app/me/edit.tsx` |
| `src/app/me/accessories.tsx` | `app/me/accessories.tsx` |
| `src/app/settings/privacy/page.tsx` + `email.tsx` + `me/delete.tsx` | `app/settings/privacy.tsx` |
| `src/app/settings/blocked/page.tsx` | `app/settings/blocked.tsx` |
| `src/app/settings/support/` | `app/settings/support.tsx` |
| `src/app/page.tsx` العدستان + `components/tabbar.tsx` | `app/(tabs)/index.tsx` + `app/(tabs)/_layout.tsx` |

### لم يُنقل بعد — بالترتيب
1. **`src/app/music/page.tsx`** ← غير موجودة.
2. **`src/components/swipe-row.tsx`** ← السحب لحذف صفٍّ.
3. **`src/components/tour.tsx`** ← جولة التعريف.
4. **`src/app/admin/`** ← **لا يُنقل للموبايل**: مكانه `apps/web` حسب
    `MIGRATION.md`. أكّد مع صاحب المشروع قبل أيّ عمل عليه.

## الخادم

`apps/api` مكتملٌ لكل ما سبق. المسارات تحت `/v1`. إن احتجت مساراً
جديداً: `route → Zod → service → Prisma`، ولا منطق في المسارات.

## التشغيل

```bash
# قاعدة محلّية
/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/atharpg -o '-p 55432 -k /tmp' start   # كـpostgres

# الخادم (يقتل من يملك المنفذ أولاً — المطابقة بالاسم تخطئ)
lsof -tiTCP:4000 -sTCP:LISTEN | xargs -r kill; sleep 2
cd apps/api && DATABASE_URL=... JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... PORT=4000 npx tsx src/index.ts

# الموبايل — معاينةٌ في المتصفّح
cd apps/mobile && EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 CI=1 npx expo start --web --port 8081
```

## ما يجب أن تعرفه قبل أن تبدأ

- **الصور تبقى فارغةً في معاينة الويب وحدها**: `react-native-web` يترجم
  `<Image>` إلى `<img>` فيُسقط ترويسة التوكن. على الجهاز تعمل. لا تطارد
  هذا الخطأ.
- **الشريط السفلي**: `flexDirection: "row-reverse"` في `tabBarStyle`
  إلزاميّ — React Navigation لا يتبع `I18nManager`، فبدونه ينعكس
  الترتيب عن الويب.
- **حساب التجربة**: صاحب المشروع غيّر البريد. اطلبه منه قبل أي فحص.
- **بعد كل شاشة**: `npx tsc --noEmit` في `apps/mobile`، ثم افتحها في
  المتصفّح وقارنها بلقطةٍ من الويب قبل أن تقول إنها تمّت.
