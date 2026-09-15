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
pnpm --filter @athar/mobile exec eas init   # يربط المشروع بحساب Expo
pnpm --filter @athar/mobile exec expo start
```

الحزمة: `app.athar.mobile` — نفس ما في Firebase، فملف
`google-services.json` يعمل بلا تغيير.
