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

  const close = () => {
    viewPhoto(null);
    drag.setValue(0);
  };

  /*
    السحب إلى أسفل يُغلق (القاعدة ٧٨: رجوعُ النافذة سحبُها إلى أسفل)،
    والصورة تتبع الإصبع وتبهت معه — فإن لم يبلغ الحدّ رجعت مكانها.
  */
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS || g.vy > 1.2) {
          Animated.timing(drag, { toValue: screen.height, duration: 160, useNativeDriver: true }).start(close);
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
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
          onPress={close}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View style={{ transform: [{ translateY: drag }] }}>
            {mediaId ? (
              <MediaImage
                mediaId={mediaId}
                resizeMode="contain"
                style={{ width: screen.width, height: screen.height - insets.top - insets.bottom }}
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
