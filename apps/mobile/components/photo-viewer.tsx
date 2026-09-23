import { Modal, Pressable, View, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaImage } from "./media-image";
import { CloseIcon } from "./icons";

/**
 * الصورة كاملةً فوق كل شيء.
 *
 * ضغطُ صورة اللحظة يفتحها هي (القاعدة ٣٠) — لا صفحةَ اللحظة. وكان
 * يفتح الصفحة، فمن ضغط الصورة وهو في صفحة اللحظة فُتحت له الصفحةُ نفسها
 * ثانيةً فوقها: شاشةٌ مكرّرة بلا صورةٍ أكبر.
 *
 * وتُغلق بضغطةٍ في أيّ مكان أو بزرّ الإغلاق — ومعها زرُّ الرجوع في
 * أندرويد (`onRequestClose`).
 */
export function PhotoViewer({
  mediaId,
  onClose,
}: {
  mediaId: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const screen = Dimensions.get("window");

  return (
    <Modal visible={Boolean(mediaId)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="أغلق الصورة"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(6,12,18,.96)", alignItems: "center", justifyContent: "center" }}
      >
        {mediaId ? (
          <MediaImage
            mediaId={mediaId}
            resizeMode="contain"
            style={{ width: screen.width, height: screen.height - insets.top - insets.bottom }}
          />
        ) : null}
      </Pressable>

      <View style={{ position: "absolute", top: insets.top + 10, right: 16 }} pointerEvents="box-none">
        <Pressable
          accessibilityLabel="إغلاق"
          onPress={onClose}
          hitSlop={10}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)" }}
        >
          <CloseIcon size={18} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}
