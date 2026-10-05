import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * شاشةُ الانطلاق المتحرّكة — رسمُ المالك (`athar-launch-screen`) حرفاً بحرف.
 *
 * شاشةُ النظام صورةٌ ثابتة لا تتحرّك، فالحركةُ تُرسم هنا فوقها مباشرةً:
 * الشعارُ يكبر، والهالةُ تنفتح، ورسومُ قوس النشر الستّة تصل حوله وتدور
 * دورةً ثمّ تُطوى فيه، ثمّ يتّسع الشعار ويذوب ويظهر التطبيق تحته.
 *
 * **مرّةً لكل إقلاع** لا لكل عودة: من رجع إلى تطبيقٍ ما زال في الذاكرة
 * يُكمل من حيث ترك، ومن غاب حتى أغلقه النظام يُقلع من جديد فيراها — وهو
 * سلوكُ شاشة النظام قبلها. ومن طلب «قلّل الحركة» لا يراها (القاعدة ٣٦).
 */
let played = false;

export function useLaunch() {
  const [on, setOn] = useState(!played);
  played = true;
  return [on, () => setOn(false)] as const;
}

const ICONS = [
  require("../assets/launch/photo.png"),
  require("../assets/launch/write.png"),
  require("../assets/launch/music.png"),
  require("../assets/launch/place.png"),
  require("../assets/launch/morning.png"),
  require("../assets/launch/sleep.png"),
];
const MARK_RATIO = 905 / 1203;

/*
  الظلالُ مرسومةٌ في الصور نفسها بهامشٍ حولها (`drop-shadow` في الرسم الأصليّ):
  ظلُّ آبل على صورةٍ يُقصّ عند حدودها، فكان وهجُ الشعار ينقطع بخطٍّ مستقيم من
  أسفله ويساره. والهامشُ متناظر فالمركزُ لا يتحرّك.
  الشعارُ ٨٨٣×٥٨٥ داخل لوحةٍ ١٢٠٣×٩٠٥، والأيقونةُ ٨٨ داخل ١٣٦.
*/
const MARK_PAD = 1203 / 883;
const ICON_PAD = 136 / 88;

const T = {
  logoIn: 250,
  haloIn: 1200,
  iconIn: 1080,
  iconStep: 80,
  orbit: 1820,
  collapse: 2880,
  spark1: 1720,
  spark2: 1860,
  finish: 3320,
  done: 3800,
};

const ease = {
  logo: Easing.bezier(0.16, 0.9, 0.25, 1.14),
  icon: Easing.bezier(0.16, 0.84, 0.24, 1.12),
  orbit: Easing.bezier(0.35, 0.05, 0.15, 1),
  collapse: Easing.bezier(0.55, 0, 1, 0.42),
  finish: Easing.bezier(0.45, 0, 0.85, 0.38),
};

function run(value: Animated.Value, delay: number, duration: number, easing: (t: number) => number) {
  return Animated.timing(value, { toValue: 1, delay, duration, easing, useNativeDriver: true });
}

