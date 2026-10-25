import { useRef } from "react";
import { Modal, Pressable, View, Dimensions, Animated, PanResponder, Platform } from "react-native";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { MediaImage } from "./media-image";
import { CloseIcon } from "./icons";

/**
 * الصورة المفتوحة — حالةٌ واحدة للتطبيق كلّه.
 *
 * كان كلُّ بطاقةٍ تحمل نافذتها، فتسكن النافذةُ داخل الخطّ الزمنيّ في
 * شجرة React. ونظامُ اللمس يسأل **آباءَ المكوّن** لا ما فوقه على
 * الشاشة، فكان سحبُ الصورة إلى أسفل يصل إلى التقاط «اسحب للتحديث»
 * أوّلاً — وهو جدُّها في الشجرة — فيتمدّد الغلاف تحتها ويُسمع التحديث
 * بدل أن تُغلق. فالنافذة تُركَّب مرّةً في الجذر (`_layout.tsx`)، ولا
 * جدَّ لها يلتقط شيئاً، والبطاقة تطلبها بـ`viewPhoto`.
 */
const useViewer = create<{ mediaId: string | null }>(() => ({ mediaId: null }));

export const viewPhoto = (mediaId: string | null) => useViewer.setState({ mediaId });

/** المسافة التي تُغلق بعدها السحبةُ الصورة. */
const DISMISS = 90;
/** أقصى التقريب، وما بين نقرتين تُعدّان نقرةً مزدوجة. */
const MAX_ZOOM = 4;
const DOUBLE_MS = 260;

