import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, View, PanResponder, type GestureResponderEvent } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { AvailableLenses } from "expo-camera";
import { Text } from "./type";
import { ar } from "../lib/format";

/**
 * أدوات الكاميرا المدمجة (القاعدة ٤٨٨) — للحظة والقصّة معاً، فلا تختلف كاميرا عن كاميرا:
 *
 * - **العدسات**: «٠٫٥» العدسةُ فائقة الاتّساع الحقيقيّة لا تقريبٌ رقميّ (`selectedLens`)، و«١×»
 *   الافتراضيّةُ، و«٢×» تقريبٌ عليها — وعلى آيفون بثلاث عدسات تنتقل إلى المقرِّبة بنفسها.
 * - **التقريب بإصبعين** من حيث كان، والرقمُ فوق الغالق.
 * - **ضغطةٌ تُعيد التركيز** (`autofocus` «on» لحظةً ثمّ «off» المستمرّ) ومربّعٌ حيث ضُغط،
 *   **وضغطتان تبدّلان الكاميرا** كما في كاميرا الجوّال.
 * - **الشبكة** (الأثلاث) تُفتح وتُغلق.
 *
 * وما لا تفتحه expo-camera بلا بناء: نقطةُ التركيز بعينها، والإضاءة، والبورتريه.
 */
export type Facing = "back" | "front";

const ULTRA = "AVCaptureDeviceTypeBuiltInUltraWideCamera";
const DOUBLE_MS = 280;

export function useCameraTools(facing: Facing, onFlip: () => void) {
  const [zoom, setZoom] = useState(0);
  const [lens, setLens] = useState<string | undefined>(undefined);
  const [hasUltra, setHasUltra] = useState(false);
  const [autofocus, setAutofocus] = useState<"on" | "off">("off");
  const [focus, setFocus] = useState<{ x: number; y: number; key: number } | null>(null);
  const [grid, setGrid] = useState(false);

  const zoomNow = useRef(0);
  zoomNow.current = zoom;
  const flip = useRef(onFlip);
  flip.current = onFlip;
  const refocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const touch = useRef({ x: 0, y: 0, at: 0, pinched: false });
  const pinch = useRef({ from: 0, base: 0 });

  // الكاميرا الأماميّة عدسةٌ واحدة: تبديلُ الجهة يُعيد كلَّ شيء إلى أصله.
  useEffect(() => {
    setLens(undefined);
    setZoom(0);
  }, [facing]);

  useEffect(() => () => {
    if (refocusTimer.current) clearTimeout(refocusTimer.current);
  }, []);

  function refocus(x: number, y: number) {
    setFocus({ x, y, key: Date.now() });
    setAutofocus("on");
    if (refocusTimer.current) clearTimeout(refocusTimer.current);
    refocusTimer.current = setTimeout(() => setAutofocus("off"), 1200);
  }

  const spread = (event: GestureResponderEvent) => {
    const [a, b] = event.nativeEvent.touches;
    return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
  };

  const gestures = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        touch.current = { x: locationX, y: locationY, at: Date.now(), pinched: false };
        pinch.current = { from: spread(event), base: zoomNow.current };
      },
      onPanResponderMove: (event) => {
        const now = spread(event);
        if (!now) return;
        touch.current.pinched = true;
        if (!pinch.current.from) {
          pinch.current = { from: now, base: zoomNow.current };
          return;
        }
        // ضِعفُ المسافة بين الإصبعين ≈ نصفُ مدى التقريب: سريعٌ بلا أن يقفز.
        const next = pinch.current.base + (now / pinch.current.from - 1) * 0.5;
        setZoom(Math.min(1, Math.max(0, next)));
      },
      onPanResponderRelease: (_event, gesture) => {
        pinch.current.from = 0;
        const t = touch.current;
        const tap = !t.pinched && Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10 && Date.now() - t.at < 350;
        if (!tap) return;
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_MS) {
          lastTap.current = 0;
          flip.current();
          return;
        }
        lastTap.current = now;
        refocus(t.x, t.y);
      },
      onPanResponderTerminate: () => {
        pinch.current.from = 0;
      },
    }),
  ).current;

  function onLenses(event: AvailableLenses) {
    if (facing !== "back") return;
    setHasUltra(event.lenses.some((one) => one.deviceType === ULTRA));
  }

  /* «٠٫٥» تبدّل العدسة، والبقيّة تقريبٌ على الافتراضيّة. */
  const steps = [
    ...(Platform.OS === "ios" && facing === "back" && hasUltra ? [{ label: "٠٫٥", lens: ULTRA, zoom: 0 }] : []),
    { label: "١×", lens: undefined, zoom: 0 },
    ...(facing === "back" ? [{ label: "٢×", lens: undefined, zoom: 0.25 }] : []),
  ];
  const current = steps.find((one) => one.lens === lens && Math.abs(one.zoom - zoom) < 0.02);

  return {
    cameraProps: {
      zoom,
      autofocus,
      selectedLens: lens,
      onAvailableLensesChanged: onLenses,
      mirror: facing === "front",
      videoStabilizationMode: "auto" as const,
    },
    gestures,
    focus,
    grid,
    toggleGrid: () => setGrid((one) => !one),
    chips: {
      steps,
      current,
      zoom,
      lens,
      pick: (step: { lens?: string; zoom: number }) => {
        setLens(step.lens);
        setZoom(step.zoom);
      },
      reset: () => {
        setLens(undefined);
        setZoom(0);
      },
    },
  };
}

