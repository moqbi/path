import { View, Pressable, Modal, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from "react-native";
import { Text } from "./type";
import { colors } from "../theme/tokens";
import { ORIENTATIONS } from "../lib/stage";

/**
 * نافذةٌ من الأسفل.
 *
 * ومكانها هنا لا في `avatar-menu.tsx`: المتجر يفتح البطاقة نفسها،
 * ونسخةٌ ثانية منها تنفرط عن الأولى بأوّل تعديل. ونسخةُ الويب في
 * `src/components/sheet.tsx` مثلُها.
 *
 * وعلى الآيباد والآيفون المُدار بعرضٍ أقصاه ٦٠٠ في الوسط لا شريطٌ بعرض الشاشة، ويُمرَّر
 * ما زاد على تسعة أعشار ارتفاعها — شاشةٌ أفقيّةٌ ارتفاعُها نحو ٤٠٠ (القاعدة ٤٦٨).
 */
export const SHEET_MAX = 600;

/** عرضُ ما داخل النافذة بعد حشوتها — لشبكةٍ تُحسب منه. */
export function sheetInner(screen: number): number {
  return Math.min(screen, SHEET_MAX) - 40;
}
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const screen = useWindowDimensions();
  return (
    <Modal transparent animationType="slide" supportedOrientations={ORIENTATIONS} onRequestClose={onClose}>
      {/* حقلٌ في النافذة (من دعاك؟) يصعد فوق الكيبورد لا تحته. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.42)" }} onPress={onClose} />

        <View
          style={{
            width: Math.min(screen.width, SHEET_MAX),
            alignSelf: "center",
            maxHeight: screen.height * 0.9,
            backgroundColor: colors.paper,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 32,
          }}
        >
          {/* مقبضٌ يقول إنّ النافذة تُغلق بسحبها. */}
          <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 12 }} />

          <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
            {title}
          </Text>

          <ScrollView style={{ flexGrow: 0 }} bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