type Point = { x: number; y: number };
const spread = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function PhotoViewer() {
  const mediaId = useViewer((state) => state.mediaId);
  /*
    الحافّةُ العليا من مقاييس الجهاز حين يغيب السياق: النافذةُ تُركَّب في
    الجذر، وهناك قد يردّ `useSafeAreaInsets` صفراً — فجلس زرُّ الإغلاق تحت
    شريط الحالة حيث لا تصله الضغطة، وبقي السحبُ وحده يُغلق.
  */
  const context = useSafeAreaInsets();
  const insets = {
    top: Math.max(context.top, initialWindowMetrics?.insets.top ?? 0, Platform.OS === "ios" ? 44 : 24),
    bottom: Math.max(context.bottom, initialWindowMetrics?.insets.bottom ?? 0),
  };
  const screen = Dimensions.get("window");
  const drag = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const area = { width: screen.width, height: screen.height - insets.top - insets.bottom };

  /*
    التقريبُ بإصبعين (القاعدة ٣٤١): القيمُ الحاليّة في مرجعٍ لا في حالة — تتبدّل مع كلّ
    حدث لمسٍ ولا تُعيد الرسم. والإزاحةُ محدودةٌ بما زاد من الصورة عن الشاشة، فلا تخرج.
  */
  const now = useRef({ scale: 1, x: 0, y: 0 }).current;
  const gesture = useRef<{
    mode: "none" | "pinch" | "pan" | "dismiss";
    dist: number;
    scale: number;
    mid: Point;
    x: number;
    y: number;
    last: Point;
    start: Point;
  }>({ mode: "none", dist: 1, scale: 1, mid: { x: 0, y: 0 }, x: 0, y: 0, last: { x: 0, y: 0 }, start: { x: 0, y: 0 } }).current;
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bound = (value: number, zoom: number, size: number) => {
    const room = ((zoom - 1) * size) / 2;
    return Math.max(-room, Math.min(room, value));
  };
  const apply = (zoom: number, x: number, y: number) => {
    now.scale = zoom;
    now.x = x;
    now.y = y;
    scale.setValue(zoom);
    panX.setValue(x);
    panY.setValue(y);
  };
  const settle = (zoom: number, x: number, y: number) => {
    now.scale = zoom;
    now.x = x;
    now.y = y;
    Animated.parallel([
      Animated.spring(scale, { toValue: zoom, useNativeDriver: true, friction: 8 }),
      Animated.spring(panX, { toValue: x, useNativeDriver: true, friction: 8 }),
      Animated.spring(panY, { toValue: y, useNativeDriver: true, friction: 8 }),
    ]).start();
  };

  const close = () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    viewPhoto(null);
    drag.setValue(0);
    apply(1, 0, 0);
  };

  /** نقرةٌ تُغلق، ونقرتان تقرّبان حيث نُقر أو تُعيدان الصورة. */
  const onTap = (at: Point) => {
    const time = Date.now();
    if (time - lastTap.current < DOUBLE_MS) {
      lastTap.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (now.scale > 1.05) settle(1, 0, 0);
      else {
        const zoom = 2.5;
        const x = bound((area.width / 2 - at.x) * (zoom - 1), zoom, area.width);
        const y = bound((screen.height / 2 - at.y) * (zoom - 1), zoom, area.height);
        settle(zoom, x, y);
      }
      return;
    }
    lastTap.current = time;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    // مقرَّبةٌ لا تُغلق بنقرة: النقرةُ هناك أثرُ يدٍ تتنقّل في الصورة.
    tapTimer.current = setTimeout(() => {
      if (now.scale <= 1.05) close();
    }, DOUBLE_MS);
  };

  /*
    السحب إلى أسفل يُغلق (القاعدة ٧٨: رجوعُ النافذة سحبُها إلى أسفل)،
    والصورة تتبع الإصبع وتبهت معه — فإن لم يبلغ الحدّ رجعت مكانها.
  */
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length >= 2 ||
        (now.scale > 1.05 ? Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4 : g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const touch = e.nativeEvent.touches[0];
        gesture.mode = "none";
        gesture.start = { x: touch?.pageX ?? 0, y: touch?.pageY ?? 0 };
        gesture.last = gesture.start;
      },
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        if (touches.length >= 2) {
          const a = { x: touches[0].pageX, y: touches[0].pageY };
          const b = { x: touches[1].pageX, y: touches[1].pageY };
          if (gesture.mode !== "pinch") {
            gesture.mode = "pinch";
            gesture.dist = Math.max(1, spread(a, b));
            gesture.scale = now.scale;
            gesture.mid = middle(a, b);
            gesture.x = now.x;
            gesture.y = now.y;
            drag.setValue(0);
          }
          // يُسمح بما دون الواحد قليلاً أثناء القرص، ويرتدّ عند الإفلات.
          const zoom = Math.max(0.8, Math.min(MAX_ZOOM, (gesture.scale * spread(a, b)) / gesture.dist));
          const mid = middle(a, b);
          const ratio = zoom / gesture.scale;
          // النقطةُ بين الإصبعين تبقى تحتهما: الإزاحةُ تكبر بنسبة التقريب حول مركز الشاشة.
          const cx = area.width / 2;
          const cy = screen.height / 2;
          const x = (gesture.x - (gesture.mid.x - cx)) * ratio + (gesture.mid.x - cx) + (mid.x - gesture.mid.x);
          const y = (gesture.y - (gesture.mid.y - cy)) * ratio + (gesture.mid.y - cy) + (mid.y - gesture.mid.y);
          apply(zoom, zoom > 1 ? bound(x, zoom, area.width) : 0, zoom > 1 ? bound(y, zoom, area.height) : 0);
          return;
        }
        const touch = touches[0];
        if (!touch) return;
        const point = { x: touch.pageX, y: touch.pageY };
        if (gesture.mode === "pinch") {
          // رُفع إصبعٌ من القرص: يكمل الباقي سحباً من حيث هو.
          gesture.mode = now.scale > 1.05 ? "pan" : "none";
          gesture.last = point;
          return;
        }
        if (gesture.mode === "none") gesture.mode = now.scale > 1.05 ? "pan" : "dismiss";
        if (gesture.mode === "pan") {
          apply(
            now.scale,
            bound(now.x + point.x - gesture.last.x, now.scale, area.width),
            bound(now.y + point.y - gesture.last.y, now.scale, area.height),
          );
          gesture.last = point;
        } else if (gesture.mode === "dismiss") {
          drag.setValue(Math.max(0, point.y - gesture.start.y));
        }
      },
      onPanResponderRelease: (_, g) => {
        const mode = gesture.mode;
        gesture.mode = "none";
        if (mode === "dismiss") {
          if (g.dy > DISMISS || g.vy > 1.2) {
            Animated.timing(drag, { toValue: screen.height, duration: 160, useNativeDriver: true }).start(close);
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
          }
          return;
        }
        if (now.scale < 1.05) settle(1, 0, 0);
        else if (now.scale > MAX_ZOOM) settle(MAX_ZOOM, bound(now.x, MAX_ZOOM, area.width), bound(now.y, MAX_ZOOM, area.height));
      },
      onPanResponderTerminate: () => {
        gesture.mode = "none";
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        if (now.scale < 1.05) settle(1, 0, 0);
      },
    }),
  ).current;

  const fade = drag.interpolate({ inputRange: [0, 300], outputRange: [0.96, 0.3], extrapolate: "clamp" });

  return (
    <Modal visible={Boolean(mediaId)} transparent animationType="fade" onRequestClose={close}>
      <Animated.View
        {...pan.panHandlers}
        style={{ flex: 1, backgroundColor: "rgb(6,12,18)", opacity: fade }}
      >
        <Pressable
          accessibilityLabel="أغلق الصورة"
          onPress={(e) => onTap({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View style={{ transform: [{ translateY: drag }, { translateX: panX }, { translateY: panY }, { scale }] }}>
            {mediaId ? (
              <MediaImage
                mediaId={mediaId}
                resizeMode="contain"
                style={area}
              />
            ) : null}
          </Animated.View>
        </Pressable>
      </Animated.View>

      <View style={{ position: "absolute", top: insets.top + 12, right: 16, zIndex: 10, elevation: 10 }} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="إغلاق"
          onPress={close}
          hitSlop={16}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)" }}
        >
          <CloseIcon size={18} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
