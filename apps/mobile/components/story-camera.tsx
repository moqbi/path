import { Spinner } from "./spinner";
import { useEffect, useRef, useState } from "react";
import { View, Pressable, PanResponder, Platform, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { BlurView } from "expo-blur";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Text } from "./type";
import { CloseIcon } from "./icons";
import type { Shot } from "../lib/capture";
import { ar } from "../lib/format";
import { colors } from "../theme/tokens";

/**
 * كاميرا القصّة (القاعدة ٢٧٠) — **بقرار المالك**: شاشةُ القصّة تفتح عليها مباشرةً،
 * لا نافذةُ «من أين؟» ثمّ كاميرا ثمّ معاينةٌ ثمّ محرّر. وفي أسفلها شريطٌ زجاجيّ
 * يختار «صورة» أو «فيديو»، وبجانب الغالق المعرضُ والتبديل. واللقطةُ تذهب إلى
 * المحرّر في الشاشة نفسها — فالمعاينةُ هي المحرّر (القاعدة ٩٦).
 */
export function StoryCamera({
  limit,
  onShot,
  onLibrary,
  onClose,
}: {
  limit: number;
  onShot: (shot: Shot) => void;
  onLibrary: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, askCamera] = useCameraPermissions();
  const [mic, askMic] = useMicrophonePermissions();
  const camera = useRef<CameraView | null>(null);
  const [mode, setMode] = useState<"picture" | "video">("picture");
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"auto" | "on" | "off">("auto");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // التقريبُ بإصبعين — كالكاميرا المدمجة (القاعدة ١٥٣).
  const [zoom, setZoom] = useState(0);
  const zoomNow = useRef(0);
  zoomNow.current = zoom;
  const pinch = useRef({ from: 0, base: 0 });
  const spread = (event: GestureResponderEvent) => {
    const [a, b] = event.nativeEvent.touches;
    return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
  };
  const pincher = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length === 2,
      onPanResponderGrant: (event) => {
        pinch.current = { from: spread(event), base: zoomNow.current };
      },
      onPanResponderMove: (event) => {
        const now = spread(event);
        if (!now) return;
        if (!pinch.current.from) {
          pinch.current = { from: now, base: zoomNow.current };
          return;
        }
        const next = pinch.current.base + (now / pinch.current.from - 1) * 0.5;
        setZoom(Math.min(1, Math.max(0, next)));
      },
      onPanResponderRelease: () => {
        pinch.current.from = 0;
      },
      onPanResponderTerminate: () => {
        pinch.current.from = 0;
      },
    }),
  ).current;

  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, [recording]);

  async function chooseVideo() {
    if (recording) return;
    // الصوتُ جزءٌ من المقطع: يُطلب إذنُه حين يُختار الفيديو لا قبله.
    if (!mic?.granted) {
      const asked = await askMic();
      if (!asked.granted) return;
    }
    setMode("video");
  }

  async function shoot() {
    if (busy || !camera.current) return;
    setBusy(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.85 });
      if (picture) {
        onShot({ uri: picture.uri, mime: "image/jpeg", width: picture.width, height: picture.height, video: false, seconds: 0 });
      }
    } finally {
      setBusy(false);
    }
  }

  async function roll() {
    if (!camera.current) return;
    if (recording) {
      camera.current.stopRecording();
      return;
    }
    setRecording(true);
    setElapsed(0);
    // المدّةُ من الساعة لا من حالةٍ أُغلق عليها (القاعدة ١٣٤).
    const began = Date.now();
    try {
      const clip = await camera.current.recordAsync({ maxDuration: limit });
      if (clip?.uri) {
        const seconds = Math.max(1, Math.min(limit, Math.round((Date.now() - began) / 1000)));
        onShot({ uri: clip.uri, mime: "video/mp4", width: 0, height: 0, video: true, seconds });
      }
    } finally {
      setRecording(false);
    }
  }

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <Spinner color="#fff" />
      </View>
    );
  }

  // بلا إذنٍ لا تُغلق الشاشة: المعرضُ بابٌ آخر للقصّة.
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", padding: 28, justifyContent: "center" }}>
        <Pressable accessibilityLabel="إغلاق" onPress={onClose} hitSlop={12} style={[disc, { position: "absolute", top: insets.top + 8, right: 20 }]}>
          <CloseIcon size={20} color="#fff" />
        </Pressable>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 10 }}>الكاميرا مقفلة</Text>
        <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 13, lineHeight: 24, textAlign: "center", marginBottom: 22 }}>
          نحتاج إذن الكاميرا لتصوير قصّتك. ولا نفتحها إلا وأنت في هذه الشاشة.
        </Text>
        <Pressable
          onPress={() => void askCamera()}
          style={{ height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
        >
          <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "700" }}>اسمح بالكاميرا</Text>
        </Pressable>
        <Pressable onPress={onLibrary} style={{ height: 46, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
          <Text style={{ color: "rgba(255,255,255,.8)", fontSize: 13.5 }}>اختر من المعرض</Text>
        </Pressable>
      </View>
    );
  }

  const left = Math.max(0, limit - elapsed);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView ref={camera} style={{ flex: 1 }} facing={facing} flash={flash} mode={mode} zoom={zoom} videoQuality="720p" />
      <View {...pincher.panHandlers} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 20,
          right: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable accessibilityLabel="إغلاق" onPress={onClose} hitSlop={12} style={disc}>
          <CloseIcon size={20} color="#fff" />
        </Pressable>
        {recording ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.live }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" }} />
            <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "700" }}>{ar(left)}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityLabel="الفلاش"
          onPress={() => setFlash((one) => (one === "auto" ? "on" : one === "on" ? "off" : "auto"))}
          hitSlop={12}
          style={disc}
        >
          <FlashMark mode={flash} />
        </Pressable>
      </View>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 14, alignItems: "center" }}>
        {zoom > 0.02 ? (
          <Pressable
            onPress={() => setZoom(0)}
            style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, marginBottom: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.42)" }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{ar(Math.round((1 + zoom * 4) * 10) / 10)}×</Text>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", paddingHorizontal: 36, marginBottom: 18 }}>
          <Pressable accessibilityLabel="المعرض" disabled={recording} onPress={onLibrary} style={[disc, { borderRadius: 12, opacity: recording ? 0.4 : 1 }]}>
            <GalleryMark />
          </Pressable>

          <Pressable
            accessibilityLabel={mode === "video" ? (recording ? "أوقف التسجيل" : "سجّل") : "صوّر"}
            disabled={busy}
            onPress={() => void (mode === "video" ? roll() : shoot())}
            style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 3, borderColor: "rgba(255,255,255,.9)", alignItems: "center", justifyContent: "center" }}
          >
            <View
              style={{
                width: recording ? 30 : 62,
                height: recording ? 30 : 62,
                borderRadius: recording ? 7 : 31,
                backgroundColor: mode === "video" ? colors.live : "#fff",
                opacity: busy ? 0.5 : 1,
              }}
            />
          </Pressable>

          <Pressable
            accessibilityLabel="بدّل الكاميرا"
            disabled={recording}
            onPress={() => {
              setZoom(0);
              setFacing((one) => (one === "back" ? "front" : "back"));
            }}
            style={[disc, { opacity: recording ? 0.4 : 1 }]}
          >
            <FlipMark />
          </Pressable>
        </View>

        {/* الشريطُ الزجاجيّ: صورةٌ أو فيديو — ويقف ما دام التسجيلُ جارياً. */}
        <GlassPill>
          {(["picture", "video"] as const).map((one) => {
            const on = mode === one;
            return (
              <Pressable
                key={one}
                disabled={recording}
                onPress={() => (one === "video" ? void chooseVideo() : setMode("picture"))}
                style={{ height: 36, paddingHorizontal: 20, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(255,255,255,.92)" : "transparent" }}
              >
                <Text style={{ color: on ? "#000" : "#fff", fontSize: 13.5, fontWeight: "700" }}>{one === "picture" ? "صورة" : "فيديو"}</Text>
              </Pressable>
            );
          })}
        </GlassPill>
        {mode === "video" && !recording ? (
          <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 11, marginTop: 8 }}>حتى {ar(limit)} ثانية</Text>
        ) : null}
      </View>
    </View>
  );
}

