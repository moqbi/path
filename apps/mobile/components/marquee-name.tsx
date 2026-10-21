import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { Text } from "./type";
import type { TextStyle } from "react-native";

/**
 * الاسمُ الطويل يتحرّك في مساحته ولا يدخل على ما بجانبه (القاعدة ٣٢٢) — **بقرار
 * المالك**: أقراصُ «أنا» في طرف سطر الاسم، واسمٌ أطولُ من مكانه كان سيُقصّ بنقاط.
 * فيُقاس عرضُه الطبيعيّ، وإن زاد على مكانه انزلق ذهاباً وإياباً بتمهّلٍ في طرفيه.
 * والاتجاهُ من اليمين: الاسمُ يبدأ من طرف البداية ويفيض يساراً، فالانزلاقُ إلى
 * اليمين يكشف آخرَه. ومن طلب «قلّل الحركة» يرى أوّلَه ثابتاً.
 */
export function MarqueeName({ name, style }: { name: string; style: TextStyle }) {
  const [box, setBox] = useState(0);
  const [full, setFull] = useState(0);
  const [still, setStill] = useState(false);
  const shift = useRef(new Animated.Value(0)).current;
  const over = full > box + 1 && box > 0 ? full - box : 0;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);

  useEffect(() => {
    shift.setValue(0);
    if (!over || still) return;
    const travel = Math.max(1200, over * 28);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(shift, { toValue: over, duration: travel, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(shift, { toValue: 0, duration: travel, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      // ثلاثُ دوراتٍ ثمّ يقف على أوّله: من قرأه مرّةً عرفه، وحركةٌ لا تقف تُسخّن الجوّال.
      { iterations: 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [over, still]);

  return (
    <View
      onLayout={(event) => setBox(event.nativeEvent.layout.width)}
      style={{ flexShrink: 1, minWidth: 0, overflow: "hidden", flexDirection: "row" }}
    >
      {/* القياس: نسخةٌ خفيّةٌ في عرضٍ مفتوح تقول طولَ الاسم كلّه. */}
      <View pointerEvents="none" style={{ position: "absolute", opacity: 0, width: 2000, flexDirection: "row" }}>
        <Text onLayout={(event) => setFull(event.nativeEvent.layout.width)} style={[style, { flexShrink: 0 }]}>
          {name}
        </Text>
      </View>
      <Animated.View style={{ width: full || undefined, flexShrink: 0, transform: [{ translateX: shift }] }}>
        <Text numberOfLines={1} style={style}>
          {name}
        </Text>
      </Animated.View>
    </View>
  );
}
