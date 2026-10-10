import { BlockIcon, CheckIcon, MessageIcon, TagIcon, UserMinusIcon } from "../../components/icons";
import { Sheet } from "../../components/sheet";
import { useTabTop } from "../../lib/tab-top";
import { TabBackdrop } from "../../components/tab-backdrop";
import { useBarSpace } from "../../components/glass-bar";
import { scrolled } from "../../lib/scrolled";
import { useCallback, useRef, useState } from "react";
import { View, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Text, TextInput } from "../../components/type";
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
/*
  تبويبٌ واحد — **بقرار المالك** (القاعدة ٢٦٨): القصصُ في أعلاه ثمّ الأصدقاء،
  و«تصنيفاتي» ذهبت بابًا مستقلّاً: التصنيفُ يُختار من سحبة صفّ الصديق نفسه.
  و«مقترحون» ذهب قبلها (القاعدة ٢٢٧).
*/

type Member = NonNullable<ReturnType<typeof useCircle>["data"]>["members"][number];
/** رأسُ قسمٍ في «أصدقائي»: متصلٌ أو غير متصل، يُطوى ويُفتح. */
type Head = { id: string; head: "online" | "offline"; count: number };
type Row = Member | Head;

/** متصلٌ من ظهر في آخر ثلاث دقائق — العتبةُ نفسها في `presence()`. */
const onlineNow = (lastSeenAt: string | null) =>
  Boolean(lastSeenAt) && Date.now() - new Date(lastSeenAt as string).getTime() < 3 * 60_000;

