import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Text } from "./type";
import { AthrMark } from "./brand";

/**
 * شاشة الدخول: المدار والخط الحيّ (القاعدة ٩).
 *
 * أرضيّةُ شاشة الإطلاق نفسها، والشعارُ في مداره ورسومُ قوس النشر الستّ
 * تدور حوله، وتحته شريطٌ من خطٍّ زمنيٍّ متخيَّل يمرّ — فيرى الزائرُ ما
 * يفعله التطبيق قبل أن يدخل. وألوانُها ثابتةٌ لا تتبع ثيماً: لا ثيمَ قبل
 * الدخول.
 *
 * وكلُّ حركةٍ هنا تدويرٌ أو إزاحةٌ أو تكبير على المحرّك الأصليّ، ولا يُعاد
 * رسمُ شيءٍ منها مع React (القاعدة ٣٥٦). ومن طلب «قلّل الحركة» يرى كلَّ
 * شيءٍ في مكانه ساكناً.
 */

export const SCENE_GROUND = "#09151c";

/* منحنى قوس النشر نفسه: يتجاوز قليلاً ثمّ يستقرّ. */
const OUT = Easing.bezier(0.2, 0.9, 0.3, 1.15);
const RISE = Easing.bezier(0.2, 0.8, 0.2, 1);

export function useStill(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => undefined);
  }, []);
  return still;
}

/** الأرضيّة: تدرّجٌ دائريّ من أعلاها ونجومٌ خافتة — شاشةُ الإطلاق بعينها. */
export function SceneGround() {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        x: ((i * 37) % 100) / 100,
        y: (((i * 53) % 60) + 4) / 100,
        o: 0.18 + ((i * 7) % 5) * 0.08,
        r: i % 4 === 0 ? 1.4 : 1,
      })),
    [],
  );
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: SCENE_GROUND }}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="sceneGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#1a3742" />
            <Stop offset="0.45" stopColor="#0d1c25" />
            <Stop offset="1" stopColor={SCENE_GROUND} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height * 0.2} rx={width * 1.2} ry={height * 0.7} fill="url(#sceneGlow)" />
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x * width} cy={s.y * height} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}
      </Svg>
    </View>
  );
}

const SATS = [
  require("../assets/launch/write.png"),
  require("../assets/launch/photo.png"),
  require("../assets/launch/music.png"),
  require("../assets/launch/place.png"),
  require("../assets/launch/sleep.png"),
  require("../assets/launch/morning.png"),
];

const RADIUS = 76;
/* رسومُ الإطلاق في لوحة ٨٨ وحولها هامشٌ شفّاف: ٤٦ هنا تُرى بحجم قرصٍ صغير. */
const SAT = 46;
const MARK = 58;
/** مربّعُ المدار: قطرُه وقرصُ رسمٍ على كلّ طرف. */
export const ORBIT_BOX = RADIUS * 2 + SAT + 8;

/**
 * المدار: الشعار في مركزه، والرسومُ الستّ على دائرةٍ تدور دورةً كلّ ٢٦
 * ثانية، وكلُّ رسمٍ يدور عكسها فيبقى قائماً. وعند الفتح الأوّل تخرج من
 * المركز متتابعةً كقوس الزائد.
 */
