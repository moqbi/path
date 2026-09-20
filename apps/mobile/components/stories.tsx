import { View, Pressable, ScrollView } from "react-native";
import { Text } from "./type";
import { useRouter } from "expo-router";
import { Avatar } from "./avatar";
import { PlusIcon } from "./icons";
import { colors } from "../theme/tokens";
import type { StoryRing } from "../lib/queries";

/**
 * شريط القصص.
 *
 * الحلقة الملوّنة تعني «فيها ما لم تره»، والرمادية «رأيتها كلها» — كما
 * تعوّد الناس. وأول الشريط زرّ قصتك، فالنشر أقرب من التصفّح.
 */
export function StoryStrip({ rings, meId }: { rings: StoryRing[]; meId: string }) {
  const router = useRouter();
  const mine = rings.find((ring) => ring.userId === meId) ?? null;
  const others = rings.filter((ring) => ring.userId !== meId);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", gap: 14, paddingHorizontal: 20, paddingVertical: 12 }}
    >
      <View style={{ width: 68, alignItems: "center", gap: 6 }}>
        <Pressable
          accessibilityLabel="قصة جديدة"
          onPress={() => router.push("/stories/new" as never)}
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: colors.line,
            backgroundColor: colors.card,
          }}
        >
          <PlusIcon size={22} color={colors.clayInk} />
        </Pressable>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, textAlign: "center" }}>
          قصة جديدة
        </Text>
      </View>

      {mine ? <Ring ring={mine} label="قصتي" /> : null}
      {others.map((ring) => (
        <Ring key={ring.userId} ring={ring} label={ring.name} />
      ))}
    </ScrollView>
  );
}

function Ring({ ring, label }: { ring: StoryRing; label: string }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/stories/${ring.userId}` as never)}
      style={{ width: 68, alignItems: "center", gap: 6 }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          padding: 2.5,
          alignItems: "center",
          justifyContent: "center",
          // التدرّج حلقةً: لونٌ واحد يقوم مقامه — والفرق بين «جديد»
          // و«مقروء» يبقى ظاهراً وهو المقصود.
          backgroundColor: ring.fresh ? colors.clay : colors.line,
        }}
      >
        <View style={{ width: "100%", height: "100%", borderRadius: 29, backgroundColor: colors.paper, padding: 2, alignItems: "center", justifyContent: "center" }}>
          <Avatar name={ring.name} size={52} mediaId={ring.avatarMediaId} frame={ring.frame} />
        </View>
      </View>
      <Text numberOfLines={1} style={{ color: colors.ink2, fontSize: 10.5, textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
}
