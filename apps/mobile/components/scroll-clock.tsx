import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { Text } from "./type";
import { colors } from "../theme/tokens";

/** ارتفاعُ القرص — يُطرح من مدى انزلاقه فلا يخرج أسفلَ القائمة. */
export const SCROLL_CLOCK_H = 24;

/**
 * الدقائقُ متّصلةً عبر الأيام (القاعدة ٣١٢): دقائقُ اليوم ناقصاً ١٤٤٠ لكلّ يومٍ مضى.
 * فالعقاربُ تدور إلى الوراء كلّما نزلتَ في الخطّ، ولا تقفز من منتصف الليل إلى ما قبله.
 */
export function clockMinutes(date: Date): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((start.getTime() - day.getTime()) / 86_400_000);
  return date.getHours() * 60 + date.getMinutes() - daysAgo * 1440;
}

/**
 * ساعةُ التمرير تناظريّةً صغيرة (القاعدة ٣١٢): قرصٌ داكن بعقربين يدوران إلى وقت
 * أعلى لحظةٍ ظاهرة، وبجانبه الوقتُ نصّاً — والقرصُ كلُّه ينزلق مع موضعك في القائمة
 * (`slide`) كمقبض التمرير. والعقاربُ على الخيط الأصليّ: تدور والقائمةُ تمرّ.
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
  const hands = useRef(new Animated.Value(minutes)).current;
  useEffect(() => {
    Animated.timing(hands, {
      toValue: minutes,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [minutes, hands]);

  // الساعةُ نصفُ درجةٍ في الدقيقة، والدقائقُ ستُّ درجات.
  const hour = hands.interpolate({ inputRange: [0, 720], outputRange: ["0deg", "360deg"], extrapolate: "extend" });
  const minute = hands.interpolate({ inputRange: [0, 60], outputRange: ["0deg", "360deg"], extrapolate: "extend" });
  const DIAL = 18;

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
        gap: 5,
        height: SCROLL_CLOCK_H,
        paddingLeft: 3,
        paddingRight: 9,
        borderRadius: SCROLL_CLOCK_H / 2,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <View style={{ width: DIAL, height: DIAL, borderRadius: DIAL / 2, backgroundColor: colors.chrome }}>
        {/* العقربُ عمودٌ بطول القطر نصفُه شفّاف: يدور حول وسطه فيبقى طرفُه المرسوم من المركز. */}
        <Animated.View
          style={{ position: "absolute", left: DIAL / 2 - 1, top: 3, width: 2, height: DIAL - 6, transform: [{ rotate: hour }] }}
        >
          <View style={{ height: (DIAL - 6) / 2, marginTop: 2, borderRadius: 1, backgroundColor: colors.chromeInk }} />
        </Animated.View>
        <Animated.View
          style={{ position: "absolute", left: DIAL / 2 - 0.75, top: 2, width: 1.5, height: DIAL - 4, transform: [{ rotate: minute }] }}
        >
          <View style={{ height: (DIAL - 4) / 2, borderRadius: 1, backgroundColor: colors.gold }} />
        </Animated.View>
        <View style={{ position: "absolute", left: DIAL / 2 - 1.5, top: DIAL / 2 - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.gold }} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 11, fontWeight: "700" }}>{text}</Text>
    </Animated.View>
  );
}
