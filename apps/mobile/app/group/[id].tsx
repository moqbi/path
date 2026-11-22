import { Spinner } from "../../components/spinner";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, Pressable, Alert } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Picker from "expo-image-picker";
import { ChatLine, bubbleStyle, needsHead } from "../../components/chat-line";
import { MediaImage } from "../../components/media-image";
import { viewPhoto } from "../../components/photo-viewer";
import { ScreenHeader } from "../../components/screen-header";
import { GroupFace } from "../../components/group-face";
import { CameraIcon, FlagIcon, ModDeleteIcon, PencilIcon, TrashIcon } from "../../components/icons";
import { SwipeRow } from "../../components/swipe-row";
import { ReportSheet } from "../../components/report-sheet";
import { scrolled } from "../../lib/scrolled";
import { api } from "../../lib/api";
import { uploadFile } from "../../lib/upload";
import { useKeyboardInset } from "../../lib/keyboard";
import { keys } from "../../lib/queries";
import { useOpenThread } from "../../lib/open-thread";
import { useSession } from "../../lib/session";
import { RANK, type GroupLine, type GroupThread } from "../../lib/groups";
import { colors } from "../../theme/tokens";

/**
 * المحادثة الجماعيّة (القاعدة ٢١٥).
 *
 * بسطر المحادثة الخاصّة نفسه (`ChatLine`، القاعدة ٢١٦): صورةُ المرسل واسمُه
 * ووسمُه والتاريخ فوق فقاعته. ولا إيصالَ
 * لكل رسالة: ختمُ قراءةٍ لكل عضوٍ يكفي لعدّ ما لم يُقرأ. والأفعالُ بالسحب كالخاصّ
 * (القاعدة ٤٧٥): تعديلٌ وحذفٌ لرسالتي، وحذفٌ لرسالة من دوني بالرتبة، وبلاغٌ لغيرها.
 */
/** ما في الفقاعة حين تُسحب — كالخاصّ (القاعدة ٣٨٩): الحدُّ على `SwipeRow` الذي يلفّها. */
function inner(mine: boolean) {
  const b = bubbleStyle(mine);
  return {
    alignSelf: "stretch" as const,
    paddingHorizontal: b.paddingHorizontal,
    paddingVertical: b.paddingVertical,
    backgroundColor: b.backgroundColor,
  };
}

