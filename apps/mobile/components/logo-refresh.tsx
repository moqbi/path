import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  RefreshControl,
  View,
} from "react-native";
import { AthrMark } from "./brand";
import { DEV_FEATURES } from "../lib/dev-features";
import { colors } from "../theme/tokens";

/**
 * مؤشّرُ التحديث شعارُ التطبيق لا دوّارةُ النظام (القاعدة ٣٢١) — **بقرار المالك**:
 * العلامةُ تتنفّس في وسطها، وقوسٌ باللمسة يدور حولها ما دام الجلبُ جارياً.
 * ومن طلب «قلّل الحركة» يرى العلامةَ ساكنةً وقوسَها ثابتاً.
 * `size` قطرُ القوس، والعلامةُ نحو ثلثيه.
 */
export function LogoRefresh({
  size = 32,
  color = colors.clay,
  active = true,
}: {
  size?: number;
  color?: string;
  /**
   * يدور ما دام الجلبُ جارياً وحده. طبقةُ السحب مركّبةٌ في ستّ شاشاتٍ وتبويباتُها
   * كلُّها حيّة، وكانت حلقتاها تدوران وهي شفّافةٌ لا تُرى — اثنتا عشرة حركةً بلا
   * توقّفٍ تُسخّن الجوّال.
   */
  active?: boolean;
}) {
  const [still, setStill] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (still || !active) return;
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
  }, [still, active]);

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

/** كم يُسحب فوق أعلى القائمة حتى يُحدَّث — قريبٌ ممّا تطلبه دوّارةُ آبل. */
const TRIGGER = 72;

/**
 * السحبُ للتحديث بالشعار لا بدوّارة النظام (القاعدة ٣٢١). كانت الدوّارةُ شفّافةً
 * والشعارُ في رأس القائمة، فبقيت دوّارةُ آبل تُرى في أعلاها والشعارُ تحتها لحظةً.
 * فلا `RefreshControl` هنا أصلاً: إفلاتُ السحبة بعد `TRIGGER` يُحدّث، والشعارُ
 * طبقةٌ فوق أعلى القائمة يظهر مع الإصبع ويبقى ما دام الجلب. وبلا `LOGO_PULL`
 * تعود الدوّارةُ كما كانت.
 * `y` قيمةُ تمرير القائمة إن كانت لها (`useStretch`)، وإلّا يُنشأ لها مقياس.
 */
export function usePullLogo({
  refreshing,
  onRefresh,
  tint,
  y,
  top = 10,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  tint: string;
  y?: Animated.Value;
  top?: number;
}) {
  const own = useRef(new Animated.Value(0)).current;
  const value = y ?? own;
  if (!LOGO_PULL) {
    return {
      props: { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} /> },
      overlay: null,
    };
  }
  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!refreshing && event.nativeEvent.contentOffset.y < -TRIGGER) onRefresh();
  };
  return {
    props: y
      ? { onScrollEndDrag }
      : {
          onScrollEndDrag,
          onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: own } } }], { useNativeDriver: false }),
          scrollEventThrottle: 16,
        },
    overlay: (
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 30,
          opacity: refreshing ? 1 : value.interpolate({ inputRange: [-TRIGGER, -8], outputRange: [1, 0], extrapolate: "clamp" }),
          transform: [
            { translateY: refreshing ? 0 : value.interpolate({ inputRange: [-TRIGGER, 0], outputRange: [0, -18], extrapolate: "clamp" }) },
            { scale: refreshing ? 1 : value.interpolate({ inputRange: [-TRIGGER, -8], outputRange: [1, 0.6], extrapolate: "clamp" }) },
          ],
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(14,26,36,.55)",
          }}
        >
          {/* يدور مع الإصبع وهو يسحب — كان ساكناً حتى يُفلت (القاعدة ٣٤٢). */}
          <Animated.View
            style={{
              transform: [
                { rotate: refreshing ? "0deg" : value.interpolate({ inputRange: [-160, 0], outputRange: ["320deg", "0deg"], extrapolate: "clamp" }) },
              ],
            }}
          >
            <LogoRefresh size={34} active={refreshing} />
          </Animated.View>
        </View>
      </Animated.View>
    ),
  };
}
