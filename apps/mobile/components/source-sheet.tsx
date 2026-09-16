import { View, Pressable, Modal } from "react-native";
import { Text } from "./type";
import { CameraIcon } from "./icons";
import { colors } from "../theme/tokens";

/**
 * من أين الصورة: الكاميرا أم الألبوم.
 *
 * سؤالٌ يُطرح عند النشر لا قبله: من فتح «صورة» قد يريد ما وقع الآن وقد
 * يريد ما في أرشيفه، ولا يُعرف أيّهما إلا منه. وبابان ظاهران أصدق من
 * زرٍّ واحد يفتح الألبوم ويترك الكاميرا مخبوءة.
 *
 * ونافذةٌ من الأسفل لا قائمةُ نظام: `ActionSheetIOS` لآبل وحدها، وأندرويد
 * بلا مكافئ — فتختلف الشاشة بين الجهازين بلا سبب.
 */
export function SourceSheet({
  open,
  title = "من أين الصورة؟",
  onCamera,
  onVideo,
  onLibrary,
  onClose,
}: {
  open: boolean;
  title?: string;
  onCamera: () => void;
  /** القصة وحدها تقبل مقطعاً، فالباب يظهر لها لا لغيرها. */
  onVideo?: () => void;
  onLibrary: () => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={open} animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.55)" }} onPress={onClose} />

      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 30,
          direction: "rtl",
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 }} />

        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700", textAlign: "right", marginBottom: 12 }}>
          {title}
        </Text>

        <Pressable onPress={onCamera} style={row}>
          <CameraIcon size={19} color={colors.clayInk} />
          <Text style={label}>صوّر الآن</Text>
        </Pressable>

        {onVideo ? (
          <Pressable onPress={onVideo} style={row}>
            <VideoMark />
            <Text style={label}>سجّل مقطعاً</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={onLibrary} style={row}>
          <AlbumMark />
          <Text style={label}>اختر من المعرض</Text>
        </Pressable>

        <Pressable onPress={onClose} style={{ height: 46, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>إلغاء</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const row = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  height: 56,
  paddingHorizontal: 16,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.card,
  marginBottom: 10,
} as const;

const label = { color: colors.ink, fontSize: 14.5, fontWeight: "600" } as const;

function VideoMark() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <View style={{ width: 13, height: 15, borderRadius: 3.5, borderWidth: 1.7, borderColor: colors.clayInk }} />
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: 5,
          borderBottomWidth: 5,
          borderRightWidth: 6,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderRightColor: colors.clayInk,
        }}
      />
    </View>
  );
}

function AlbumMark() {
  return (
    <View style={{ width: 19, height: 19, borderRadius: 4, borderWidth: 1.7, borderColor: colors.clayInk, overflow: "hidden", justifyContent: "flex-end" }}>
      <View style={{ height: 7, backgroundColor: colors.clayInk, opacity: 0.55 }} />
    </View>
  );
}
