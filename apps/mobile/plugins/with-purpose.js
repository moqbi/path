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
  // ونصُّ الدقّة المؤقّتة من `expo-location` منذ SDK 58 — لا نطلبها (القاعدة ٣٩٨).
  // أمّا نصُّ الحركة فباقٍ بنصّنا: كودُ `expo-location` يشير إلى CoreMotion، وآبل
  // ردّت البناء ٣٧ بلاه (ITMS-90683) — القاعدة ٤١٤.
  "NSLocationTemporaryUsageDescriptionDictionary",
];

/*
 * إذنُ الشبكة المحلّيّة لمُشغّل التطوير وحده (القاعدة ٤١٥): `expo-dev-launcher` يكتب
 * نصَّه الإنجليزيّ و`_expo._tcp` ويعتمد على خطوة بناءٍ تحذفهما من نسخة الإصدار — وتلك
 * تبحث عن الهدف باسمٍ غير اسمه (القاعدة ٤٠٠) فلا تجده، فبقيا في البناء ٣٨. نسخةُ المتجر
 * لا تفتح الشبكة المحلّيّة أصلاً، فيُحذفان هنا في كلّ ملفٍّ غير `development`.
 */
const DEV_ONLY = process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== "development";

module.exports = function withPurpose(config) {
  return withInfoPlist(config, (mod) => {
    for (const key of UNUSED) delete mod.modResults[key];
    if (DEV_ONLY) {
      delete mod.modResults.NSLocalNetworkUsageDescription;
      const bonjour = (mod.modResults.NSBonjourServices ?? []).filter(
        (s) => s.toLowerCase().replace(/\.$/, "") !== "_expo._tcp",
      );
      if (bonjour.length) mod.modResults.NSBonjourServices = bonjour;
      else delete mod.modResults.NSBonjourServices;
    }
    return mod;
  });
};
