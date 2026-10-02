import { useEffect, useRef, useState } from "react";
import { View, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Picker from "expo-image-picker";
import { ChatLine, bubbleStyle, needsHead } from "../../components/chat-line";
import { MediaImage } from "../../components/media-image";
import { viewPhoto } from "../../components/photo-viewer";
import { ScreenHeader } from "../../components/screen-header";
import { CameraIcon, WithIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { uploadFile } from "../../lib/upload";
import { useKeyboardInset } from "../../lib/keyboard";
import { keys } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar } from "../../lib/format";
import type { GroupLine, GroupThread } from "../../lib/groups";
import { colors } from "../../theme/tokens";

/**
 * المحادثة الجماعيّة (القاعدة ٢١٥).
 *
 * بسطر المحادثة الخاصّة نفسه (`ChatLine`، القاعدة ٢١٦): صورةُ المرسل واسمُه
 * ووسمُه والتاريخ فوق فقاعته. ولا إيصالَ
 * لكل رسالة: ختمُ قراءةٍ لكل عضوٍ يكفي لعدّ ما لم يُقرأ. وضغطةٌ على
 * رسالتي تكشف «حذف»، وللمشرف على كل رسالة.
 */
export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.me);
  const client = useQueryClient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();

  const list = useRef<FlatList<GroupLine>>(null);
  const pinned = useRef(true);
  const toEnd = (animated = true) => {
    if (pinned.current) requestAnimationFrame(() => list.current?.scrollToEnd({ animated }));
  };
  useEffect(() => {
    if (keyboard > 0) toEnd();
  }, [keyboard]);

  const [body, setBody] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setShown(null);
      refresh();
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
  const lines = data?.messages ?? [];

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader
        title={data?.name ?? "مجموعة"}
        back="/messages"
        // الاسمُ بابُ الأعضاء والإدارة.
        onTitlePress={() => router.push({ pathname: "/group/manage", params: { id } } as never)}
        right={
          <Pressable
            accessibilityLabel="الأعضاء"
            onPress={() => router.push({ pathname: "/group/manage", params: { id } } as never)}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <WithIcon size={18} color="#f7f5ef" />
            {data ? <Text style={{ color: "#f7f5ef", fontSize: 12.5, fontWeight: "600" }}>{ar(data.members.length)}</Text> : null}
          </Pressable>
        }
      />

      <View style={{ flex: 1, paddingBottom: keyboard }}>
        <FlatList
          ref={list}
          data={lines}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => toEnd(false)}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            pinned.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
          }}
          scrollEventThrottle={64}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 14, gap: 6 }}
          ListEmptyComponent={
            thread.isLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={colors.clay} />
            ) : thread.isError ? (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
                المجموعة غير موجودة.
              </Text>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
                لا رسائل بعد. اكتب أول سطر.
              </Text>
            )
          }
          renderItem={({ item, index }) => {
            const mine = item.senderId === me?.id;
            const canDrop = mine || Boolean(data?.canManage);

            return (
              <ChatLine
                person={item.sender}
                mine={mine}
                at={item.createdAt}
                head={needsHead(item, lines[index - 1])}
                meta={
                  shown === item.id ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert("حذف الرسالة؟", mine ? undefined : "تُحذف عند الجميع بصلاحية المشرف.", [
                          { text: "إلغاء", style: "cancel" },
                          { text: "حذف", style: "destructive", onPress: () => drop.mutate(item.id) },
                        ])
                      }
                    >
                      <Text style={{ color: colors.live, fontSize: 11.5, fontWeight: "700" }}>حذف</Text>
                    </Pressable>
                  ) : null
                }
              >
                {item.kind === "PHOTO" && item.mediaId ? (
                  <Pressable
                    onPress={() => viewPhoto(item.mediaId)}
                    onLongPress={() => canDrop && setShown(item.id)}
                  >
                    <MediaImage mediaId={item.mediaId} style={{ width: 220, height: 220, borderRadius: 16 }} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => canDrop && setShown((v) => (v === item.id ? null : item.id))}
                    style={bubbleStyle(mine)}
                  >
                    <Text style={{ color: colors.ink, fontSize: 14.5, lineHeight: 24 }}>{item.body}</Text>
                  </Pressable>
                )}
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
        </View>
      </View>
    </SafeAreaView>
  );
}
