import { View, Image } from "react-native";
import { Text } from "./type";
import { colors } from "../theme/tokens";

/**
 * علامة آثار — الصورة نفسها التي في الويب (`assets/athr-mark.png`).
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

/**
 * العلامة كاملة: الرمز، ثم الاسم الكامل باللاتيني، ثم بالعربي تحته.
 *
 * «ATHAR Moments» / «آثار مومنتس» هو الاسم في المتجرين وفي كل موضعٍ
 * يعرّف المنتج. و«ATHAR» وحدها تبقى في الرؤوس الضيّقة — شريطٌ علويّ لا
 * يتّسع لاسمٍ من كلمتين، والرمز بجانبها يقول البقيّة.
 */
export function AthrLockup({ size = 44 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <AthrMark size={size * 1.5} />
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text
          face="latin"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: colors.ink, fontSize: size * 0.46, fontWeight: "700" }}
        >
          ATHAR Moments
        </Text>
        <Text style={{ color: colors.ink2, fontSize: size * 0.34, letterSpacing: size * 0.08 }}>
          آثار مومنتس
        </Text>
      </View>
    </View>
  );
}

/** عبارتا العلامة — نفس نصّ `src/components/brand.tsx` حرفاً بحرف. */
export const TAGLINE_AR = "لحظاتك، مع ناسك.";
export const TAGLINE_EN = "Your people. Your moments. Your story.";
