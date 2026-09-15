import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { SwipeRow } from "../../components/swipe-row";
import { ScreenHeader } from "../../components/screen-header";
import { StoryStrip } from "../../components/stories";
import { api } from "../../lib/api";
import { keys, useCircle, useRings } from "../../lib/queries";
import { ar, presence } from "../../lib/format";
import { useSession } from "../../lib/session";
import { colors } from "../../theme/tokens";

/**
 * الدائرة.
 *
 * الطلبات الواردة أولاً — فعلٌ ينتظرك يسبق قائمةً تتصفّحها — ثم الأصدقاء
 * وما بقي من السقف. والسقف مكتوبٌ دائماً: مئةٌ وخمسون قرارُ منتَج يُرى،
 * لا حدٌّ يُكتشف حين يُبلَغ.
 */
export default function Circle() {
  const circle = useCircle();
  const rings = useRings();
  const router = useRouter();
  const client = useQueryClient();
  const me = useSession((state) => state.me);

  const answer = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api(`/v1/circle/requests/${id}/${accept ? "accept" : "ignore"}`, { method: "POST" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.circle });
      void client.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  /** الإخراج من الدائرة، والحظر — كلاهما يذهب بالصداقة. */
  const cut = useMutation({
    mutationFn: (id: string) => api(`/v1/circle/${id}`, { method: "DELETE" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.circle });
      void client.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const ban = useMutation({
    mutationFn: (id: string) => api(`/v1/circle/${id}/block`, { method: "POST" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.circle });
      void client.invalidateQueries({ queryKey: ["circle", "blocked"] });
      void client.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const data = circle.data;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader
        title="الأصدقاء"
        right={
          data ? (
            <Text style={{ color: colors.chromeMuted, fontSize: 11.5 }}>
              بقي {ar(data.left)}
            </Text>
          ) : null
        }
      />

      <FlatList
        data={data?.members ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={circle.isRefetching}
            onRefresh={() => void circle.refetch()}
            tintColor={colors.clay}
          />
        }
        ListHeaderComponent={
          <>
            {/* شريط القصص فوق الدائرة — مكانه في الويب نفسه. */}
            <StoryStrip rings={rings.data?.rings ?? []} meId={me?.id ?? ""} />

            {data && data.requests.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", marginBottom: 8 }}>
                طلبات ({ar(data.requests.length)})
              </Text>
              {data.requests.map((request) => (
                <View
                  key={request.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 12,
                    marginBottom: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: colors.card,
                  }}
                >
                  <Avatar
                    name={request.requester.name}
                    size={40}
                    mediaId={request.requester.avatarMediaId}
                    frameSpec={request.requester.frame?.spec}
                    charm={request.requester.charm}
                  />
                  <Text style={{ flex: 1, color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>
                    {request.requester.name}
                  </Text>
                  <Pressable
                    onPress={() => answer.mutate({ id: request.id, accept: true })}
                    style={{ height: 36, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
                  >
                    <Text style={{ color: colors.onBrand, fontSize: 12, fontWeight: "700" }}>قبول</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => answer.mutate({ id: request.id, accept: false })}
                    style={{ height: 36, paddingHorizontal: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12 }}>تجاهل</Text>
                  </Pressable>
                </View>
              ))}
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          /*
            أدوات القطع تُجمع في الصفّ لا في الملف: الملف يُقرأ، والسحب
            يكشف «حظر» و«إزالة» معاً. وشرط آبل محفوظ: الحظر موجود.
          */
          <SwipeRow
            onDelete={() => void cut.mutate(item.id)}
            confirmLabel="إزالة"
            onSecond={() => void ban.mutate(item.id)}
            secondLabel="حظر"
          >
          <Pressable
            onPress={() => router.push(`/u/${item.id}` as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <Avatar
              name={item.name}
              size={44}
              mediaId={item.avatarMediaId}
              frameSpec={item.frame?.spec}
              charm={item.charm}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>{item.name}</Text>
              <Text style={{ color: colors.faint, fontSize: 11.5 }}>
                {[item.city, presence(item.lastSeenAt)].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Pressable>
          </SwipeRow>
        )}
        ListEmptyComponent={
          circle.isLoading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.clay} />
            </View>
          ) : (
            <View style={{ paddingTop: 60, paddingHorizontal: 40 }}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 24 }}>
                دائرتك فارغة. لا بحث هنا — من يجمعك به صديقٌ مشترك يظهر لك في المقترحين.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