export function Orbit({ enter }: { enter: boolean }) {
  const still = useStill();
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(enter ? 0 : 1)).current;
  const spread = useRef(SATS.map(() => new Animated.Value(enter ? 0 : 1))).current;

  useEffect(() => {
    if (still) {
      mark.setValue(1);
      spread.forEach((v) => v.setValue(1));
      return;
    }
    Animated.parallel([
      Animated.timing(mark, { toValue: 1, duration: 1000, easing: OUT, useNativeDriver: true }),
      ...spread.map((v, i) =>
        Animated.timing(v, { toValue: 1, duration: 1200, delay: 250 + i * 90, easing: OUT, useNativeDriver: true }),
      ),
    ]).start();
    const turn = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true }),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    turn.start();
    glow.start();
    return () => {
      turn.stop();
      glow.stop();
    };
  }, [still, spin, breathe, mark, spread]);

  const turn = useMemo(() => spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }), [spin]);
  const back = useMemo(() => spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] }), [spin]);
  const haloScale = useMemo(() => breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }), [breathe]);
  const haloFade = useMemo(() => breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }), [breathe]);
  const markScale = useMemo(() => mark.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), [mark]);
  const markTurn = useMemo(() => mark.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "0deg"] }), [mark]);
  const lifts = useMemo(() => spread.map((v) => v.interpolate({ inputRange: [0, 1], outputRange: [0, -RADIUS] })), [spread]);
  const sizes = useMemo(() => spread.map((v) => v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] })), [spread]);

  const c = ORBIT_BOX / 2;
  return (
    <View pointerEvents="none" style={{ width: ORBIT_BOX, height: ORBIT_BOX }}>
      {/* الهالة: كهرمانٌ يتنفّس خلف الشعار. */}
      <Animated.View
        style={{
          position: "absolute",
          left: c - 60,
          top: c - 60,
          width: 120,
          height: 120,
          opacity: haloFade,
          transform: [{ scale: haloScale }],
        }}
      >
        <Svg width={120} height={120}>
          <Defs>
            <RadialGradient id="orbitHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#F6B93B" stopOpacity={0.3} />
              <Stop offset="0.65" stopColor="#F6B93B" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={60} cy={60} r={60} fill="url(#orbitHalo)" />
        </Svg>
      </Animated.View>

      {/* المسار: دائرةٌ منقّطة يمشي عليها الرسم. */}
      <View
        style={{
          position: "absolute",
          left: c - RADIUS,
          top: c - RADIUS,
          width: RADIUS * 2,
          height: RADIUS * 2,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "rgba(255,255,255,0.14)",
        }}
      />

      <Animated.View style={{ position: "absolute", left: c, top: c, width: 0, height: 0, transform: [{ rotate: turn }] }}>
        {SATS.map((source, i) => {
          const angle = `${i * 60}deg`;
          const counter = `${-i * 60}deg`;
          return (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                left: -SAT / 2,
                top: -SAT / 2,
                width: SAT,
                height: SAT,
                opacity: spread[i],
                transform: [{ rotate: angle }, { translateY: lifts[i] }, { rotate: counter }, { scale: sizes[i] }],
              }}
            >
              <Animated.Image source={source} style={{ width: SAT, height: SAT, transform: [{ rotate: back }] }} resizeMode="contain" />
            </Animated.View>
          );
        })}
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          left: c - MARK / 2,
          top: c - MARK / 2,
          opacity: mark,
          transform: [{ scale: markScale }, { rotate: markTurn }],
        }}
      >
        <AthrMark size={MARK} />
      </Animated.View>
    </View>
  );
}

const PAPER = "#FDFCF8";
const INK = "#0E1A24";

type Row =
  | { kind: "card"; initial: string; tint: string; who: string; text?: string; photo?: boolean; react?: number }
  | { kind: "event"; icon: number; name: string; what: string };

const REACT = [
  require("../assets/reactions/love.png"),
  require("../assets/reactions/laugh.png"),
  require("../assets/reactions/smile.png"),
];

/* مثالٌ مكتوب لا حساباتٌ حقيقية: لا يُعرض حسابُ أحدٍ لمن لم يدخل. */
const ROWS: Row[] = [
  { kind: "card", initial: "ن", tint: "#c0785a", who: "نورة · ٩:١٥ ص", text: "قهوة الصباح قبل الدوام، والجو أخيراً بارد", react: 0 },
  { kind: "event", icon: require("../assets/launch/place.png"), name: "خالد", what: "وصل إلى جدة" },
  { kind: "card", initial: "س", tint: "#5a7fa8", who: "سارة · مع ريم", photo: true, react: 1 },
  { kind: "event", icon: require("../assets/launch/music.png"), name: "فيصل", what: "يسمع أغنية الآن" },
  { kind: "event", icon: require("../assets/launch/morning.png"), name: "ريم", what: "صحت ٦:٣٠ ص" },
  { kind: "card", initial: "م", tint: "#6a8a6a", who: "محمد · في مقهى الحيّ", text: "أوّل مرّة أجرّب هالمكان، يستاهل", react: 2 },
  { kind: "event", icon: require("../assets/launch/sleep.png"), name: "نايف", what: "نام" },
];

const AV = 36;
const SIDE = 16;
const SPEED = 20; // بكسل في الثانية

/** وجهُ تفاعلٍ يقفز على البطاقة ثمّ يطير ويذوب، كلَّ ستّ ثوانٍ. */
function Pop({ source, delay, still }: { source: number; delay: number; still: boolean }) {
  const t = useRef(new Animated.Value(still ? 0.5 : 0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(1800 - Math.min(delay, 1800)),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay, still]);
  const opacity = t.interpolate({ inputRange: [0, 0.08, 0.15, 0.8, 1], outputRange: [0, 0, 1, 1, 0] });
  const scale = t.interpolate({ inputRange: [0, 0.08, 0.2, 0.3, 1], outputRange: [0, 0, 1.25, 1, 0.8] });
  const lift = t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [6, 0, -22] });
  return (
    <Animated.Image
      source={source}
      style={{ position: "absolute", left: -6, bottom: -10, width: 28, height: 28, opacity, transform: [{ translateY: lift }, { scale }] }}
    />
  );
}

const FADE = 48;

/**
 * سطرٌ يذوب عند طرفي الشريط بشفافيّته هو، محسوبةً من موضعه على الخيط
 * الأصليّ: تدرّجٌ بلون الأرضيّة فوقه كان يُرى شريطاً أغمق، فالأرضيّةُ
 * دائريّةُ التدرّج ولا لونَ واحداً لها هناك.
 */
