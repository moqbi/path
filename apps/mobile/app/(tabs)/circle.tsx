import { BlockIcon, MessageIcon, UserMinusIcon } from "../../components/icons";
import { useBarSpace } from "../../components/glass-bar";
import { scrolled } from "../../lib/scrolled";
import { useCallback, useState } from "react";
import { View, FlatList, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { SwipeRow } from "../../components/swipe-row";
import { ScreenHeader } from "../../components/screen-header";
import { StoryStrip } from "../../components/stories";
import { api } from "../../lib/api";
import { keys, useCircle, useRings } from "../../lib/queries";
import { usePullRefresh } from "../../lib/refresh";
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
/**
 * بابا الدائرة. و«مقترحون» ذهب — **بقرار المالك** (القاعدة ٢٢٧): الإضافةُ برابط
 * الملف الذي يعطيه صاحبُه، لا بقائمةٍ تعرض أصدقاء الأصدقاء.
 */
const TABS = [
  { key: "friends", label: "أصدقائي" },
  { key: "groups", label: "تصنيفاتي" },
] as const;

type Tab = (typeof TABS)[number]["key"];

type Member = NonNullable<ReturnType<typeof useCircle>["data"]>["members"][number];
/** رأسُ قسمٍ في «أصدقائي»: متصلٌ أو غير متصل، يُطوى ويُفتح. */
type Head = { id: string; head: "online" | "offline"; count: number };
type Row = Member | Head;

/** متصلٌ من ظهر في آخر ثلاث دقائق — العتبةُ نفسها في `presence()`. */
const onlineNow = (lastSeenAt: string | null) =>
  Boolean(lastSeenAt) && Date.now() - new Date(lastSeenAt as string).getTime() < 3 * 60_000;

export default function Circle() {
  // المحتوى يمرّ تحت الشريط الزجاجيّ، وآخرُه يُقرأ فوقه (القاعدة ٢٢٨).
  const barSpace = useBarSpace();
  const [tab, setTab] = useState<Tab>("friends");
  /* التصنيفُ المختار في «تصنيفاتي» — الفراغُ يعني «الكل». */
  const [groupFilter, setGroupFilter] = useState("");
  /* صفٌّ يُسحب يوقف تمرير القائمة: وإلّا تحرّكت الشاشةُ كلّها مع الإصبع. */
  const [swiping, setSwiping] = useState(false);
  /* قسما «أصدقائي» — ما طُوي منهما يبقى رأسُه وحده. */
  const [folded, setFolded] = useState<{ online: boolean; offline: boolean }>({ online: false, offline: false });
  const circle = useCircle();
  const rings = useRings();
  /*
    الطلباتُ الواردة تُسأل عنها مع كل دخولٍ إلى التبويب: كانت الذاكرةُ
    تُبقي ما جُلب قبل نصف دقيقة، فيصل الطلبُ متأخّراً وكأنّه لم يُرسل.
  */
  const refetchCircle = circle.refetch;
  useFocusEffect(
    useCallback(() => {
      void refetchCircle();
    }, [refetchCircle]),
  );
  const pullRefresh = usePullRefresh(() => Promise.all([circle.refetch(), rings.refetch()]));
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

  /* المحادثة من صفّ الصديق: السحبُ يكشفها مع الإزالة والحظر. */
  const talk = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/v1/dm/with/${id}`, { method: "POST" }),
    onSuccess: (row) => router.push(`/dm/${row.id}` as never),
  });


  const data = circle.data;
  const groups = data?.groups ?? [];

  /*
    «أصدقائي» قسمان — **بقرار المالك**: متصلٌ الآن، ثمّ غيرُ متصل، ولكلٍّ
    رأسٌ يُطوى ويُفتح. من يبحث عمّن يكلّمه الآن لا يمرّ بمئةٍ وخمسين.
  */
  const members = data?.members ?? [];
  const online = members.filter((member) => onlineNow(member.lastSeenAt));
  const offline = members.filter((member) => !onlineNow(member.lastSeenAt));
  const sectioned: Row[] = members.length
    ? [
        { id: "head-online", head: "online", count: online.length },
        ...(folded.online ? [] : online),
        { id: "head-offline", head: "offline", count: offline.length },
        ...(folded.offline ? [] : offline),
      ]
    : [];

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
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
        // التمريرُ يطوي صفّاً مسحوباً مفتوحاً (القاعدة ٢١٣).
        onScrollBeginDrag={scrolled}
        /*
          قائمةٌ واحدة لثلاثة أبواب: صفوفها تختلف شكلاً لا مكاناً، فتبقى
          الأبواب فوقها ثابتة ويتبدّل ما تحتها — كعدسات الخط الزمني.
        */
        data={
          (tab === "groups"
            ? groupFilter
              ? (data?.members ?? []).filter((member) => member.groupId === groupFilter)
              : (data?.members ?? [])
            : sectioned) as Row[]
        }
        keyExtractor={(item) => item.id}
        scrollEnabled={!swiping}
        contentContainerStyle={{ paddingBottom: barSpace + 8, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            {...pullRefresh}
            tintColor={colors.clay}
          />
        }
        ListHeaderComponent={
          <>
            {/* البابان: أصدقائي وتصنيفاتي. */}
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

                {/*
                  التصنيفاتُ شرائحُ تُفلتر لا لافتاتٌ تُقرأ: اختيارُ «عائلة» يُبقي
                  من صنّفتَهم عائلةً وحدهم، و«الكل» يعيد الجميع.
                */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                  {[{ id: "", name: "الكل", count: data?.members.length ?? 0 }, ...groups].map((group) => {
                    const on = groupFilter === group.id;
                    return (
                      <Pressable
                        key={group.id || "all"}
                        onPress={() => setGroupFilter(group.id)}
                        style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? colors.clay : colors.line, backgroundColor: on ? colors.clay : colors.card }}
                      >
                        <Text style={{ color: on ? colors.onBrand : colors.ink2, fontSize: 12, fontWeight: on ? "700" : "400" }}>
                          {group.name} ({ar(group.count)})
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => router.push("/settings" as never)}
                    style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: colors.line }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>+ تصنيف</Text>
                  </Pressable>
                </View>
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
                    frame={request.requester.frame}
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
          if ("head" in item) {
            const open = !folded[item.head];
            return (
              <Pressable
                onPress={() => setFolded((was) => ({ ...was, [item.head]: !was[item.head] }))}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 2 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: item.head === "online" ? colors.live : colors.faint,
                  }}
                />
                <Text style={{ flex: 1, color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>
                  {item.head === "online" ? "متصل" : "غير متصل"} ({ar(item.count)})
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
                  {open ? "إخفاء" : "إظهار"}
                </Text>
              </Pressable>
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
                    frame={member.frame}
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
          /*
            وكلُّ صديقٍ في قالبه كالتصنيفات: صفوفٌ عائمةٌ على
            الورق تُقرأ قائمةً واحدة لا أشخاصاً. والسحبُ يكشف «محادثة» مع
            أداتَي القطع — الفعلُ الأكثرُ مع الصديق لا يحتاج فتحَ ملفّه.
          */
          <View style={{ marginHorizontal: 16, marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }}>
          <SwipeRow
            onDelete={() => void cut.mutate(friend.id)}
            confirmLabel="إزالة"
            onSecond={() => void ban.mutate(friend.id)}
            secondLabel="حظر"
            lead={{ label: "محادثة", run: () => void talk.mutate(friend.id) }}
            onSwiping={setSwiping}
            surface={colors.card}
            width={60}
            icons={{
              lead: <MessageIcon size={22} color={colors.onBrand} />,
              second: <BlockIcon size={22} color="#f7f5ef" />,
              delete: <UserMinusIcon size={22} color="#fff" />,
            }}
          >
          <Pressable
            onPress={() => router.push(`/u/${friend.id}` as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}
          >
            <Avatar
              name={friend.name}
              size={44}
              mediaId={friend.avatarMediaId}
              frame={friend.frame}
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
          </View>
          );
        }}
        ListEmptyComponent={
          circle.isLoading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.clay} />
            </View>
          ) : (
            /* لكل بابٍ فراغُه. */
            <View style={{ paddingTop: 60, paddingHorizontal: 40 }}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 24 }}>
                {tab === "groups" && groupFilter
                  ? "ما في هذا التصنيف أحدٌ بعد. اختر «الكل» وصنّف من شئت."
                  : "دائرتك فارغة. لا بحث هنا — شارك رابط ملفك من «أنا» مع من تعرفهم، ومن يفتحه يضيفك."}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
