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

الحزمة: `app.athar.mobile` — نفس ما في Firebase، فملف
`google-services.json` يعمل بلا تغيير.
