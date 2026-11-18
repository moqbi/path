import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./type";

/**
 * الكاميرا ومحرّرُ القصّة لا يتّسعان لآيفون مُدار (القاعدة ٤٦٨): لوحتُهما رأسيّة،
 * وبارتفاع شاشةٍ أفقيّة تضيق عن الغالق وأدوات التحرير. فيُطلب أن يُدار الجوّال
 * بدل أن تُرصّ الأدواتُ فوق بعضها — وما بُني لا يضيع: يعود المحرّرُ بإدارته.
 */
export function RotateHint({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1219", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
      <View
        style={{
          width: 34,
          height: 56,
          borderRadius: 8,
          borderWidth: 2.5,
          borderColor: "#fff",
          opacity: 0.9,
        }}
      />
      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" }}>دوّر جوّالك عمودياً</Text>
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center" }}>
        الكاميرا والقصة تُصوَّر وتُكتب على شاشةٍ قائمة.
      </Text>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="إغلاق"
        hitSlop={10}
        style={{ position: "absolute", top: insets.top + 12, right: insets.right + 16, padding: 6 }}
      >
        <Text style={{ color: "#fff", fontSize: 22 }}>×</Text>
      </Pressable>
    </View>
  );
}