export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useOpenThread(`/group/${id}`);
  const me = useSession((s) => s.me);
  const client = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();

  const list = useRef<FlatList<GroupLine>>(null);
  const pinned = useRef(true);
  const toEnd = (animated = true) => {
    if (pinned.current) requestAnimationFrame(() => list.current?.scrollToOffset({ offset: 0, animated }));
  };
  useEffect(() => {
    if (keyboard > 0) toEnd();
  }, [keyboard]);

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState<string | null>(null);
  const [swiping, setSwiping] = useState(false);

  const thread = useQuery({
    queryKey: keys.group(id),
    queryFn: () => api<GroupThread>(`/v1/groups/${id}?limit=50`),
    refetchInterval: 8_000,
  });

  // فتحُها قراءتُها: الختمُ عند الفتح ومع كلّ جلب.
  useEffect(() => {
    if (!thread.data) return;
    void api(`/v1/groups/${id}/read`, { method: "POST" }).then(() => {
      void client.invalidateQueries({ queryKey: keys.groups });
    });
  }, [thread.data, id, client]);

  const refresh = () => void client.invalidateQueries({ queryKey: keys.dm });

  const send = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api(`/v1/groups/${id}/messages`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (problem: Error) => setError(problem.message),
  });

  const drop = useMutation({
    mutationFn: (messageId: string) => api(`/v1/groups/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.group(id) });
      refresh();
    },
    onError: (problem: Error) => setError(problem.message),
  });

  // تعديلُ رسالتي (القاعدة ٤٧٥) — و«عُدّلت» يبقى ظاهراً للجميع.
  const edit = useMutation({
    mutationFn: (input: { messageId: string; body: string }) =>
      api(`/v1/groups/messages/${input.messageId}`, { method: "PATCH", body: JSON.stringify({ body: input.body }) }),
    onSuccess: () => {
      setEditing(null);
      void client.invalidateQueries({ queryKey: keys.group(id) });
    },
    onError: (problem: Error) => setError(problem.message),
  });

  async function sendPhoto() {
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      setError("لازم تسمح بالوصول لألبومك.");
      return;
    }
    const result = await Picker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const mediaId = await uploadFile(asset.uri, asset.mimeType ?? "image/jpeg", "MESSAGE", asset);
      pinned.current = true;
      send.mutate({ kind: "PHOTO", mediaId });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر الإرسال");
    }
  }

  const data = thread.data;
  // مقلوبةٌ كالمحادثة الخاصّة: تُفتح عند آخرها بلا انزلاق.
  const rows = useMemo(() => [...(data?.messages ?? [])].reverse(), [data?.messages]);
  // الرتبُ (القاعدة ٤٧٥): أحذف رسالةَ من دوني إن كنتُ مشرفاً فما فوق، وأُبلغ عن غيرها.
  const myRank = data?.myRank ?? (data?.canManage ? 4 : 0);
  const rankOf = (userId: string) => {
    const member = data?.members.find((row) => row.id === userId);
    if (!member) return 0;
    if (member.role) return RANK[member.role];
    return userId === data?.ownerId ? 3 : 0;
  };
  const muted = Boolean(data?.members.find((row) => row.id === me?.id)?.muted);

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader
        title={data?.name ?? "مجموعة"}
        back="/messages"
        // صورةُ المجموعة مكانَ العلامة — **بقرار المالك** (القاعدة ٤٧٥) — وضغطُها بابُ الإدارة.
        face={
          <Pressable
            accessibilityLabel="إدارة المجموعة"
            onPress={() => router.push({ pathname: "/group/manage", params: { id } } as never)}
          >
            <GroupFace photoMediaId={data?.photoMediaId} size={32} />
          </Pressable>
        }
        onTitlePress={() => router.push({ pathname: "/group/manage", params: { id } } as never)}
      />

      <View style={{ flex: 1, paddingBottom: keyboard }}>
        <FlatList
          ref={list}
          data={rows}
          inverted
          scrollEnabled={!swiping}
          onScrollBeginDrag={scrolled}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={(event) => {
            pinned.current = event.nativeEvent.contentOffset.y < 120;
          }}
          scrollEventThrottle={64}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 14, gap: 6 }}
          ListEmptyComponent={
            thread.isLoading ? (
              <Spinner style={{ marginTop: 40 }} color={colors.clay} />
            ) : thread.isError ? (
              <Text style={{ color: colors.groundMuted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
                المجموعة غير موجودة.
              </Text>
            ) : (
              <Text style={{ color: colors.groundMuted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
                لا رسائل بعد. اكتب أول سطر.
              </Text>
            )
          }
          renderItem={({ item, index }) => {
            // سطرُ الحدث على أرضية المجموعة في وسطها لا فقاعة (القاعدة ٢٦٤).
            if (item.system) {
              return (
                <View style={{ alignItems: "center", paddingVertical: 8, paddingHorizontal: 24 }}>
                  <Text
                    style={{
                      color: colors.groundMuted,
                      fontSize: 12,
                      lineHeight: 20,
                      textAlign: "center",
                      backgroundColor: colors.groundLine,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 3,
                      overflow: "hidden",
                    }}
                  >
                    {item.body}
                  </Text>
                </View>
              );
            }
            const mine = item.senderId === me?.id;
            const before = rows[index + 1];
            const text = item.kind === "TEXT";
            const open = editing === item.id;
            // بالسحب كالخاصّ (القاعدة ٤٧٥): رسالتي قلمٌ وسلّة، ورسالةُ من دوني سلّةٌ ودرعٌ وراية، وغيرُها راية.
            const canModerate = !mine && myRank >= 1 && myRank > rankOf(item.senderId);
            const content = open ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "stretch" }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={2000}
                  accessibilityLabel="تعديل الرسالة"
                  style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 16, borderWidth: 1, borderColor: colors.clay, backgroundColor: colors.card, paddingHorizontal: 14, fontSize: 13.5, color: colors.ink }}
                />
                <Pressable
                  onPress={() => edit.mutate({ messageId: item.id, body: draft })}
                  style={{ height: 34, paddingHorizontal: 12, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
                >
                  <Text style={{ color: colors.onBrand, fontSize: 12, fontWeight: "700" }}>حفظ</Text>
                </Pressable>
                <Pressable onPress={() => setEditing(null)}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>إلغاء</Text>
                </Pressable>
              </View>
            ) : item.kind === "PHOTO" && item.mediaId ? (
              <Pressable onPress={() => viewPhoto(item.mediaId)}>
                <MediaImage mediaId={item.mediaId} style={{ width: 220, height: 220, borderRadius: 16 }} />
              </Pressable>
            ) : (
              <View style={inner(mine)}>
                <Text style={{ color: colors.ink, fontSize: 14.5, lineHeight: 24 }}>{item.body}</Text>
              </View>
            );
            const surface = text ? (inner(mine).backgroundColor as string) : "transparent";
            const inside = text ? bubbleStyle(mine) : undefined;
            const tint = text ? colors.live : "#fff";

            const bubble = open ? (
              content
            ) : (
              <View style={text ? { alignSelf: "stretch" } : undefined}>
                {mine ? (
                  <SwipeRow
                    width={56}
                    radius={18}
                    surface={surface}
                    inside={inside}
                    confirmLabel="حذف الرسالة"
                    onSwiping={setSwiping}
                    lead={
                      text
                        ? {
                            label: "تعديل الرسالة",
                            run: () => {
                              setDraft(item.body);
                              setEditing(item.id);
                            },
                          }
                        : undefined
                    }
                    icons={{
                      delete: <TrashIcon size={20} color={tint} />,
                      lead: <PencilIcon size={20} color={text ? colors.clay : colors.onBrand} />,
                    }}
                    onDelete={() => drop.mutateAsync(item.id).then(() => undefined)}
                  >
                    {content}
                  </SwipeRow>
                ) : (
                  <SwipeRow
                    width={56}
                    radius={18}
                    surface={surface}
                    inside={inside}
                    confirmLabel={canModerate ? "حذف بصلاحية المشرف" : "بلاغ عن الرسالة"}
                    onSwiping={setSwiping}
                    onSecond={canModerate ? () => setReporting(item.id) : undefined}
                    secondLabel={canModerate ? "بلاغ عن الرسالة" : undefined}
                    icons={{
                      delete: canModerate ? <ModDeleteIcon size={20} color={tint} /> : <FlagIcon size={20} color={tint} />,
                      second: <FlagIcon size={20} color={tint} />,
                    }}
                    onDelete={() => (canModerate ? drop.mutateAsync(item.id).then(() => undefined) : setReporting(item.id))}
                  >
                    {content}
                  </SwipeRow>
                )}
              </View>
            );

            return (
              <ChatLine
                person={item.sender}
                mine={mine}
                at={item.createdAt}
                head={!before || before.system ? true : needsHead(item, before)}
                meta={item.editedAt ? <Text style={{ color: colors.groundFaint, fontSize: 10 }}>عُدّلت</Text> : null}
              >
                {bubble}
              </ChatLine>
            );
          }}
        />

        <View style={{ paddingHorizontal: 16, paddingBottom: keyboard ? 10 : Math.max(insets.bottom, 18), paddingTop: 10 }}>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 11.5, textAlign: "center", marginBottom: 8 }}>
              {error}
            </Text>
          ) : null}
          {muted ? (
            <Text style={{ color: colors.groundMuted, fontSize: 13, textAlign: "center", paddingVertical: 14 }}>
              أنت مكتوم في هذه المجموعة — تقرأ ولا تكتب حتى يُرفع الكتم.
            </Text>
          ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="اكتب للمجموعة…"
              placeholderTextColor={colors.faint}
              maxLength={2000}
              style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 20, fontSize: 13.5, textAlign: "right", color: colors.ink }}
            />
            <Pressable
              accessibilityLabel="أرسل صورة"
              onPress={() => void sendPhoto()}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
            >
              <CameraIcon size={19} color={colors.ink2} />
            </Pressable>
            <Pressable
              onPress={() => {
                const text = body.trim();
                if (!text) return;
                setBody("");
                pinned.current = true;
                send.mutate({ kind: "TEXT", body: text });
              }}
              style={{ height: 48, paddingHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
            >
              <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>إرسال</Text>
            </Pressable>
          </View>
          )}
        </View>
      </View>
      {reporting ? <ReportSheet target="MESSAGE" targetId={reporting} onClose={() => setReporting(null)} /> : null}
    </SafeAreaView>
  );
}