type Chips = ReturnType<typeof useCameraTools>["chips"];

export function LensChips({ chips }: { chips: Chips }) {
  const custom = !chips.current;
  const factor = (chips.lens === ULTRA ? 0.5 : 1) * (1 + chips.zoom * 4);
  return (
    <View style={{ flexDirection: "row", alignSelf: "center", gap: 6, padding: 4, borderRadius: 24, backgroundColor: "rgba(0,0,0,.35)" }}>
      {chips.steps.map((step) => {
        const on = chips.current === step;
        return (
          <Pressable
            key={step.label}
            onPress={() => chips.pick(step)}
            hitSlop={6}
            style={{
              minWidth: 38,
              height: 38,
              paddingHorizontal: 8,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? "rgba(255,255,255,.92)" : "transparent",
            }}
          >
            <Text style={{ color: on ? "#000" : "#fff", fontSize: on ? 13 : 12, fontWeight: "700" }}>{step.label}</Text>
          </Pressable>
        );
      })}
      {custom ? (
        <Pressable
          onPress={chips.reset}
          style={{ height: 38, paddingHorizontal: 12, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.92)" }}
        >
          <Text style={{ color: "#000", fontSize: 12.5, fontWeight: "700" }}>{ar(Math.round(factor * 10) / 10)}×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** مربّعُ التركيز: يظهر حيث ضُغط، ينكمش قليلاً، ثمّ يبهت. */
export function FocusMark({ focus }: { focus: { x: number; y: number; key: number } | null }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!focus) return;
    scale.setValue(1.35);
    opacity.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
      Animated.delay(500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [focus, opacity, scale]);
  if (!focus) return null;
  const size = 72;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: focus.x - size / 2,
        top: focus.y - size / 2,
        width: size,
        height: size,
        borderWidth: 1.5,
        borderColor: "#F6B93B",
        borderRadius: 4,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/** الأثلاث: خطّان في كلّ اتّجاه. */
export function GridLines({ on }: { on: boolean }) {
  if (!on) return null;
  const line = { position: "absolute" as const, backgroundColor: "rgba(255,255,255,.35)" };
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <View style={[line, { left: "33.333%", top: 0, bottom: 0, width: 1 }]} />
      <View style={[line, { left: "66.666%", top: 0, bottom: 0, width: 1 }]} />
      <View style={[line, { top: "33.333%", left: 0, right: 0, height: 1 }]} />
      <View style={[line, { top: "66.666%", left: 0, right: 0, height: 1 }]} />
    </View>
  );
}

export function GridMark({ on }: { on: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={3.5} width={17} height={17} rx={2.5} stroke="#fff" strokeWidth={1.7} fill={on ? "rgba(255,255,255,.25)" : "none"} />
      <Path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" stroke="#fff" strokeWidth={1.3} />
    </Svg>
  );
}
