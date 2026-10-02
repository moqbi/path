const { withEntitlementsPlist } = require("expo/config-plugins");

/**
 * روابطُ النطاق تفتح التطبيق (Universal Links — القاعدة ٢٢٥).
 *
 * رابطُ المشاركة `https://<النطاق>/u/<رقم>` كان يُفتح في المتصفّح دائماً،
 * و«افتح في التطبيق» يجرّب `athar://` — وواتساب وسناب يفتحان الروابط في
 * متصفّحهما الداخليّ الذي يحجب المخطّطات الغريبة، فتمضي المهلةُ ويُرسَل من
 * نزّل التطبيقَ إلى المتجر. والحلّ أن يعرف النظامُ أنّ النطاق للتطبيق:
 * هذا الاستحقاقُ في البناء، وملفُّ `apple-app-site-association` على الموقع.
 *
 * والنطاقُ من البيئة (`EXPO_PUBLIC_SITE_URL`) لا مكتوبٌ هنا (القاعدة ١٠٥)،
 * وبلاه لا يُضاف شيء — بناءٌ بلا نطاقٍ لا يعِد بروابط لا تعمل.
 */
module.exports = function withLinks(config) {
  const site = process.env.EXPO_PUBLIC_SITE_URL ?? "";
  let host = "";
  try {
    host = new URL(site).host;
  } catch {
    host = "";
  }
  if (!host) return config;

  return withEntitlementsPlist(config, (mod) => {
    const key = "com.apple.developer.associated-domains";
    const now = new Set(mod.modResults[key] ?? []);
    now.add(`applinks:${host}`);
    mod.modResults[key] = [...now];
    return mod;
  });
};
