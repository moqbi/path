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
export function sheetInner(screen: number, height = 0): number {
  const wide = screen > height || screen >= 700;
  return (wide && height ? Math.min(screen - 32, 460) : Math.min(screen, SHEET_MAX)) - 40;
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
  /*
    الشاشةُ العريضة والمُدارة (القاعدة ٤٦٨) — **بقرار المالك**: نافذةٌ في الوسط بعرض ٤٦٠
    وحوافّها مستديرة، لا لوحٌ من الأسفل يكاد يملأ الشاشة ويعلوه شريطٌ معتم.
  */
  const wide = screen.width > screen.height || screen.width >= 700;
  return (
    <Modal transparent animationType={wide ? "fade" : "slide"} supportedOrientations={ORIENTATIONS} onRequestClose={onClose}>
      {/* حقلٌ في النافذة (من دعاك؟) يصعد فوق الكيبورد لا تحته. */}
      <KeyboardAvoidingView
        style={[{ flex: 1 }, wide ? { alignItems: "center", justifyContent: "center", padding: 16 } : null]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={wide ? { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(14,26,36,.42)" } : { flex: 1, backgroundColor: "rgba(14,26,36,.42)" }}
          onPress={onClose}
        />

        <View
          style={{
            width: wide ? Math.min(screen.width - 32, 460) : Math.min(screen.width, SHEET_MAX),
            alignSelf: "center",
            maxHeight: screen.height * (wide ? 0.88 : 0.9),
            backgroundColor: colors.paper,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderBottomLeftRadius: wide ? 24 : 0,
            borderBottomRightRadius: wide ? 24 : 0,
            borderWidth: wide ? 1 : 0,
            borderTopWidth: 1,
            borderColor: colors.line,
            paddingHorizontal: 20,
            paddingTop: wide ? 16 : 12,
            paddingBottom: wide ? 20 : 32,
          }}
        >
          {/* مقبضٌ يقول إنّ النافذة تُغلق بسحبها — وفي الوسط لا سحب. */}
          {wide ? null : (
            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 12 }} />
          )}

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

