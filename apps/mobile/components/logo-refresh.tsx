import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, View } from "react-native";
import { AthrMark } from "./brand";
import { DEV_FEATURES } from "../lib/dev-features";
import { colors } from "../theme/tokens";

/**
 * مؤشّرُ التحديث شعارُ التطبيق لا دوّارةُ النظام (القاعدة ٣٢١) — **بقرار المالك**:
 * العلامةُ تتنفّس في وسطها، وقوسٌ باللمسة يدور حولها ما دام الجلبُ جارياً.
 * ومن طلب «قلّل الحركة» يرى العلامةَ ساكنةً وقوسَها ثابتاً.
 * `size` قطرُ القوس، والعلامةُ نحو ثلثيه.
 */
export function LogoRefresh({ size = 32, color = colors.clay }: { size?: number; color?: string }) {
  const [still, setStill] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (still) return;
    const spin = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    spin.start();
    pulse.start();
    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [still]);

  const mark = Math.round(size * 0.64);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="يتم التحديث"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(1.5, size / 16),
          borderColor: "transparent",
          borderTopColor: color,
          borderRightColor: color,
          transform: still ? [] : [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
        }}
      />
      <Animated.View
        style={{
          opacity: still ? 1 : breath.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
          transform: still ? [] : [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.04] }) }],
        }}
      >
        <AthrMark size={mark} />
      </Animated.View>
    </View>
  );
}

/** الشعارُ مكانَ دوّارة `RefreshControl` — على آبل في نسخة التطوير وحدها (القاعدة ٢٩١). */
export const LOGO_PULL = DEV_FEATURES && Platform.OS === "ios";

/** لونُ دوّارة النظام: شفّافةٌ حين يرسم الشعارُ مكانها. */
export function pullTint(fallback: string): string {
  return LOGO_PULL ? "transparent" : fallback;
}

/**
 * الشعارُ في الفراغ الذي يفتحه السحب فوق القائمة: يُركَّب أوّلَ رأس القائمة
 * بإزاحةٍ سالبة، فآبل تُبقي ذلك الفراغَ ظاهراً ما دام التحديث جارياً.
 */
export function PullLogo({ refreshing }: { refreshing: boolean }) {
  if (!LOGO_PULL || !refreshing) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: -52, left: 0, right: 0, height: 44, alignItems: "center", justifyContent: "center", zIndex: 20 }}
    >
      <LogoRefresh size={34} />
    </View>
  );
}
