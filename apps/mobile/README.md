# تطبيق آثار — React Native + Expo

تطبيقٌ أصليّ لا غلافٌ لموقع: `expo-router` للتنقّل، و`NativeWind` للهوية
نفسها، و`TanStack Query` لحالة الخادم، و`Zustand` لحالة الشاشة.

## الحدود

- **لا Prisma هنا أبداً.** الجهاز في يد مستخدم، والقاعدة خلف الخادم —
  الوصول عبر HTTPS إلى `apps/api` وحده.
- التوكن في `expo-secure-store` لا في `AsyncStorage`.
- RTL في كل شاشة: `I18nManager.forceRTL` مع `allowRTL`.

## الإقلاع

```bash
pnpm --filter @athar/mobile exec expo start
```

## البناء والنشر

بناءُ نسخةٍ للمتجر ورفعُها إلى آبل، وتحديثاتُ OTA بلا بناء، في
[`OPS.md`](../../OPS.md) ← القسم ٨. ومختصرُها:

- `npx expo-doctor` قبل كلّ بناء — حزمُ Expo تتبع إصدار SDK (القاعدة ١٢٤).
- وحدةٌ أصليّة جديدة ترفع `version` في `app.json`، فالتحديثاتُ تصل إلى
  البناءات بالإصدار نفسه وحده (القاعدة ٢٣٩).
- التحديثُ من GitHub ← Actions ← **OTA update**، ويُطبَّق من أوّل فتح
  (القاعدة ٢٧٥).

## ٠٫١٫٣ — البلوتوث

- **«من حولك» بالبلوتوث** داخل الرادار بجانب الموقع (القاعدة ٢٨٢ في `CLAUDE.md`):
  `modules/nearby-beacon` (Swift ← CoreBluetooth) يبثّ رمزاً من `/v1/circle/nearby/token`
  ويمسح، وما يُلتقط يُحلّ على `/v1/circle/nearby/seen` بقوّة الإشارة. كانت لآبل وحدها،
  ثمّ أُضيف أندرويد (القاعدة ٤٤٥). والخادمُ يُنشر قبل النسخة أو معها.

## ٠٫١٫٥ — منشور (SDK 58)

ما كان في نسخة التطوير وحدها صار في البناء (`DEV_FEATURES = true` في
`lib/dev-features.ts` — القاعدة ٣٦٨)، ومعه وحداتٌ أصليّة: «خريطتي»
(`react-native-maps`)، وامتدادُ المشاركة، وامتدادُ صور التنبيهات، واختصاراتُ
الأيقونة، والأيقونةُ الزرقاء. والقائمةُ كاملةً في [`CHANGELOG.md`](../../CHANGELOG.md).

**وما يُبنى بعدها يُحرس بـ`DEV_BUILD`** (مُشغّلُ التطوير نفسه) لا بـ`DEV_FEATURES`:
يُجرَّب بتحديث قناة `development`، ثمّ يُرفع حارسُه مع البناء القادم. وتحديثُ OTA
يصل إلى ٠٫١٫٥ وحده (`runtimeVersion` من الإصدار — القاعدة ٢٣٩).

## ٠٫١٫٥ لهواوي (AppGallery) — منشور

ملفّ البناء `huawei` في `eas.json` (يمتدّ من `production` وقناتُه `production`، فيصله OTA
الإصدار نفسه — `platform: all` في `prod-update.yml`). وحدةُ `modules/huawei-hms` تحمل
التنبيهات (Push Kit) والدفع (Huawei IAP) وفحصَ التحديث من AppGallery عند الإقلاع
(`checkUpdate` — شرطُ مراجعة هواوي، القاعدة ٤٥٥)، وفي كلّ ملفّ بناءٍ آخر بديلٌ فارغ.
و`agconnect-services.json` من سرّ EAS `AGCONNECT_SERVICES` بمستوى «Secret» لا من المستودع
(القاعدتان ٤٤٦ و٤٤٧). والتفاصيلُ في القواعد ٤٤٠–٤٥٥ وفي `BILLING.md`.

والبلوتوثُ في «من حولك» يعمل على أندرويد أيضاً (القاعدة ٤٤٥).

الحزمة: `app.athar.mobile` — نفس ما في Firebase، فملف
`google-services.json` يعمل بلا تغيير.