export function Launch({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const short = height <= 650;
  const logoW = short ? Math.min(width * 0.52, 210) : Math.min(width * 0.62, 255);
  const iconSize = short ? 44 : 66;
  const radius = short ? 112 : 137;

  const logo = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const arrive = useRef(ICONS.map(() => new Animated.Value(0))).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const collapse = useRef(new Animated.Value(0)).current;
  const spark1 = useRef(new Animated.Value(0)).current;
  const spark2 = useRef(new Animated.Value(0)).current;
  const finish = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced && alive) onDone();
      })
      .catch(() => {});

    Animated.parallel([
      run(logo, T.logoIn, 840, ease.logo),
      run(halo, T.haloIn, 520, Easing.out(Easing.ease)),
      ...arrive.map((v, i) => run(v, T.iconIn + i * T.iconStep, 520, ease.icon)),
      run(orbit, T.orbit, 1050, ease.orbit),
      run(collapse, T.collapse, 440, ease.collapse),
      run(spark1, T.spark1, 400, Easing.out(Easing.ease)),
      run(spark2, T.spark2, 400, Easing.out(Easing.ease)),
      run(finish, T.finish, 440, ease.finish),
      run(fade, T.finish + 150, 300, Easing.in(Easing.ease)),
    ]).start();
    const timer = setTimeout(() => alive && onDone(), T.done);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // الشعار: يكبر من ٠٫٥٤ إلى ١، ثمّ في الخروج إلى ١٫٢٨ فـ١٫٦٢ ويذوب.
  const logoScale = Animated.multiply(
    logo.interpolate({ inputRange: [0, 1], outputRange: [0.54, 1] }),
    finish.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1.28, 1.62] }),
  );
  const logoOpacity = Animated.multiply(
    logo.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
    finish.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] }),
  );

  const haloOpacity = Animated.multiply(
    halo,
    finish.interpolate({ inputRange: [0, 0.95, 1], outputRange: [1, 0, 0] }),
  );
  const haloScale = Animated.add(
    halo.interpolate({ inputRange: [0, 1], outputRange: [0.76, 1] }),
    finish.interpolate({ inputRange: [0, 0.95, 1], outputRange: [0, 0.25, 0.25] }),
  );

  const sparkStyle = (v: Animated.Value) => ({
    opacity: Animated.multiply(
      v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0.8] }),
      finish.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0, 0] }),
    ),
    transform: [{ scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.35, 1] }) }],
  });

  const ring = 222 * 2 + 2;

  return (
    // تحجب اللمس ما دامت ظاهرة: ضغطةٌ عمياء على شاشةٍ لا تُرى تفتح ما لم يُقصد.
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      {/* الأرضية: تدرّجٌ دائريّ مركزُه فوق الوسط قليلاً، وتعتيمٌ في الأطراف. */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient id="ground" cx="50%" cy="44%" rx="70%" ry="70%" fx="50%" fy="44%">
            <Stop offset="0" stopColor="#1a3742" />
            <Stop offset="0.55" stopColor="#0d1c25" />
            <Stop offset="1" stopColor="#09151c" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#ground)" />
      </Svg>

      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        {/* الهالة: حلقةٌ رقيقة وحولها حلقتان باهتتان. */}
        <Animated.View style={{ position: "absolute", opacity: haloOpacity, transform: [{ scale: haloScale }] }}>
          <Svg width={ring} height={ring}>
            <Circle cx={ring / 2} cy={ring / 2} r={203} stroke="#dbeef0" strokeOpacity={0.02} strokeWidth={38} fill="none" />
            <Circle cx={ring / 2} cy={ring / 2} r={165} stroke="#dbeef0" strokeOpacity={0.05} strokeWidth={38} fill="none" />
            <Circle cx={ring / 2} cy={ring / 2} r={146} stroke="#dbeef0" strokeOpacity={0.07} strokeWidth={1} fill="none" />
          </Svg>
        </Animated.View>

        {/* رسومُ قوس النشر: تصل في مداراتها، تدور دورةً، ثمّ تُطوى في الشعار. */}
        {ICONS.map((source, i) => {
          const base = i * 60;
          const rotate = Animated.add(
            orbit.interpolate({ inputRange: [0, 1], outputRange: [base, base + 360] }),
            collapse.interpolate({ inputRange: [0, 1], outputRange: [0, 130] }),
          ).interpolate({ inputRange: [0, 1000], outputRange: ["0deg", "1000deg"] });
          const lift = collapse.interpolate({ inputRange: [0, 1], outputRange: [-radius, -4] });
          const scale = Animated.multiply(
            arrive[i].interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.16, 1.13, 1] }),
            collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.13] }),
          );
          const opacity = Animated.multiply(
            arrive[i].interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 1] }),
            collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          );
          return (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                width: iconSize * ICON_PAD,
                height: iconSize * ICON_PAD,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ rotate }],
              }}
            >
              <Animated.Image
                source={source}
                resizeMode="contain"
                style={{
                  width: iconSize * ICON_PAD,
                  height: iconSize * ICON_PAD,
                  opacity,
                  transform: [{ translateY: lift }, { scale }],
                }}
              />
            </Animated.View>
          );
        })}

        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Image
            source={require("../assets/launch/mark.png")}
            style={{ width: logoW * MARK_PAD, height: logoW * MARK_PAD * MARK_RATIO }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Animated.View style={[{ position: "absolute", left: "17%", top: "35%" }, sparkStyle(spark1)]}>
        <Spark />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", right: "17%", bottom: "35%" }, sparkStyle(spark2)]}>
        <Spark />
      </Animated.View>

      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="50%" r="72%">
            <Stop offset="0.42" stopColor="#061016" stopOpacity="0" />
            <Stop offset="1" stopColor="#061016" stopOpacity="0.4" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#vignette)" />
      </Svg>
    </Animated.View>
  );
}

/** نجمةٌ رباعيّة (✦) — رسمٌ لا حرف، فلا تتبع خطّاً قد لا يحملها. */
function Spark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M12 0C12.9 7.2 16.8 11.1 24 12C16.8 12.9 12.9 16.8 12 24C11.1 16.8 7.2 12.9 0 12C7.2 11.1 11.1 7.2 12 0Z" fill="#ffd166" />
    </Svg>
  );
}
