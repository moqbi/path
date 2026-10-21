import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * رقمُ النسخة كما يُقال للدعم (القاعدة ٣٠٨): الإصدارُ ورقمُ البناء — كلاهما يُقرأ من الجهاز لا يُكتب في الكود، فيتبدّل وحده مع كلّ
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
  // بلا معرّف التحديث — **بقرار المالك**: سبعةُ حروفٍ لا يقرؤها أحد.
  return build ? `${version} (${build})` : version;
}
