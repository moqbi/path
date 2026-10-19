const fs = require("fs");
const path = require("path");
const { withPlugins } = require("expo/config-plugins");

/**
 * Firebase لتأكيد رقم الجوال (القاعدة ٢٩٧) — **بملفّيه أو بلاه**.
 *
 * حزمُ `@react-native-firebase` تُربط في كلّ بناءٍ ما دامت في `package.json`، لكنّ
 * إضافتَها ترمي إن غاب `GoogleService-Info.plist` — فبناءٌ قبل أن تُنزَّل الملفّاتُ من
 * لوحة Firebase كان سيسقط كلُّه لأجل بابٍ واحد. فالإضافةُ تُطبَّق حين يوجد الملفّ،
 * وبلاه يُبنى التطبيقُ بلا تطبيق Firebase مُهيَّأ فيقول الجوّالُ «غير مفعّل» (`lib/phone-auth.ts`).
 * والأطرُ الديناميكيّة (`useFrameworks`) في `app.json` نفسه لا هنا: حزمةُ Firebase
 * لآبل تطلبها مربوطةً كانت الملفّات أو لم تكن.
 */
module.exports = function withFirebase(config) {
  const root = config._internal?.projectRoot ?? process.cwd();
  const ios = "./GoogleService-Info.plist";
  const android = "./google-services.json";
  const hasIos = fs.existsSync(path.resolve(root, ios));
  const hasAndroid = fs.existsSync(path.resolve(root, android));
  if (!hasIos && !hasAndroid) return config;
  if (hasIos) config.ios = { ...config.ios, googleServicesFile: ios };
  if (hasAndroid) config.android = { ...config.android, googleServicesFile: android };
  return withPlugins(config, ["@react-native-firebase/app", "@react-native-firebase/auth"]);
};
