import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { Avatar } from "../../components/avatar";
import { api } from "../../lib/api";
import { ar } from "../../lib/format";
import { colors } from "../../theme/tokens";

type Blocked = { id: string; name: string; memberNo: number; avatarMediaId: string | null };

/**
 * المحظورون.
 *
 * الحظر في الاتجاهين ويُفكّ من هنا — وهو شرط متجر آبل: لا يكفي أن
 * تحظر، لا بدّ أن ترى من حظرت وتتراجع.
 */
export default function BlockedScreen() {
  const client = useQueryClient();

  const blocked = useQuery({
    queryKey: ["circle", "blocked"],
    queryFn: () => api<{ people: Blocked[] }>("/v1/circle/blocked"),
  });

  const unblock = useMutation({
    mutationFn: (id: string) => api(`/v1/circle/${id}/block`, { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["circle", "blocked"] });
      await client.invalidateQueries({ queryKey: ["circle"] });
    },
  });

  const people = blocked.data?.people ?? [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="المحظورون" back="/settings/privacy" />

      <FlatList
        data={people}
        keyExtractor={(person) => person.id}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 12, textAlign: "right" }}>
            الحظر في الاتجاهين: لا ترى لحظاته ولا يراها، ولا يتفاعل معك. والصداقة
            تُفكّ عند الحظر.
          </Text>
        }
        ListEmptyComponent={
          blocked.isLoading ? (
            <ActivityIndicator color={colors.clay} />
          ) : (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingVertical: 28 }}>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                ما فيه محظورون
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 12,
              padding: 12,
              backgroundColor: colors.card,
              borderColor: colors.line,
              borderWidth: 1,
              borderTopWidth: index === 0 ? 1 : 0,
              borderTopLeftRadius: index === 0 ? 16 : 0,
              borderTopRightRadius: index === 0 ? 16 : 0,
              borderBottomLeftRadius: index === people.length - 1 ? 16 : 0,
              borderBottomRightRadius: index === people.length - 1 ? 16 : 0,
            }}
          >
            <Avatar name={item.name} size={42} mediaId={item.avatarMediaId} />

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "600", textAlign: "right" }}>
                {item.name}
              </Text>
              <Text style={{ color: colors.faint, fontSize: 11.5, textAlign: "right" }}>
                عضوية {ar(item.memberNo)}
              </Text>
            </View>

            <Pressable
              onPress={() => unblock.mutate(item.id)}
              style={{ height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: colors.ink2, fontSize: 12.5, fontWeight: "600" }}>فكّ الحظر</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
