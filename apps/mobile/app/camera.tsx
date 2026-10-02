import { useEffect, useRef, useState } from "react";
import { View, Pressable, Image, ActivityIndicator, Dimensions, PanResponder, type GestureResponderEvent } from "react-native";
import { Text } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import Svg, { Circle, Path } from "react-native-svg";
import { STORY_SECONDS } from "@athar/shared";
import { CloseIcon } from "../components/icons";
import { keepShot } from "../lib/capture";
import { ar } from "../lib/format";
import { StoryVideo } from "../components/story-video";
import { colors } from "../theme/tokens";

/**
 * الكاميرا داخل التطبيق لا كاميرا النظام.
 *
 * كاميرا النظام تخرج بالمستخدم من التطبيق وترجعه بصورةٍ جاهزة: لا معاينة
 * ولا فلاتر ولا قرار «أعيدها». وتطبيقُ لحظاتٍ يصوّر من الألبوم وحده ناقصٌ
 * في جوهره — اللحظة تُلتقط حين تقع لا حين تُستخرج من الأرشيف.
 *
 * وهي شاشةٌ واحدة تخدم الثلاثة: لحظة صورة، وقصة صورة، وقصة فيديو.
 * تفتحها الشاشةُ الطالبة بـ`mode`، وتضع اللقطة في `lib/capture` وترجع —
 * فالشاشة الطالبة تحتفظ بحالتها ولا تُستبدَل.
 */
type Mode = "picture" | "video";

