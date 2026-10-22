import { View } from "react-native";
import { Text } from "./type";
import { colors } from "../theme/tokens";
import { SPINE_W, SpineThread } from "./moment-card";

/** مركز عمود الصور من حافة الشاشة: حشوة ٢٠ زائد نصف العمود. */
export const SPINE_X = 20 + SPINE_W / 2;

/**
 * الخيط الذي تتعلّق به اللحظات.
 *
 * خطٌّ واحد ينزل من أسفل صورة الغلاف إلى آخر لحظة، والصور عقدٌ عليه:
 * هذا ما يجعل الخط الزمني يُقرأ يوميات لا قائمةَ بطاقات.
 */
export function SpineLine({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ position: "relative" }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          insetInlineStart: SPINE_X,
          width: 1,
          backgroundColor: colors.groundLine,
        }}
      />
      {children}
    </View>
  );
}

/** فاصل اليوم: نقطةٌ على الخيط ثم اسم اليوم. */
export function DayMark({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}>
      <View style={{ width: SPINE_W, alignItems: "center", justifyContent: "center", alignSelf: "stretch" }}>
        <SpineThread top={-16} bottom={-16} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.groundInk, opacity: 0.45 }} />
      </View>
      <Text style={{ color: colors.groundInk2, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
