import { View, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "./type";
import { Avatar } from "./avatar";
import { NameTag } from "./name-tag";
import { ar } from "../lib/format";
import type { FoundPerson } from "../lib/add-friend";
import { colors } from "../theme/tokens";

/** كلمةُ الزرّ بحسب العلاقة — والحالةُ بعد الضغط تسبق ما جاء من الخادم. */
const LABEL: Record<FoundPerson["relation"], string> = {
  none: "أضف",
  incoming: "اقبل",
  sent: "أُرسل الطلب",
  friend: "صديقك",
};

/** صفُّ من يُضاف: الضغطُ على الصفّ يفتح بطاقتَه، والزرُّ يُضيف. */
export function FoundRow({
  person,
  relation,
  pending,
  onAdd,
}: {
  person: FoundPerson;
  relation: FoundPerson["relation"];
  pending: boolean;
  onAdd: () => void;
}) {
  const router = useRouter();
  const live = relation === "none" || relation === "incoming";
  return (
    <Pressable
      onPress={() => router.push(`/u/${person.id}` as never)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}
    >
      <Avatar name={person.name} size={44} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14.5, fontWeight: "700", writingDirection: "auto", flexShrink: 1 }}>
            {person.name}
          </Text>
          <NameTag isPlus={person.isPlus} tag={person.tag} />
        </View>
        <Text style={{ color: colors.faint, fontSize: 11.5 }}>
          عضوية رقم {ar(person.memberNo)}
          {person.handle ? ` │ ⁨@${person.handle}⁩` : ""}
        </Text>
      </View>
      <Pressable
        disabled={!live || pending}
        onPress={onAdd}
        hitSlop={6}
        style={{
          height: 34,
          paddingHorizontal: 14,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: live ? colors.clay : colors.paper,
          borderWidth: live ? 0 : 1,
          borderColor: colors.line,
        }}
      >
        {pending ? (
          <ActivityIndicator size="small" color={colors.onBrand} />
        ) : (
          <Text style={{ color: live ? colors.onBrand : colors.muted, fontSize: 12.5, fontWeight: "700" }}>
            {LABEL[relation]}
          </Text>
        )}
      </Pressable>
    </Pressable>
  );
}

