import { useState } from "react";
import { View, Text, Pressable, FlatList, Modal, TextInput } from "react-native";
import { Avatar } from "./avatar";
import { CheckIcon, SearchIcon } from "./icons";
import { colors } from "../theme/tokens";
import { ar } from "../lib/format";

export type Friend = {
  id: string;
  name: string;
  avatarMediaId: string | null;
  frame?: { spec: string; mediaId: string | null } | null;
  charm?: { spec: string; mediaId: string | null } | null;
};

/**
 * نافذةُ اختيار أشخاص.
 *
 * قائمةٌ لا جدارُ أسماء: عند مئةٍ وخمسين صديقاً كان الجدار يبتلع الشاشة
 * قبل أن يصل صاحبها إلى زرّ النشر. وفيها بحثٌ لأن التمرير بين ١٥٠ اسماً
 * أبطأ من كتابة حرفين.
 */
export function PeopleSheet({
  title,
  friends,
  picked,
  onToggle,
  onClose,
}: {
  title: string;
  friends: Friend[];
  picked: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const shown = term.trim()
    ? friends.filter((f) => f.name.includes(term.trim()))
    : friends;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(14,26,36,.6)" }} onPress={onClose} />

      <View
        style={{
          maxHeight: "72%",
          backgroundColor: colors.paper,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingTop: 10,
        }}
      >
        <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 12 }} />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "700" }}>{title}</Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: colors.clayInk, fontSize: 13, fontWeight: "600" }}>تم</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
          <SearchIcon size={15} color={colors.faint} />
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="ابحث في أصدقائك"
            placeholderTextColor={colors.faint}
            style={{ flex: 1, minWidth: 0, fontSize: 13, color: colors.ink, textAlign: "right" }}
          />
        </View>

        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          renderItem={({ item }) => {
            const on = picked.includes(item.id);
            return (
              <Pressable
                onPress={() => onToggle(item.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                  paddingVertical: 9,
                  paddingHorizontal: 10,
                  marginBottom: 6,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: on ? colors.clay : colors.line,
                  backgroundColor: on ? colors.claySoft : colors.card,
                }}
              >
                <Avatar
                  name={item.name}
                  size={38}
                  mediaId={item.avatarMediaId}
                  frameSpec={item.frame?.spec}
                  charm={item.charm}
                />
                <Text style={{ flex: 1, color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>
                  {item.name}
                </Text>
                {on ? <CheckIcon size={17} color={colors.clay} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 30 }}>
              {term.trim() ? "ما لقينا أحداً بهذا الاسم." : "ما عندك أصدقاء بعد."}
            </Text>
          }
        />
      </View>
    </Modal>
  );
}

/** زرُّ فتح القائمة: يقول من اخترت وكم، فلا يُفتح ليُتذكَّر. */
export function PickerButton({
  label,
  count,
  onOpen,
}: {
  label: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 48,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.card,
      }}
    >
      <Text style={{ flex: 1, fontSize: 13.5, color: count ? colors.ink : colors.faint }} numberOfLines={1}>
        {label}
      </Text>
      {count > 0 ? (
        <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}>
          <Text style={{ color: colors.onBrand, fontSize: 11, fontWeight: "700" }}>{ar(count)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
