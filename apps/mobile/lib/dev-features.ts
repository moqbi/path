import * as Updates from "expo-updates";

/**
 * ما يُبنى الآن يُختبر في نسخة التطوير وحدها — **بقرار المالك**: الخادمُ يحمله
 * للجميع (إضافاتٌ لا تكسر شيئاً)، والواجهةُ تظهر في بناء التطوير وفي قناة
 * `development` وحدهما. فتحديثُ الإنتاج يحمل الكود ولا يُظهره، حتى يُبنى إصدارٌ
 * جديد ويُرفع هذا الحارس عن ميزته.
 */
export const DEV_FEATURES: boolean = (() => {
  if (__DEV__) return true;
  try {
    return Updates.channel === "development";
  } catch {
    return false;
  }
})();
