import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, View } from "react-native";
import { colors } from "../theme/tokens";

/**
 * دوائرُ تنبض حول صورةٍ فيها قصّةٌ أو نوتٌ لم تُشاهَد (القاعدة ٣١٩) — **بقرار المالك**،
 * بدل الحلقة والنقطة: ثلاثُ حلقاتٍ تتّسع من حافّة الصورة وتبهت متتاليةً، كهالات
 * رادار «من حولك». ومن طلب «قلّل الحركة» يرى حلقةً ثابتةً واحدة.
 * `size` قطرُ الصورة، والحلقاتُ مرسومةٌ خلفها فلا تحجب الإطار ولا التشارم.
 */
/*
  الهالاتُ **مشتركةٌ بين الحلقات كلّها** لا ثلاثٌ لكلّ صورة: الخطُّ الزمنيّ يرسم عشراتِ
  البطاقات، وكانت كلُّ صورةٍ بقصّةٍ تُطلق ثلاثَ حركاتٍ لا تقف — مع طبقة السحب سخّنت الجوّال.
  الآن ثلاثُ قيمٍ تدور ما دامت حلقةٌ واحدةٌ مرسومة، وتقف حين لا يبقى منها شيء، وتقف
  والتطبيقُ في الخلفيّة.
*/
const shared = [0, 1, 2].map(() => new Animated.Value(0));
let users = 0;
let running: Animated.CompositeAnimation | null = null;

/*
  **ثلاثُ نبضاتٍ ثمّ حلقةٌ ساكنة** (القاعدة ٣٢٩): الخطُّ الزمنيّ يبقى مركّباً تحت التبويبات
  الأخرى، فحلقةٌ تنبض بلا نهاية كانت تدور والصاحبُ في المتجر أو المحادثات — والجوّالُ يسخن.
  تعود تنبض حين تُرسم حلقةٌ جديدة (بطاقةٌ تدخل الشاشة) أو يعود التطبيقُ من الخلفيّة.
*/
const ROUNDS = 3;

function start() {
  if (running) return;
  const round = Animated.parallel(
    shared.map((wave, i) =>
      Animated.sequence([
        Animated.delay(i * 600),
        Animated.timing(wave, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay((2 - i) * 600),
      ]),
    ),
  );
  running = Animated.loop(round, { iterations: ROUNDS });
  running.start(() => {
    running = null;
  });
}

function stop() {
  running?.stop();
  running = null;
  shared.forEach((wave) => wave.setValue(0));
}

AppState.addEventListener("change", (state) => {
  if (state !== "active") stop();
  else if (users > 0) start();
});

export function PulseRing({ size, color = colors.clay }: { size: number; color?: string }) {
  const [still, setStill] = useState(false);
  const waves = shared;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (still) return;
    users += 1;
    if (AppState.currentState === "active") start();
    return () => {
      users -= 1;
      if (users <= 0) {
        users = 0;
        stop();
      }
    };
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
      {/* الحلقةُ الساكنة تبقى تحت النبض وبعده: «فيها ما لم تره» لا يذهب بوقوف الحركة. */}
      <View style={ring} />
      {still ? null : (
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
