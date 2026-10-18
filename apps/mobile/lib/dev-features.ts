import { NativeModules, TurboModuleRegistry } from "react-native";
import * as Updates from "expo-updates";

/**
 * ما يُبنى الآن يُختبر في نسخة التطوير وحدها — **بقرار المالك**: الخادمُ يحمله
 * للجميع (إضافاتٌ لا تكسر شيئاً)، والواجهةُ تظهر في بناء التطوير وحده. فتحديثُ
 * الإنتاج يحمل الكود ولا يُظهره، حتى يُبنى إصدارٌ جديد ويُرفع هذا الحارس عن ميزته.
 *
 * **وبناءُ التطوير يُعرف بمُشغّله لا بقناته**: فيه `expo-updates` بيد مُشغّل التطوير،
 * فـ`Updates.channel` فارغةٌ ولو حُمّل تحديثُ قناة `development` — فكانت الميزاتُ
 * مخفيّةً في النسخة التي بُنيت لها. و`EXDevLauncher` وحدةٌ `debugOnly`: موجودةٌ في
 * بناء التطوير وغائبةٌ عن نسخة المتجر، فوجودُها هو الجواب.
 */
function hasDevLauncher(): boolean {
  try {
    return Boolean(TurboModuleRegistry.get("EXDevLauncher") ?? NativeModules.EXDevLauncher);
  } catch {
    return Boolean(NativeModules.EXDevLauncher);
  }
}

export const DEV_FEATURES: boolean = (() => {
  if (__DEV__) return true;
  if (hasDevLauncher()) return true;
  try {
    return Updates.channel === "development";
  } catch {
    return false;
  }
})();