export default function Camera() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; seconds?: string }>();
  const mode: Mode = params.mode === "video" ? "video" : "picture";
  const limit = Number(params.seconds) > 0 ? Number(params.seconds) : STORY_SECONDS;

  const [permission, askCamera] = useCameraPermissions();
  const [mic, askMic] = useMicrophonePermissions();

  const camera = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"auto" | "on" | "off">("auto");
  /*
    التقريب بإصبعين (٠ إلى ١ كما تقبله `CameraView`). والمرجعُ ما كان
    عليه ساعةَ وضع الإصبعين: القرصُ يُقاس نسبةً من بدايته لا من الصفر،
    فلا يقفز التقريبُ حين تبدأ قرصةٌ ثانية.
  */
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
        // ضِعفُ المسافة بين الإصبعين ≈ نصفُ مدى التقريب: سريعٌ بلا أن يقفز.
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
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shot, setShot] = useState<null | {
    uri: string;
    mime: string;
    width: number;
    height: number;
    video: boolean;
    seconds: number;
  }>(null);

  /*
    المؤقّت يعدّ ما دام التسجيل جارياً، ويقف بنفسه عند الحدّ.
    و`recordAsync` يقف وحده بـ`maxDuration`، لكن الرقم على الشاشة لا
    يعرف ذلك — فيُحسب هنا ليرى المصوّر كم بقي له.
  */
  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, [recording]);

  const screen = Dimensions.get("window");

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000", padding: 28, justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 10 }}>
          الكاميرا مقفلة
        </Text>
        <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 13, lineHeight: 24, textAlign: "center", marginBottom: 22 }}>
          نحتاج إذن الكاميرا لتصوير لحظتك. ولا نفتحها إلا وأنت في هذه الشاشة.
        </Text>
        <Pressable
          onPress={() => void askCamera()}
          style={{ height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
        >
          <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "700" }}>اسمح بالكاميرا</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ height: 46, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
          <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>رجوع</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  async function shoot() {
    if (busy || !camera.current) return;
    setBusy(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.85 });
      if (picture) {
        setShot({
          uri: picture.uri,
          mime: "image/jpeg",
          width: picture.width,
          height: picture.height,
          video: false,
          seconds: 0,
        });
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

    // الصوت جزءٌ من الفيديو: بلا إذن الميكروفون يخرج صامتاً.
    if (!mic?.granted) {
      const asked = await askMic();
      if (!asked.granted) return;
    }

    setRecording(true);
    setElapsed(0);
    /*
      المدّة من الساعة لا من `elapsed`: الدالّة أُغلقت على قيمته ساعةَ
      بدأ التسجيل — صفرٌ دائماً — فكان كلُّ مقطعٍ «٠ ثانية» ويردّه
      الخادم بـ«seconds: too small». والساعة لا تُغلَق على شيء.
    */
    const began = Date.now();
    try {
      const clip = await camera.current.recordAsync({ maxDuration: limit });
      if (clip?.uri) {
        const seconds = Math.max(1, Math.min(limit, Math.round((Date.now() - began) / 1000)));
        setShot({
          uri: clip.uri,
          mime: "video/mp4",
          width: 0,
          height: 0,
          video: true,
          seconds,
        });
      }
    } finally {
      setRecording(false);
    }
  }

  /* المعاينة: لا تُرسَل لقطةٌ لم يرها صاحبها (كقاعدة القصة ٩٦). */
  if (shot) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {shot.video ? (
          /* المقطع يُشغَّل ويُعاد — لا سطرٌ يصفه على شاشةٍ سوداء. */
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <StoryVideo source={shot.uri} local width={screen.width} height={screen.height * 0.78} loop />
            <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 12.5, marginTop: 8 }}>
              {ar(shot.seconds)} ثانية
            </Text>
          </View>
        ) : (
          <Image source={{ uri: shot.uri }} style={{ flex: 1 }} resizeMode="contain" />
        )}

        <SafeAreaView edges={["bottom"]}>
          <View style={{ flexDirection: "row", gap: 12, padding: 20 }}>
            <Pressable
              onPress={() => setShot(null)}
              style={{ flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.35)" }}
            >
              <Text style={{ color: "#fff", fontSize: 14.5, fontWeight: "600" }}>أعِدها</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                keepShot(shot);
                router.back();
              }}
              style={{ flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 14.5, fontWeight: "700" }}>استخدمها</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const left = Math.max(0, limit - elapsed);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        ref={camera}
        style={{ flex: 1 }}
        facing={facing}
        flash={flash}
        mode={mode}
        zoom={zoom}
        // الفيديو يحتاج الصوت، والصورة لا — فلا يُطلب إذنٌ بلا سبب.
        videoQuality="720p"
      />

      {/*
        طبقةُ القرص فوق الكاميرا وتحت الأزرار: إصبعان يقرّبان ويبعّدان،
        في الصورة والفيديو معاً وأثناء التسجيل. وإصبعٌ واحد يمرّ.
      */}
      <View
        {...pincher.panHandlers}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* الإغلاق والفلاش في الأعلى، والتصوير والتبديل في الأسفل. */}
      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 }}>
          <Pressable accessibilityLabel="إغلاق" onPress={() => router.back()} hitSlop={12} style={disc}>
            <CloseIcon size={20} color="#fff" />
          </Pressable>

          {mode === "video" && recording ? (
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
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        {/*
          مقدارُ التقريب يُقرأ فوق الغالق، وضغطُه يعيده إلى الأصل —
          وزرّا «١×» و«٢×» لمن يدُه مشغولةٌ بالجهاز.
        */}
        <View style={{ flexDirection: "row", alignSelf: "center", gap: 8, marginBottom: 14 }}>
          {[
            { label: "١×", value: 0 },
            { label: "٢×", value: 0.25 },
          ].map((step) => {
            const on = Math.abs(zoom - step.value) < 0.02;
            return (
              <Pressable
                key={step.label}
                onPress={() => setZoom(step.value)}
                hitSlop={8}
                style={{
                  minWidth: 38,
                  height: 38,
                  paddingHorizontal: 8,
                  borderRadius: 19,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: on ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.42)",
                }}
              >
                <Text style={{ color: on ? "#000" : "#fff", fontSize: 12.5, fontWeight: "700" }}>{step.label}</Text>
              </Pressable>
            );
          })}
          {zoom > 0.02 && Math.abs(zoom - 0.25) >= 0.02 ? (
            <Pressable
              onPress={() => setZoom(0)}
              style={{ height: 38, paddingHorizontal: 12, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.92)" }}
            >
              <Text style={{ color: "#000", fontSize: 12.5, fontWeight: "700" }}>
                {ar(Math.round((1 + zoom * 4) * 10) / 10)}×
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 36, paddingBottom: 26 }}>
          <View style={{ width: 46 }} />

          {/*
            زرّ التصوير قرصٌ أبيض بحلقةٍ حوله — يُعرف بلا تعليم. وفي
            الفيديو يصير مربّعاً أحمر وهو يسجّل: الشكل يقول «اضغط لتقف».
          */}
          <Pressable
            accessibilityLabel={mode === "video" ? (recording ? "أوقف التسجيل" : "سجّل") : "صوّر"}
            disabled={busy}
            /*
              بلا مؤثّرٍ هنا: كان `tap()` يُسمِع نغمةَ فتح قوس النشر نفسها،
              فيُسمع الغالق زرَّ الزائد. والنظامُ يُسمع غالقَه بنفسه في آبل،
              وثلاثُ نغماتٍ لثلاثة أفعال (القاعدة ٣٦) لا رابعة مستعارة.
            */
            onPress={() => void (mode === "video" ? roll() : shoot())}
            style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 3, borderColor: "rgba(255,255,255,.9)", alignItems: "center", justifyContent: "center" }}
          >
            <View
              style={{
                width: recording ? 30 : 62,
                height: recording ? 30 : 62,
                borderRadius: recording ? 7 : 31,
                backgroundColor: recording ? colors.live : "#fff",
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

        {mode === "video" ? (
          <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 11.5, textAlign: "center", paddingBottom: 14 }}>
            حتى {ar(limit)} ثانية
          </Text>
        ) : null}
      </SafeAreaView>

      {screen.width < 1 ? null : null}
    </View>
  );
}

const disc = {
  width: 46,
  height: 46,
  borderRadius: 23,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0,0,0,.42)",
} as const;

/** الفلاش ثلاث حالات، وشكلُه يقول أيّها: تلقائيّ بحرف A، ومطفأٌ بشرطة. */
function FlashMark({ mode }: { mode: "auto" | "on" | "off" }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={mode === "on" ? "#fff" : "none"}
      />
      {mode === "off" ? (
        <Path d="M4 4l16 16" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
      ) : null}
      {mode === "auto" ? (
        <Path d="M17.4 3.2h.2l1.9 4.6h-1.2l-.35-.95h-1.9l-.35.95h-1.2l1.9-4.6Zm.1 1.6-.5 1.35h1l-.5-1.35Z" fill="#fff" />
      ) : null}
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
