import { useState } from "react";
import { View, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Text, TextInput } from "../components/type";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Avatar } from "../components/avatar";
import { SwipeRow } from "../components/swipe-row";
import { ScreenHeader } from "../components/screen-header";
import { Ticks, receiptOf } from "../components/receipt";
import { CameraIcon, MicIcon, SearchIcon } from "../components/icons";
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
};

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
  const pullRefresh = usePullRefresh(list.refetch);
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
  const talking = new Set((list.data?.conversations ?? []).map((row) => row.other.id));
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
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScreenHeader title="المحادثات" back="/" />

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
        keyboardShouldPersistTaps="handled"
        data={conversations}
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
        renderItem={({ item }) => (
          <SwipeRow onDelete={() => void drop.mutate(item.id)}>
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
        )}
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
          ) : needle ? (
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
    </SafeAreaView>
  );
}