export default function Circle() {
  // ضغطةُ التبويب المفتوح ترجع إلى أعلاه (القاعدة ١٥٧).
  const list = useRef<Pick<FlatList, "scrollToOffset"> | null>(null);
  useTabTop(() => list.current?.scrollToOffset({ offset: 0, animated: true }));
  // المحتوى يمرّ تحت الشريط الزجاجيّ، وآخرُه يُقرأ فوقه (القاعدة ٢٢٨).
  const barSpace = useBarSpace();
  /* الصديقُ الذي تُفتح له نافذةُ التصنيف، واسمُ تصنيفٍ جديدٍ يُكتب فيها. */
  const [picking, setPicking] = useState<Member | null>(null);
  const [fresh, setFresh] = useState("");
  /* صفٌّ يُسحب يوقف تمرير القائمة: وإلّا تحرّكت الشاشةُ كلّها مع الإصبع. */
  const [swiping, setSwiping] = useState(false);
  /* قسما «أصدقائي» — ما طُوي منهما يبقى رأسُه وحده. */
  // والطلباتُ قسمٌ يُطوى كقسمَي المتصلين — **بقرار المالك**.
  const [folded, setFolded] = useState<{ online: boolean; offline: boolean; requests: boolean }>({
    online: false,
    offline: false,
    requests: false,
  });
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

  /* تصنيفٌ جديدٌ من النافذة نفسها، ويُصنَّف فيه الصديقُ في الحال. */
  const addGroup = useMutation({
    mutationFn: async ({ name, friendId }: { name: string; friendId: string }) => {
      const { group } = await api<{ group: { id: string } }>("/v1/circle/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await api(`/v1/circle/${friendId}/group`, { method: "PUT", body: JSON.stringify({ groupId: group.id }) });
    },
    onSuccess: () => {
      setFresh("");
      setPicking(null);
    },
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
      <TabBackdrop />
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
        ref={(node) => { list.current = node; }}
        // التمريرُ يطوي صفّاً مسحوباً مفتوحاً (القاعدة ٢١٣).
        onScrollBeginDrag={scrolled}
        /*
          قائمةٌ واحدة لثلاثة أبواب: صفوفها تختلف شكلاً لا مكاناً، فتبقى
          الأبواب فوقها ثابتة ويتبدّل ما تحتها — كعدسات الخط الزمني.
        */
        data={sectioned}
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
            {/* شريط القصص فوق الدائرة — مكانه في الويب نفسه. */}
            <StoryStrip rings={rings.data?.rings ?? []} meId={me?.id ?? ""} />

            {data && data.requests.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Pressable
                onPress={() => setFolded((was) => ({ ...was, requests: !was.requests }))}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.clay }} />
                <Text style={{ flex: 1, color: colors.groundInk, fontSize: 14, fontWeight: "700" }}>
                  طلبات الصداقة ({ar(data.requests.length)})
                </Text>
                <Text style={{ color: colors.groundMuted, fontSize: 12, fontWeight: "600" }}>
                  {folded.requests ? "إظهار" : "إخفاء"}
                </Text>
              </Pressable>
              {folded.requests ? null : data.requests.map((request) => (
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
                <Text style={{ flex: 1, color: colors.groundInk, fontSize: 13.5, fontWeight: "700" }}>
                  {item.head === "online" ? "متصل" : "غير متصل"} ({ar(item.count)})
                </Text>
                <Text style={{ color: colors.groundMuted, fontSize: 12, fontWeight: "600" }}>
                  {open ? "إخفاء" : "إظهار"}
                </Text>
              </Pressable>
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
            extra={{ label: "تصنيف", run: () => setPicking(friend) }}
            onSwiping={setSwiping}
            surface={colors.card}
            width={60}
            icons={{
              lead: <MessageIcon size={22} color={colors.onBrand} />,
              extra: <TagIcon size={22} color={colors.night} />,
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
                {[friend.city, presence(friend.lastSeenAt)].filter(Boolean).join("  |  ")}
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
              <Text style={{ color: colors.groundMuted, fontSize: 13.5, textAlign: "center", lineHeight: 24 }}>
                دائرتك فارغة. لا بحث هنا — شارك رابط ملفك من «أنا» مع من تعرفهم، ومن يفتحه يضيفك.
              </Text>
            </View>
          )
        }
      />

      {/*
        نافذةُ التصنيف (القاعدة ٢٦٨): تصنيفاتُك بعلامةٍ على الحاليّ، و«بلا تصنيف»،
        ثمّ حقلٌ يُنشئ تصنيفاً ويضع الصديقَ فيه بضغطةٍ واحدة. والتصنيفُ لك
        وحدك (القاعدة ٢٢): من صنّفته لا يراه.
      */}
      {picking ? (
        <Sheet title={`تصنيف ${picking.name}`} onClose={() => { setPicking(null); setFresh(""); }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20, marginBottom: 10 }}>
            التصنيف لك وحدك — لا يراه هو ولا غيرك.
          </Text>
          {[...groups, { id: "", name: "بلا تصنيف", count: 0 }].map((group) => {
            const on = (picking.groupId ?? "") === group.id;
            return (
              <Pressable
                key={group.id || "none"}
                onPress={() => {
                  place.mutate({ id: picking.id, groupId: group.id || null });
                  setPicking(null);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 14, marginBottom: 6, borderRadius: 12, borderWidth: 1, borderColor: on ? colors.clay : colors.line, backgroundColor: on ? colors.claySoft : colors.paper }}
              >
                <Text style={{ flex: 1, color: group.id ? colors.ink : colors.muted, fontSize: 14, fontWeight: on ? "700" : "500" }}>
                  {group.name}
                </Text>
                {on ? <CheckIcon size={18} color={colors.clay} /> : null}
              </Pressable>
            );
          })}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <TextInput
              value={fresh}
              onChangeText={(value) => setFresh(value.slice(0, 30))}
              placeholder="تصنيف جديد… (عائلة، العمل)"
              placeholderTextColor={colors.faint}
              style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14, color: colors.ink, fontSize: 14, textAlign: "right" }}
            />
            <Pressable
              disabled={!fresh.trim() || addGroup.isPending}
              onPress={() => addGroup.mutate({ name: fresh.trim(), friendId: picking.id })}
              style={{ height: 46, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, opacity: !fresh.trim() || addGroup.isPending ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>إضافة تصنيف</Text>
            </Pressable>
          </View>
          {addGroup.error ? (
            <Text style={{ color: colors.live, fontSize: 12, marginTop: 8 }}>{(addGroup.error as Error).message}</Text>
          ) : null}
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}
