import { Platform, StyleSheet, View } from "react-native";
import { MediaImage } from "./media-image";
import { useSession } from "../lib/session";
import { veil } from "../theme/tokens";

/**
 * صورةُ الثيم داخل التبويب على آبل (القاعدة ٢٦١).
 *
 * الجذرُ يرسمها خلف الشاشات كلّها (القاعدة ١٨٧)، لكنّ شريطَ آبل الأصليّ يُلبس
 * كلَّ تبويبٍ أرضيةً بيضاء مكتوبةً في `react-native-screens` نفسها — فكان الثيمُ
 * يُشترى ولا تُرى صورتُه في التبويبات الخمسة. فتُرسم هنا ثانيةً فوق ذلك البياض،
 * بحجابها نفسه. وأندرويد على الشريط المرسوم يرى صورةَ الجذر، فلا يُضاعف الحجاب.
 */
export function TabBackdrop() {
  const mediaId = useSession((state) => state.me?.background?.mediaId ?? null);
  if (Platform.OS !== "ios" || !mediaId) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <MediaImage mediaId={mediaId} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: veil() }]} />
    </View>
  );
}
