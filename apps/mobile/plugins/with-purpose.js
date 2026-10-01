const { withInfoPlist } = require("expo/config-plugins");

/**
 * نصوصُ الأذونات ما نستعمله وحده (القاعدة ٢٠١).
 *
 * آبل تردّ النسخة على نصّ إذنٍ لا يقول لماذا ولا يعطي مثالاً (5.1.1(ii))،
 * وبعضُ الحزم تُضيف نصوصاً عامّةً إنجليزيةً بنفسها: `expo-location` يُضيف
 * «دائماً» (`NSLocationAlways*`) ونحن لا نقرأ الموقع في الخلفية أصلاً، و
 * `expo-secure-store` يُضيف Face ID ونحن لا نطلب بصمةً للمخزن — وذاك يُطفأ
 * بخياره في `app.json` (`faceIDPermission: false`) لأنّ حزمته تكتب بعدنا.
 * ونصٌّ لإذنٍ لا يُطلب يسأل عنه المراجع: «أين يُستعمل هذا؟». فتُحذف هنا،
 * ونصوصُنا المكتوبة في `app.json` و`locales/ar.json` تبقى.
 */
const UNUSED = [
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "NSLocationAlwaysUsageDescription",
  "NSFaceIDUsageDescription",
];

module.exports = function withPurpose(config) {
  return withInfoPlist(config, (mod) => {
    for (const key of UNUSED) delete mod.modResults[key];
    return mod;
  });
};
