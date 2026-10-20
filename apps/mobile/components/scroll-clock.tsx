import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Text } from "./type";

/** ارتفاعُ الكبسولة — يُطرح من مدى انزلاقها فلا تخرج أسفلَ القائمة. */
export const SCROLL_CLOCK_H = 32;

const DIGITS = "٠١٢٣٤٥٦٧٨٩";
/** ارتفاعُ سطر الرقم: العمودُ يُزاح بمضاعفاته فيقف الرقمُ المطلوب في النافذة. */
const LINE = 19;

/**
 * ألوانٌ ثابتة لا تتبع الثيم (القاعدة ٣١٣): كبسولةٌ تطفو فوق الخطّ كانت تأخذ
 * ألوانَ البطاقة والشريط فتتشوّه مع ثيمٍ داكنٍ أو فاقع — والزجاجُ الداكن يُقرأ
 * فوق أيّ أرضية.
 */
const GLASS = "rgba(14,26,36,0.86)";
const INK = "#FDFCF8";
const SUN = "#F6B93B";
const MOON = "#C9D3F2";

/** دقيقةُ اليوم بتوقيت الجهاز — للشمس والقمر. */
export function clockMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** عمودُ رقمٍ يدور إلى قيمته كعدّاد. */
function Digit({ value }: { value: number }) {
  const shift = useRef(new Animated.Value(-value * LINE)).current;
  useEffect(() => {
    Animated.timing(shift, {
      toValue: -value * LINE,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, shift]);
  return (
    <View style={{ height: LINE, overflow: "hidden" }}>
      <Animated.View style={{ transform: [{ translateY: shift }] }}>
        {DIGITS.split("").map((d) => (
          <Text key={d} style={{ height: LINE, lineHeight: LINE, color: INK, fontSize: 15, fontWeight: "700" }}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * ساعةُ التمرير (القاعدة ٣١٣): كبسولةٌ داكنة فيها شمسٌ أو هلال، والوقتُ بأرقامٍ تدور
 * كالعدّاد إلى وقت أعلى لحظةٍ ظاهرة — وتنزلق على الحافّة اليسرى مع موضعك في القائمة
 * (`slide`)، وتبهت بعد الإصبع (`fade`).
 */
export function ScrollClock({
  text,
  minutes,
  fade,
  slide,
}: {
  text: string;
  minutes: number;
  fade: Animated.Value;
  slide: Animated.Value;
}) {
  // «٩:٤٥ م» ← أرقامُ الساعة واللاحقة.
  const cut = text.lastIndexOf(" ");
  const clock = cut > 0 ? text.slice(0, cut) : text;
  const suffix = cut > 0 ? text.slice(cut + 1) : "";
  const hour = Math.floor(minutes / 60);
  const day = hour >= 6 && hour < 18;
  const glyphs = clock.split("");

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        opacity: fade,
        transform: [{ translateY: slide }],
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        height: SCROLL_CLOCK_H,
        paddingHorizontal: 11,
        borderRadius: SCROLL_CLOCK_H / 2,
        backgroundColor: GLASS,
        shadowColor: "#000",
        shadowOpacity: 0.22,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      {day ? (
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={SUN} strokeWidth={2} strokeLinecap="round">
          <Circle cx={12} cy={12} r={4} />
          <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </Svg>
      ) : (
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={MOON} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </Svg>
      )}
      {/* الأرقامُ من اليسار كما تُقرأ الساعة، والمفتاحُ من آخرها فتبقى أعمدةُ الدقائق
          في مكانها حين تصير الساعةُ رقمين. */}
      <View style={{ flexDirection: "row", direction: "ltr", alignItems: "center" }}>
        {glyphs.map((ch, index) => {
          const n = DIGITS.indexOf(ch);
          const key = glyphs.length - index;
          return n >= 0 ? (
            <Digit key={key} value={n} />
          ) : (
            <Text key={key} style={{ height: LINE, lineHeight: LINE, color: INK, fontSize: 15, fontWeight: "700", paddingHorizontal: 1 }}>
              {ch}
            </Text>
          );
        })}
      </View>
      {suffix ? <Text style={{ color: "rgba(253,252,248,0.75)", fontSize: 12 }}>{suffix}</Text> : null}
    </Animated.View>
  );
}
