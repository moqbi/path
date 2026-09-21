import { View, Pressable, Modal } from "react-native";
import { Text } from "./type";
import { colors } from "../theme/tokens";

/**
 * نافذةٌ من الأسفل.
 *
 * ومكانها هنا لا في `avatar-menu.tsx`: المتجر يفتح البطاقة نفسها،
 * ونسخةٌ ثانية منها تنفرط عن الأولى بأوّل تعديل. ونسخةُ الويب في
 * `src/components/sheet.tsx` مثلُها.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.42)" }} onPress={onClose} />

      <View
        style={{
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

        {children}
      </View>
    </Modal>
  );
}