/** قرصٌ زجاجيّ داكن — آبل تغبّش ما تحته، وأندرويد أرضيةٌ نصفُ شفّافة (القاعدة ٢٢٨). */
export function GlassPill({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          padding: 4,
          borderRadius: 26,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,.16)",
          backgroundColor: Platform.OS === "ios" ? "rgba(14,26,36,.25)" : "rgba(14,26,36,.72)",
        },
        style,
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView intensity={60} tint="systemUltraThinMaterialDark" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
      ) : null}
      {children}
    </View>
  );
}

export const disc = {
  width: 46,
  height: 46,
  borderRadius: 23,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,.42)",
} as const;

function FlashMark({ mode }: { mode: "auto" | "on" | "off" }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" fill={mode === "on" ? "#fff" : "none"} />
      {mode === "off" ? <Path d="M4 4l16 16" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" /> : null}
      {mode === "auto" ? <Path d="M17.4 3.2h.2l1.9 4.6h-1.2l-.35-.95h-1.9l-.35.95h-1.2l1.9-4.6Zm.1 1.6-.5 1.35h1l-.5-1.35Z" fill="#fff" /> : null}
    </Svg>
  );
}

function FlipMark() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1-1.6h5.4l1 1.6h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="#fff"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12.5} r={3.2} stroke="#fff" strokeWidth={1.7} />
      <Path d="M9.6 11.2l1.3-1.3M14.4 13.8l-1.3 1.3" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function GalleryMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={4.5} width={17} height={15} rx={3} stroke="#fff" strokeWidth={1.7} />
      <Circle cx={9} cy={9.5} r={1.6} fill="#fff" />
      <Path d="m4 17 4.6-4.4a1.5 1.5 0 0 1 2 0L15 17m-2-2 2.2-2a1.5 1.5 0 0 1 2 0L20 15.6" stroke="#fff" strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}

/** سهمُ النشر — يُرسل القصّة. */
export function SendMark({ color = "#fff" }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20.5 3.5 10.6 13.4M20.5 3.5l-6.2 17-3.7-7.1-7.1-3.7 17-6.2Z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
