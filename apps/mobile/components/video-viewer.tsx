import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "expo-router";
import { Animated, AppState, Dimensions, Modal, PanResponder, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { create } from "zustand";
import { CloseIcon } from "./icons";
import { baseUrl, currentAccess } from "../lib/api";
import { stopClip } from "../lib/status-notes";

/**
 * مقطعُ اللحظة بملء الشاشة (القاعدة ٤٣٧) — كالصورة المفتوحة: «×» في أعلاها، والسحبُ إلى
 * أسفل يُغلقه وهو يتبع الإصبع. مركّبٌ في الجذر لا في البطاقة (القاعدة ١٣٧): جدُّ البطاقة
 * «اسحب للتحديث» يلتقط السحبة قبله. وأدواتُ التشغيل أدواتُ النظام نفسه (`nativeControls`).
 */
const useVideo = create<{ videoId: string | null; session: number }>(() => ({ videoId: null, session: 0 }));

export const viewVideo = (videoId: string | null) =>
  useVideo.setState((state) => ({ videoId, session: videoId ? state.session + 1 : state.session }));

const DISMISS = 110;

export function VideoViewer() {
  const { videoId, session } = useVideo();
  /*
    المقطعُ لا يبقى يُسمع خارج مكانه (القاعدة ٤٣٨): تبديلُ التبويب أو الشاشة، أو خروجُ التطبيق
    إلى الخلفيّة، يُغلقه — والإغلاقُ يُنزل المشغّلَ فيقف صوتُه.
  */
  const path = usePathname();
  const opened = useRef(path);
  useEffect(() => {
    if (!videoId) return;
    opened.current = path;
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (videoId && path !== opened.current) viewVideo(null);
  }, [path, videoId]);
  // ومقطعُ أغنية النوت مثلُه: لا يبقى يُسمع في تبويبٍ آخر.
  useEffect(() => {
    void stopClip();
  }, [path]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      viewVideo(null);
      void stopClip();
    });
    return () => sub.remove();
  }, []);
  if (!videoId) return null;
  return <Viewer key={session} videoId={videoId} />;
}

function Viewer({ videoId }: { videoId: string }) {
  const insets = useSafeAreaInsets();
  const { height } = Dimensions.get("window");
  const drag = useRef(new Animated.Value(0)).current;
  const close = () => viewVideo(null);

  const source = useMemo(() => {
    const token = currentAccess();
    return token ? { uri: `${baseUrl}/v1/media/${videoId}`, headers: { authorization: `Bearer ${token}` } } : null;
  }, [videoId]);
  const player = useVideoPlayer(source, (made) => {
    made.loop = false;
    made.play();
  });

  const pan = useRef(
    PanResponder.create({
      // السحبةُ النازلة وحدها لنا، وما سواها لأدوات التشغيل تحتها.
      onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > DISMISS || g.vy > 1.1) {
          Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(close);
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  const fadeBack = drag.interpolate({ inputRange: [0, 300], outputRange: [1, 0.2], extrapolate: "clamp" });
  const shrink = drag.interpolate({ inputRange: [0, 400], outputRange: [1, 0.85], extrapolate: "clamp" });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", opacity: fadeBack }} />
        <Animated.View style={{ flex: 1, transform: [{ translateY: drag }, { scale: shrink }] }}>
          <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
        </Animated.View>
        <Pressable
          accessibilityLabel="أغلق"
          onPress={close}
          hitSlop={12}
          style={{ position: "absolute", top: insets.top + 10, right: 16, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.55)" }}
        >
          <CloseIcon size={18} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
