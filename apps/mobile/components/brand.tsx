import { View, Text } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../theme/tokens";

/**
 * علامة أثر — نفس المسار والتدرّج اللذين في الويب حرفاً بحرف.
 *
 * الرمز قمّةٌ مدوّرة بحدٍّ سميك ونقطةٌ منفصلة أعلى اليمين: تُقرأ جبلاً أو
 * شخصاً رافعاً يده.
 */
export function AthrMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Defs>
        <LinearGradient id="athrMark" x1="6" y1="42" x2="42" y2="8" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F6B93B" />
          <Stop offset="1" stopColor="#FF7A5A" />
        </LinearGradient>
      </Defs>
      <Path
        d="M9 40 L21.2 15.4a3.2 3.2 0 0 1 5.7 0L33 27.6"
        stroke="url(#athrMark)"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={36.4} cy={12.6} r={4.8} fill="url(#athrMark)" />
    </Svg>
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
