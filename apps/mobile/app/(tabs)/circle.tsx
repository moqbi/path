import { useState } from "react";
import { View, Text, FlatList, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { SwipeRow } from "../../components/swipe-row";
import { ScreenHeader } from "../../components/screen-header";
import { StoryStrip } from "../../components/stories";
import { api } from "../../lib/api";
import { keys, useCircle, useRings, useSuggestions } from "../../lib/queries";
import { ar, presence } from "../../lib/format";
import { useSession } from "../../lib/session";
import { NameTag } from "../../components/name-tag";
import { colors } from "../../theme/tokens";

/**
 * الدائرة.
 *
 * الطلبات الواردة أولاً — فعلٌ ينتظرك يسبق قائمةً تتصفّحها — ثم الأصدقاء
 * وما بقي من السقف. والسقف مكتوبٌ دائماً: مئةٌ وخمسون قرارُ منتَج يُرى،
 * لا حدٌّ يُكتشف حين يُبلَغ.
 */
/** أبواب الدائرة الثلاثة — أسماؤها وترتيبها كما في الويب. */
const TABS = [
  { key: "friends", label: "أصدقائي" },
  { key: "groups", label: "تصنيفاتي" },
  { key: "suggested", label: "مقترحون" },
] as const;

type Tab = (typeof TABS)[number]["key"];

type Member = NonNullable<ReturnType<typeof useCircle>["data"]>["members"][number];
type Suggested = NonNullable<ReturnType<typeof useSuggestions>["data"]>["people"][number];
type Row = Member | Suggested;

export default function Circle() {
  const [tab, setTab] = useState<Tab>("friends");
  const circle = useCircle();
  const suggested = useSuggestions();
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

  /** التصنيف يملكه صاحبه: يُكتب من هنا ولا يراه من صُنِّف. */
  const place = useMutation({
    mutationFn: ({ id, groupId }: { id: string; groupId: string | null }) =>
      api(`/v1/circle/${id}/group`, { method: "PUT", body: JSON.stringify({ groupId }) }),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.circle }),
  });

  const ask = useMutation({
    mutationFn: (id: string) => api(`/v1/circle/${id}/request`, { method: "POST" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.suggestions });
      void client.invalidateQueries({ queryKey: keys.circle });
    },
  });

  const data = circle.data;
  const groups = data?.groups ?? [];
  const people = suggested.data?.people ?? [];

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
        /*
          قائمةٌ واحدة لثلاثة أبواب: صفوفها تختلف شكلاً لا مكاناً، فتبقى
          الأبواب فوقها ثابتة ويتبدّل ما تحتها — كعدسات الخط الزمني.
        */
        data={(tab === "suggested" ? people : (data?.members ?? [])) as Row[]}
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
            {/* الأبواب الثلاثة: أصدقائي، تصنيفاتي، مقترحون. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
            >
              {TABS.map((item) => {
                const on = item.key === tab;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setTab(item.key)}
                    style={{
                      height: 36,
                      paddingHorizontal: 16,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: on ? colors.clay : colors.line,
                      backgroundColor: on ? colors.clay : colors.card,
                    }}
                  >
                    <Text style={{ color: on ? colors.onBrand : colors.ink2, fontSize: 12.5, fontWeight: "600" }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {tab === "groups" ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 10 }}>
                  التصنيف لك وحدك: من صنّفته «عائلة» لا يرى تصنيفك ولا يراه غيرك.
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                  {groups.map((group) => (
                    <View
                      key={group.id}
                      style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
                    >
                      <Text style={{ color: colors.ink2, fontSize: 12 }}>
                        {group.name} ({ar(group.count)})
                      </Text>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => router.push("/settings/privacy" as never)}
                    style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: colors.line }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>+ تصنيف</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {tab === "suggested" ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700", marginBottom: 4 }}>
                  أشخاص قد تعرفهم
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19 }}>
                  لا بحث بالاسم ولا بالبريد — من يظهر هنا يجمعك به صديق مشترك.
                </Text>
              </View>
            ) : null}

            {tab === "friends" ? (
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
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          if (tab === "suggested") {
            const person = item as Suggested;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 12 }}>
                <Pressable onPress={() => router.push(`/u/${person.id}` as never)}>
                  <Avatar
                    name={person.name}
                    size={44}
                    mediaId={person.avatarMediaId}
                    frameSpec={person.frame?.spec}
                    charm={person.charm}
                  />
                </Pressable>

                <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => router.push(`/u/${person.id}` as never)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.ink, fontSize: 14, fontWeight: "600", flexShrink: 1, writingDirection: "auto" }}
                    >
                      {person.name}
                    </Text>
                    <NameTag isPlus={person.isPlus} tag={person.tag} size={10} />
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.faint, fontSize: 11.5 }}>
                    {person.mutual === 1
                      ? "صديق مشترك واحد"
                      : `مشترك معك في ${ar(person.mutual)} أصدقاء`}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => ask.mutate(person.id)}
                  disabled={ask.isPending}
                  style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
                >
                  <Text style={{ color: colors.onBrand, fontSize: 12.5, fontWeight: "700" }}>إضافة</Text>
                </Pressable>
              </View>
            );
          }

          if (tab === "groups") {
            const member = item as Member;
            return (
              <View style={{ marginHorizontal: 16, marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 12, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Avatar
                    name={member.name}
                    size={38}
                    mediaId={member.avatarMediaId}
                    frameSpec={member.frame?.spec}
                    charm={member.charm}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, minWidth: 0, color: colors.ink, fontSize: 14, fontWeight: "600", writingDirection: "auto" }}
                  >
                    {member.name}
                  </Text>
                  <NameTag isPlus={member.isPlus} tag={member.tag} size={10} />
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {groups.map((group) => {
                    const on = member.groupId === group.id;
                    return (
                      <Pressable
                        key={group.id}
                        onPress={() => place.mutate({ id: member.id, groupId: on ? null : group.id })}
                        style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? colors.clay : colors.line, backgroundColor: on ? colors.clay : "transparent" }}
                      >
                        <Text style={{ color: on ? colors.onBrand : colors.ink2, fontSize: 12, fontWeight: "600" }}>
                          {group.name}
                        </Text>
                      </Pressable>
                    );
                  })}

                  {member.groupId ? (
                    <Pressable
                      onPress={() => place.mutate({ id: member.id, groupId: null })}
                      style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line }}
                    >
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>بلا تصنيف</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }

          const friend = item as Member;
          return (
          /*
            أدوات القطع تُجمع في الصفّ لا في الملف: الملف يُقرأ، والسحب
            يكشف «حظر» و«إزالة» معاً. وشرط آبل محفوظ: الحظر موجود.
          */
          <SwipeRow
            onDelete={() => void cut.mutate(friend.id)}
            confirmLabel="إزالة"
            onSecond={() => void ban.mutate(friend.id)}
            secondLabel="حظر"
          >
          <Pressable
            onPress={() => router.push(`/u/${friend.id}` as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <Avatar
              name={friend.name}
              size={44}
              mediaId={friend.avatarMediaId}
              frameSpec={friend.frame?.spec}
              charm={friend.charm}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.ink, fontSize: 14, fontWeight: "600", flexShrink: 1, writingDirection: "auto" }}
                >
                  {friend.name}
                </Text>
                <NameTag isPlus={friend.isPlus} tag={friend.tag} size={10} />
              </View>
              <Text style={{ color: colors.faint, fontSize: 11.5 }}>
                {[friend.city, presence(friend.lastSeenAt)].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </Pressable>
          </SwipeRow>
          );
        }}
        ListEmptyComponent={
          (tab === "suggested" ? suggested.isLoading : circle.isLoading) ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.clay} />
            </View>
          ) : (
            /* لكل بابٍ فراغُه: «ما فيه مقترحون» في صفحة الأصدقاء لا معنى له. */
            <View style={{ paddingTop: 60, paddingHorizontal: 40 }}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 24 }}>
                {tab === "suggested"
                  ? "ما فيه مقترحون. حين يكبر عدد أصدقائك يظهر هنا من يعرفونهم."
                  : "دائرتك فارغة. لا بحث هنا — من يجمعك به صديقٌ مشترك يظهر لك في المقترحين."}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
