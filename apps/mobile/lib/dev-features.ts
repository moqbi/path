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

/**
 * بناءُ التطوير — لما يُبنى بعد ٠٫١٫٤ ويُختبر قبل أن يُرفع حارسُه (القاعدة ٢٩١).
 */
export const DEV_BUILD: boolean = (() => {
  if (__DEV__) return true;
  if (hasDevLauncher()) return true;
  try {
    return Updates.channel === "development";
  } catch {
    return false;
  }
})();

/**
 * **ما اختُبر في نسخة التطوير حتى ٠٫١٫٤ صار للجميع** — **بقرار المالك** (القاعدة ٣٦٨): بناءُ
 * ٠٫١٫٤ يحمله ظاهراً، و`runtimeVersion` من رقم الإصدار فلا يصل هذا إلى ٠٫١٫٣ بتحديث. والاسمُ
 * باقٍ لأنّ أربعةً وتسعين موضعاً تقرؤه؛ وما يُبنى بعده يُحرس بـ`DEV_BUILD`.
 */
export const DEV_FEATURES = true;
