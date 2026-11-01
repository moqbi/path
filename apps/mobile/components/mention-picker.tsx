import { Platform, Pressable, ScrollView, View } from "react-native";
import { BlurView } from "expo-blur";
import { Text } from "./type";
import { Avatar } from "./avatar";
import { matchesName, type MentionPerson } from "../lib/mentions";
import { colors } from "../theme/tokens";

/**
 * نافذةُ الإشارة (القاعدة ٣٨٧) — **بقرار المالك**: «@» في حقل التعليق تفتح فوقه زجاجاً بأسماء
 * من علّق على اللحظة وصاحبِها، وما يُكتب بعدها يصفّيها، والضغطةُ تكتب الاسمَ في الحقل. لا أحدَ
 * من خارج اللحظة: الإشارةُ ليست باباً إلى غريب (القاعدة ٢).
 */
export function MentionPicker({
  people,
  query,
  onPick,
  tone = "dark",
}: {
  people: MentionPerson[];
  query: string;
  onPick: (person: MentionPerson) => void;
  tone?: "dark" | "light";
}) {
  const found = people.filter((person) => matchesName(person.name, query)).slice(0, 8);
  const dark = tone === "dark";
  const ink = dark ? "#fff" : colors.ink;
  return (
    <View
      style={{
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: dark ? "rgba(255,255,255,.14)" : colors.line,
        backgroundColor: Platform.OS === "ios" ? "transparent" : dark ? "rgba(20,32,42,.96)" : colors.card,
      }}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={45}
          tint={dark ? "dark" : "light"}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      <View style={{ backgroundColor: Platform.OS === "ios" ? (dark ? "rgba(14,26,36,.55)" : "rgba(255,255,255,.6)") : "transparent" }}>
        <Text style={{ color: dark ? "rgba(255,255,255,.6)" : colors.muted, fontSize: 11.5, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
          أشِر إلى من علّق هنا
        </Text>
        {found.length ? (
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="always">
            {found.map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`أشِر إلى ${person.name}`}
                onPress={() => onPick(person)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: pressed ? (dark ? "rgba(255,255,255,.08)" : colors.paper) : "transparent",
                })}
              >
                <Avatar name={person.name} size={30} mediaId={person.avatarMediaId} />
                <Text numberOfLines={1} style={{ flex: 1, color: ink, fontSize: 14, fontWeight: "600", writingDirection: "auto" }}>
                  {person.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: dark ? "rgba(255,255,255,.5)" : colors.muted, fontSize: 12.5, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 }}>
            لا أحد بهذا الاسم بين من علّق
          </Text>
        )}
      </View>
    </View>
  );
}
