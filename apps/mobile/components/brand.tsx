import { View, Text, Image } from "react-native";
import { colors } from "../theme/tokens";

/**
 * علامة أثر — الصورة نفسها التي في الويب (`assets/athr-mark.png`).
 *
 * الرمز رسمٌ للمالك بتدرّجه وظلاله وشريطه المطويّ، لا `stroke` في SVG
 * يُقلّده. واستبدال الملف يغيّره في التطبيق كله بلا لمس الكود — كرسوم
 * التفاعلات وقوس النشر. وخلفيته شفّافة فيُقرأ على الورق وعلى الشريط
 * الداكن سواء.
 */
export function AthrMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/athr-mark.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

/** العلامة كاملة: الرمز ثم ATHR ثم «أثر» تحته. */
export function AthrLockup({ size = 44 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <AthrMark size={size * 1.5} />
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text style={{ color: colors.ink, fontSize: size * 0.62, fontWeight: "700" }}>ATHR</Text>
        <Text style={{ color: colors.ink2, fontSize: size * 0.4, letterSpacing: size * 0.13 }}>
          أثر
        </Text>
      </View>
    </View>
  );
}

/** عبارتا العلامة — نفس نصّ `src/components/brand.tsx` حرفاً بحرف. */
export const TAGLINE_AR = "لحظاتك، مع ناسك.";
export const TAGLINE_EN = "Your people. Your moments. Your story.";
