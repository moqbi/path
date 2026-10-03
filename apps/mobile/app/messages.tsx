import { useState } from "react";
import { scrolled } from "../lib/scrolled";
import { View, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Text, TextInput } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Avatar } from "../components/avatar";
import { SwipeRow } from "../components/swipe-row";
import { ScreenHeader } from "../components/screen-header";
import { Ticks, receiptOf } from "../components/receipt";
import { CameraIcon, MicIcon, PlusIcon, SearchIcon, StarIcon, TrashIcon, WithIcon } from "../components/icons";
import { Modal } from "react-native";
import type { GroupRow } from "../lib/groups";
import { api } from "../lib/api";
import { keys, useCircle } from "../lib/queries";
import { usePullRefresh } from "../lib/refresh";
import { useSession } from "../lib/session";
import { ar, presence, relative } from "../lib/format";
import { NameTag } from "../components/name-tag";
import { colors } from "../theme/tokens";

type Row = {
  id: string;
  updatedAt: string;
  other: {
    id: string;
    name: string;
    isPlus: boolean;
    lastSeenAt: string | null;
    avatarMediaId: string | null;
    frame: { spec: string; mediaId: string | null; frameHole?: number | null } | null;
    charm: { spec: string; mediaId: string | null } | null;
    tag: { name: string; bg: string; fg: string } | null;
  };
  last: {
    id: string;
    body: string;
    kind: "TEXT" | "VOICE" | "PHOTO";
    seconds: number | null;
    senderId: string;
    createdAt: string;
    deliveredAt: string | null;
    readAt: string | null;
  } | null;
  unseen: number;
  /** مفضّلةٌ مثبّتةٌ أعلى القائمة (القاعدة ٢٢٠) — اختياريٌّ لخادمٍ أقدم. */
  pinned?: boolean;
};

/** رأسُ قسمٍ في القائمة: المفضّلة أو بقيّة المحادثات، يُطوى ويُفتح. */
type Head = { id: string; head: "pinned" | "rest"; count: number };

/** حدُّ المفضّلة — كالخادم (`PIN_MAX`). */
const PIN_MAX = 3;

/** خلاصةُ آخر رسالة: الصوت والصورة يُقالان لا يُتركان فارغين. */
function Last({ row, meId }: { row: Row; meId: string }) {
  const last = row.last;
  if (!last) return <Text style={{ color: colors.faint, fontSize: 12 }}>لا رسائل بعد</Text>;

  const mine = last.senderId === meId;
  const text =
    last.kind === "VOICE"
      ? `رسالة صوتية · ${ar(last.seconds ?? 0)} ثانية`
      : last.kind === "PHOTO"
        ? "صورة"
        : last.body;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      {mine ? <Ticks state={receiptOf(last)} size={14} /> : null}
      {last.kind === "VOICE" ? <MicIcon size={12} color={colors.muted} /> : null}
      {last.kind === "PHOTO" ? <CameraIcon size={12} color={colors.muted} /> : null}
      <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 12 }}>
        {text}
      </Text>
    </View>
  );
}