function Faded({ shift, top, box, children }: { shift: Animated.Value; top: number; box: number; children: React.ReactNode }) {
  const [h, setH] = useState(0);
  const opacity = useMemo(() => {
    if (box <= 0 || h <= 0) return 0;
    const mid = Animated.add(shift, top + h / 2);
    return mid.interpolate({
      inputRange: [0, FADE, Math.max(FADE + 1, box - FADE), Math.max(FADE + 2, box)],
      outputRange: [0, 1, 1, 0],
      extrapolate: "clamp",
    });
  }, [shift, top, box, h]);
  return (
    <Animated.View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={{ opacity }}>
      {children}
    </Animated.View>
  );
}

function Rows({
  still,
  shift,
  box,
  offset,
  onHeight,
}: {
  still: boolean;
  shift: Animated.Value;
  box: number;
  offset: number;
  onHeight?: (h: number) => void;
}) {
  const [tops, setTops] = useState<number[]>([]);
  return (
    <View
      onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}
      style={{ paddingHorizontal: SIDE, gap: 12, paddingBottom: 12 }}
    >
      {ROWS.map((row, i) => (
        <View
          key={i}
          onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setTops((was) => (was[i] === y ? was : Object.assign([...was], { [i]: y })));
          }}
        >
          <Faded shift={shift} top={offset + (tops[i] ?? 0)} box={box}>
            {rowOf(row, still)}
          </Faded>
        </View>
      ))}
    </View>
  );
}

function rowOf(row: Row, still: boolean) {
  return row.kind === "card" ? (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <View
              style={{
                width: AV,
                height: AV,
                borderRadius: AV / 2,
                backgroundColor: row.tint,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: "#0d1c25",
              }}
            >
              <Text face="display" style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
                {row.initial}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, backgroundColor: PAPER, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: INK }}>{row.who}</Text>
              {row.text ? <Text style={{ fontSize: 12.5, lineHeight: 20, color: "#33414c" }}>{row.text}</Text> : null}
              {row.photo ? (
                <LinearGradient
                  colors={["#f3c27a", "#e07d5a", "#6b4c7a"]}
                  locations={[0, 0.6, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ height: 70, borderRadius: 10, marginTop: 6 }}
                />
              ) : null}
              {row.react !== undefined ? <Pop source={REACT[row.react]} delay={400 + row.react * 1800} still={still} /> : null}
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Image source={row.icon} style={{ width: AV, height: AV }} resizeMode="contain" />
            <Text style={{ fontSize: 12.5, color: "#e6ecf0" }}>
              <Text style={{ fontWeight: "700", color: "#fff" }}>{row.name}</Text> {row.what}
            </Text>
          </View>
        );
}

/**
 * الخط الحيّ: الأسطرُ مرسومةٌ مرّتين وتصعد بطول نسخةٍ واحدة ثمّ تعود بلا
 * أثر، فلا نهايةَ لها. والخيطُ على محور الصور (القاعدة ٣٣٢)، والطرفان
 * يذوبان (`Faded`). وما دون ١٢٠ لا يُرسم: شريحةٌ من بطاقةٍ لا تُقرأ.
 */
export function LiveStrip({ enter }: { enter: boolean }) {
  const still = useStill();
  const [box, setBox] = useState(0);
  const [height, setHeight] = useState(0);
  const shift = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(enter ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 900, delay: enter ? 700 : 0, easing: RISE, useNativeDriver: true }).start();
  }, [fade, enter]);

  useEffect(() => {
    if (still || height <= 0) return;
    shift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shift, { toValue: -height, duration: (height / SPEED) * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [still, height, shift]);

  const show = box >= 120;
  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e) => setBox(e.nativeEvent.layout.height)}
      style={{ flex: 1, overflow: "hidden", opacity: fade }}
    >
      {show ? (
        <>
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0)"]}
            locations={[0, 0.2, 0.8, 1]}
            style={{ position: "absolute", top: 0, bottom: 0, right: SIDE + AV / 2 - 1, width: 2 }}
          />
          <Animated.View style={{ transform: [{ translateY: shift }] }}>
            <Rows still={still} shift={shift} box={box} offset={0} onHeight={setHeight} />
            <Rows still={still} shift={shift} box={box} offset={height} />
          </Animated.View>
        </>
      ) : null}
    </Animated.View>
  );
}

/** لوحُ الدخول: زجاجٌ على آبل، وأرضيّةٌ داكنةٌ نصفُ شفّافة على أندرويد. */
export function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 26,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
        backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.06)" : "rgba(20,36,46,0.92)",
      }}
    >
      {Platform.OS === "ios" ? (
        <BlurView intensity={40} tint="systemUltraThinMaterialDark" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
      ) : null}
      <View style={{ padding: 14 }}>{children}</View>
    </View>
  );
}
