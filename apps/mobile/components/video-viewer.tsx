import { useEffect, useMemo, useRef } from "react";
import { ORIENTATIONS } from "../lib/stage";
import { usePathname } from "expo-router";
import { Animated, AppState, useWindowDimensions, Modal, PanResponder, Pressable, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
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
/*
  الإغلاقُ يُخفي النافذةَ ولا يُنزلها (القاعدة ٤٧٦): نافذةُ آبل تُنزَل وهي ظاهرة — وأكثرُ ذلك مع
  الدوران — فيبقى حاجبُها الشفّاف فوق التطبيق فلا يستجيب لشيء. فـ`shown` يطفئها، ونزولُ المكوّن
  بعد `onDismiss` (ومهلةٌ لأندرويد الذي لا يناديه).
*/
const useVideo = create<{ videoId: string | null; shown: boolean; session: number }>(() => ({ videoId: null, shown: false, session: 0 }));

export const viewVideo = (videoId: string | null) =>
  useVideo.setState((state) =>
    videoId ? { videoId, shown: true, session: state.session + 1 } : state.shown ? { shown: false } : {},
  );

const unmount = (session: number) =>
  useVideo.setState((state) => (state.session === session && !state.shown ? { videoId: null } : {}));

const DISMISS = 110;

export function VideoViewer() {
  const { videoId, shown, session } = useVideo();
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
    if (shown && path !== opened.current) viewVideo(null);
  }, [path, shown]);
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
  // أندرويد لا ينادي `onDismiss`، فالنزولُ بعد حركة الإغلاق.
  useEffect(() => {
    if (shown || !videoId) return;
    const t = setTimeout(() => unmount(session), 600);
    return () => clearTimeout(t);
  }, [shown, videoId, session]);
  if (!videoId) return null;
  return <Viewer key={session} videoId={videoId} shown={shown} session={session} />;
}

/**
 * النافذةُ تقيس حوافّ الجهاز بنفسها (`SafeAreaProvider` داخلها): الجذرُ يُصفّر الجانبين في الوضع
 * الأفقيّ (القاعدة ٤٧٠)، فكانت أدواتُ التشغيل في أعلى المقطع — الصوتُ والسمّاعةُ والتكبير — خلف
 * الساعة والشبكة قائماً وخلف حسّاس الكاميرا مُداراً. فالمقطعُ يُرسم داخل الحوافّ وتحت زرّ الإغلاق.
 */
function Viewer({ videoId, shown, session }: { videoId: string; shown: boolean; session: number }) {
  return (
    <Modal
      supportedOrientations={ORIENTATIONS}
      visible={shown}
      transparent
      animationType="fade"
      onRequestClose={() => viewVideo(null)}
      onDismiss={() => unmount(session)}
      statusBarTranslucent
    >
      <SafeAreaProvider>
        <Inner videoId={videoId} shown={shown} />
      </SafeAreaProvider>
    </Modal>
  );
}

function Inner({ videoId, shown }: { videoId: string; shown: boolean }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
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
  // الإغلاقُ يُوقف الصوتَ في الحال لا حين تنزل النافذة.
  useEffect(() => {
    if (!shown) player.pause();
  }, [shown, player]);

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
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", opacity: fadeBack }} />
        <Animated.View
          style={{
            flex: 1,
            marginTop: insets.top + 56,
            marginBottom: insets.bottom,
            marginLeft: insets.left,
            marginRight: insets.right,
            transform: [{ translateY: drag }, { scale: shrink }],
          }}
        >
          <VideoView
            player={player}
            style={{ flex: 1 }}
            contentFit="contain"
            nativeControls
            /*
              لا ملءَ شاشةٍ أصليّ ولا صورةً في صورة: النافذةُ بملء الشاشة أصلاً، وشاشةُ آبل الكاملة
              تُقدَّم فوق نافذتنا — فإن أُغلقت هذه تحتها، أو دار الجهازُ وهي فوقها، بقيت معلّقةً.
            */
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
          />
        </Animated.View>
        <Pressable
          accessibilityLabel="أغلق"
          onPress={close}
          hitSlop={12}
          style={{ position: "absolute", top: insets.top + 10, right: 16 + insets.right, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.55)" }}
        >
          <CloseIcon size={18} color="#fff" />
        </Pressable>
      </View>
  );
}
