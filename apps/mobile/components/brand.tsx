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
 * الاسم اللاتينيّ كلمتين لا كلمةً واحدة.
 *
 * «ATHAR» هي الاسم، و«Moments» لاحقتُه: أصغرُ منها وبلون العلامة، تجلس
 * على خطّ قاعدتها لا في وسطها. وكلمتان بمقاسٍ ولونٍ واحد تُقرآن اسماً
 * من مقطعين متساويين، والثانية ليست كذلك.
 *
 * و`direction: "ltr"` على الصفّ لازمةٌ لا زينة: جذر الشجرة `rtl`،
 * فصفٌّ تحته يرصّ من اليمين — وكانت تُقرأ «Moments ATHAR».
 *
 * و`alignItems: "baseline"` لا `center`: كلمةٌ صغيرة في وسط كلمةٍ
 * كبيرة تطفو فوق خطّها، والعين تقرأ سطرين لا سطراً.
 */
export function AthrWordmark({
  size = 28,
  color,
  accent,
}: {
  size?: number;
  color?: string;
  /** لون اللاحقة — لون العلامة افتراضاً. */
  accent?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", direction: "ltr" }}>
      <Text face="latin" style={{ color: color ?? colors.ink, fontSize: size, fontWeight: "700" }}>
        ATHAR
      </Text>
      <Text
        face="latin"
        style={{
          color: accent ?? colors.clay,
          fontSize: size * 0.54,
          fontWeight: "500",
          marginLeft: size * 0.14,
        }}
      >
        Moments
      </Text>
    </View>
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
        <AthrWordmark size={size * 0.56} />
        <Text style={{ color: colors.ink2, fontSize: size * 0.32, letterSpacing: size * 0.06 }}>
          آثار مومنتس
        </Text>
      </View>
    </View>
  );
}

/** عبارتا العلامة — نفس نصّ `src/components/brand.tsx` حرفاً بحرف. */
export const TAGLINE_AR = "لحظاتك، مع ناسك.";
export const TAGLINE_EN = "Your people. Your moments. Your story.";
