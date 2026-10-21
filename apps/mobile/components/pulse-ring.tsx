import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { colors } from "../theme/tokens";

/**
 * دوائرُ تنبض حول صورةٍ فيها قصّةٌ أو نوتٌ لم تُشاهَد (القاعدة ٣١٩) — **بقرار المالك**،
 * بدل الحلقة والنقطة: ثلاثُ حلقاتٍ تتّسع من حافّة الصورة وتبهت متتاليةً، كهالات
 * رادار «من حولك». ومن طلب «قلّل الحركة» يرى حلقةً ثابتةً واحدة.
 * `size` قطرُ الصورة، والحلقاتُ مرسومةٌ خلفها فلا تحجب الإطار ولا التشارم.
 */
export function PulseRing({ size, color = colors.clay }: { size: number; color?: string }) {
  const [still, setStill] = useState(false);
  const waves = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (still) return;
    const loops = waves.map((wave, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(wave, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay((2 - i) * 600),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [still]);

  const ring = {
    position: "absolute" as const,
    width: size + 6,
    height: size + 6,
    left: -3,
    top: -3,
    borderRadius: (size + 6) / 2,
    borderWidth: 2.5,
    borderColor: color,
  };
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: size, height: size }}>
      {still ? (
        <View style={ring} />
      ) : (
        waves.map((wave, i) => (
          <Animated.View
            key={i}
            style={{
              ...ring,
              opacity: wave.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
            }}
          />
        ))
      )}
    </View>
  );
}
