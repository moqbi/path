import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

/**
 * رقمُ النسخة كما يُقال للدعم (القاعدة ٣٠٨): الإصدار، ورقمُ البناء، والتحديثُ
 * الذي يعمل الآن — كلُّه يُقرأ من الجهاز لا يُكتب في الكود، فيتبدّل وحده مع كلّ
 * بناءٍ وكلّ تحديث.
 *
 * والإصدارُ من البناء الأصليّ (`nativeAppVersion`) لا من `expoConfig`: الثاني من
 * حزمة جافاسكربت، فيقول ما قاله `app.json` ساعةَ نُشر التحديث لا ما ثُبّت.
 * و`nativeBuildVersion` مهجورٌ لصالح `expo-application`، لكنّه يعمل في SDK 54
 * ولا يحتاج وحدةً أصليّةً جديدة (القاعدة ١٢٤).
 */
export function versionLine(): string {
  if (Platform.OS === "web") return "";
  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "";
  const build = Constants.nativeBuildVersion;
  const head = build ? `${version} (${build})` : version;
  // ما ثُبّت من المتجر أو البناء نفسه لا تحديثَ فوقه، فلا يُكتب له شيء.
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return head;
  return `${head} · ${Updates.updateId.slice(0, 7)}`;
}