export default function Messages() {
  const me = useSession((s) => s.me);
  const router = useRouter();

  const client = useQueryClient();

  const list = useQuery({
    queryKey: keys.dm,
    queryFn: () => api<{ conversations: Row[] }>("/v1/dm"),
    refetchInterval: 20_000,
  });

  /** حذف المحادثة: تُكشف بالسحب كما في الويب، لا بزرٍّ دائمٍ في الصفّ. */
  /* المجموعات فوق المحادثات (القاعدة ٢١٥): قليلةٌ ومنها يأتي أكثرُ الكلام. */
  const groupList = useQuery({
    queryKey: keys.groups,
    queryFn: () => api<{ groups: GroupRow[] }>("/v1/groups"),
    refetchInterval: 20_000,
  });

  const pullRefresh = usePullRefresh(() => Promise.all([list.refetch(), groupList.refetch()]));
  /*
    المفضّلة (القاعدة ٢٢٠): نجمةٌ بجانب الحذف في السحبة، تثبّت المحادثة أعلى
    القائمة أو تفكّها. وثلاثٌ حدّاً — والرابعةُ تفتح نافذةً في وسط الشاشة تقول
    ما يجري وما يُفعل، قبل أن يُسأل الخادم: الشاشةُ تعرف كم مثبّتاً عندها.
  */
  const [pinFull, setPinFull] = useState(false);
  const pinned = (list.data?.conversations ?? []).filter((row) => row.pinned).length;
  const togglePin = useMutation({
    mutationFn: (row: Row) =>
      api(`/v1/dm/${row.id}/pin`, { method: row.pinned ? "DELETE" : "POST" }),
    onSuccess: async () => client.invalidateQueries({ queryKey: keys.dm }),
    onError: () => setPinFull(true),
  });
  const pin = (row: Row) => {
    if (!row.pinned && pinned >= PIN_MAX) {
      setPinFull(true);
      return;
    }
    togglePin.mutate(row);
  };

  const drop = useMutation({
    mutationFn: (id: string) => api(`/v1/dm/${id}`, { method: "DELETE" }),
    onSuccess: async () => client.invalidateQueries({ queryKey: keys.dm }),
  });

  /*
    البحثُ باسم الصديق — **بقرار المالك**: في المحادثات القائمة أوّلاً، ثمّ
    في أصدقائك ممّن لا محادثةَ معهم فتُبدأ من هنا. والبحثُ في دائرتك
    وحدها: لا بابَ منه إلى من ليس فيها (القاعدة ٢٠).
  */
  const [query, setQuery] = useState("");
  const circle = useCircle();
  const needle = query.trim().toLowerCase();
  const conversations = (list.data?.conversations ?? []).filter(
    (row) => !needle || row.other.name.toLowerCase().includes(needle),
  );
  /*
    المفضّلةُ قسمٌ وبقيّةُ المحادثات قسمٌ — **بقرار المالك**، ولكلٍّ رأسٌ يُطوى
    ويُفتح كقسمَي «متصل» و«غير متصل» في الأصدقاء. والبحثُ يفتح القسمين: من
    يبحث عن اسمٍ لا يُخفى عنه ما وجده. وبلا مفضّلةٍ لا رأسَ لها.
  */
  const [folded, setFolded] = useState({ pinned: false, rest: false });
  const favs = conversations.filter((row) => row.pinned);
  const rest = conversations.filter((row) => !row.pinned);
  const shut = (head: "pinned" | "rest") => folded[head] && !needle;
  const rows: (Row | Head)[] = conversations.length
    ? [
        ...(favs.length
          ? [{ id: "head-pinned", head: "pinned", count: favs.length } as Head, ...(shut("pinned") ? [] : favs)]
          : []),
        ...(rest.length
          ? [{ id: "head-rest", head: "rest", count: rest.length } as Head, ...(shut("rest") ? [] : rest)]
          : []),
      ]
    : [];
  const talking = new Set((list.data?.conversations ?? []).map((row) => row.other.id));
  const groups = (groupList.data?.groups ?? []).filter(
    (row) => !needle || row.name.toLowerCase().includes(needle),
  );
  const others = needle
    ? (circle.data?.members ?? []).filter(
        (person) => !talking.has(person.id) && person.name.toLowerCase().includes(needle),
      )
    : [];
  const start = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/v1/dm/with/${id}`, { method: "POST" }),
    onSuccess: (row) => router.push(`/dm/${row.id}` as never),
  });

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader
        title="المحادثات"
        back="/"
        right={
          // إنشاءُ المجموعة للمشرف وحده (القاعدة ٢١٥).
          me?.canGroups ? (
            <Pressable
              accessibilityLabel="مجموعة جديدة"
              onPress={() => router.push("/group/manage" as never)}
              hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }}
            >
              <PlusIcon size={19} color="#f7f5ef" />
            </Pressable>
          ) : undefined
        }
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 42,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.card,
          }}
        >
          <SearchIcon size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث باسم صديق"
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            style={{ flex: 1, color: colors.ink, fontSize: 14, textAlign: "right" }}
          />
        </View>
      </View>

      <FlatList
        // التمريرُ يطوي صفّاً مسحوباً مفتوحاً (القاعدة ٢١٣).
        onScrollBeginDrag={scrolled}
        keyboardShouldPersistTaps="handled"
        data={rows}
        ListHeaderComponent={
          groups.length > 0 ? (
            <View style={{ paddingBottom: 4 }}>
              {groups.map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => router.push(`/group/${row.id}` as never)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 20, paddingVertical: 11 }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.claySoft }}>
                    <WithIcon size={22} color={colors.clayInk} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "600", flexShrink: 1, writingDirection: "auto" }}>
                        {row.name}
                      </Text>
                      <Text style={{ color: colors.faint, fontSize: 10.5 }}>
                        {row.last ? relative(new Date(row.last.createdAt)) : `${ar(row.members)} عضو`}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                      {row.last
                        ? `${row.last.senderId === me?.id ? "أنت" : row.last.sender.name}: ${row.last.kind === "PHOTO" ? "صورة" : row.last.body}`
                        : "لا رسائل بعد"}
                    </Text>
                  </View>
                  {row.unseen > 0 ? (
                    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}>
                      <Text style={{ color: colors.onBrand, fontSize: 10.5, fontWeight: "700" }}>{ar(row.unseen)}</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))}
              {conversations.length > 0 ? (
                <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: 20, marginVertical: 4 }} />
              ) : null}
            </View>
          ) : null
        }
        ListFooterComponent={
          others.length > 0 ? (
            <View style={{ paddingTop: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", paddingHorizontal: 20, paddingBottom: 4 }}>
                أصدقاء بلا محادثة
              </Text>
              {others.map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => start.mutate(person.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 20, paddingVertical: 10 }}
                >
                  <Avatar name={person.name} size={40} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: "600", writingDirection: "auto" }}>
                    {person.name}
                  </Text>
                  <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "700" }}>ابدأ محادثة</Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
        refreshControl={
          <RefreshControl {...pullRefresh} tintColor={colors.clay} />
        }
        renderItem={({ item: entry }) => {
          if ("head" in entry) {
            const open = !shut(entry.head);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setFolded((was) => ({ ...was, [entry.head]: !was[entry.head] }))}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 12, marginBottom: 2 }}
              >
                {entry.head === "pinned" ? <StarIcon size={14} color={colors.gold} /> : null}
                <Text style={{ flex: 1, color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>
                  {entry.head === "pinned" ? "المفضّلة" : "المحادثات"} ({ar(entry.count)})
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{open ? "إخفاء" : "إظهار"}</Text>
              </Pressable>
            );
          }
          const item = entry;
          return (
          <SwipeRow
            onDelete={() => void drop.mutate(item.id)}
            confirmLabel="حذف المحادثة"
            onSecond={() => pin(item)}
            secondLabel={item.pinned ? "شيلها من المفضّلة" : "أضفها للمفضّلة"}
            icons={{
              delete: <TrashIcon size={22} color="#fff" />,
              second: <StarIcon size={22} color={item.pinned ? colors.gold : "#fff"} />,
            }}
          >
          <Pressable
            onPress={() => router.push(`/dm/${item.id}` as never)}
            style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 20, paddingVertical: 11 }}
          >
            <Avatar
              name={item.other.name}
              size={46}
              mediaId={item.other.avatarMediaId}
              frame={item.other.frame}
              charm={item.other.charm}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.ink, fontSize: 14, fontWeight: "600", flexShrink: 1, writingDirection: "auto" }}
                >
                  {item.other.name}
                </Text>
                <NameTag isPlus={item.other.isPlus} tag={item.other.tag} size={10} />
                {item.pinned ? <StarIcon size={12} color={colors.gold} /> : null}
                <Text style={{ color: colors.faint, fontSize: 10.5 }}>
                  {item.last ? relative(new Date(item.last.createdAt)) : presence(item.other.lastSeenAt)}
                </Text>
              </View>
              <Last row={item} meId={me?.id ?? ""} />
            </View>

            {item.unseen > 0 ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}>
                <Text style={{ color: colors.onBrand, fontSize: 10.5, fontWeight: "700" }}>
                  {ar(item.unseen)}
                </Text>
              </View>
            ) : null}
          </Pressable>
          </SwipeRow>
          );
        }}
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
          ) : groups.length > 0 ? null : needle ? (
            others.length > 0 ? null : (
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", marginTop: 40 }}>
                لا أحد بهذا الاسم في دائرتك.
              </Text>
            )
          ) : (
            <View style={{ marginTop: 50, paddingHorizontal: 40 }}>
              <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", lineHeight: 24 }}>
                لا محادثات بعد. افتح ملف صديقٍ وابدأ منه.
              </Text>
            </View>
          )
        }
      />
      {/* المفضّلةُ ملأى: نافذةٌ في الوسط تقول الحدَّ وما يُفعل — بلهجتنا. */}
      <Modal visible={pinFull} transparent animationType="fade" onRequestClose={() => setPinFull(false)}>
        <Pressable
          onPress={() => setPinFull(false)}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "rgba(14,26,36,.55)" }}
        >
          <Pressable
            onPress={() => undefined}
            style={{ width: "100%", maxWidth: 340, borderRadius: 22, padding: 24, alignItems: "center", gap: 12, backgroundColor: colors.card }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft }}>
              <StarIcon size={28} color={colors.gold} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", textAlign: "center" }}>
              المفضّلة فلّت!
            </Text>
            <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 24, textAlign: "center" }}>
              تقدر تثبّت {ar(PIN_MAX)} محادثات بس. شيل وحدة من المفضّلة، وبعدها ثبّت هذي مكانها.
            </Text>
            <Pressable
              onPress={() => setPinFull(false)}
              style={{ alignSelf: "stretch", height: 48, marginTop: 6, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 15, fontWeight: "700" }}>أبشر</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
