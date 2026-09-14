import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "./screen-header";
import { colors } from "../theme/tokens";

/**
 * شاشةٌ لم تُبنَ بعد.
 *
 * موجودةٌ كي لا يسقط التطبيق حين يُضغط زرٌّ وجهتُه لم تصل بعد: زرٌّ يقود
 * إلى خطأ أسوأ من زرٍّ يقول «قريباً». وتُحذف حين تُبنى وجهتها.
 */
export function Soon({ title, note }: { title: string; note: string }) {
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title={title} back="/" />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "700", marginBottom: 8 }}>
          قريباً
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 23 }}>
          {note}
        </Text>
      </View>
    </SafeAreaView>
  );
}
