import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, type TextInput as RNTextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Text, TextInput } from "../../components/type";
import { Avatar } from "../../components/avatar";
import { SongPicker } from "../../components/song-picker";
import { CheckIcon, CloseIcon, MusicIcon, WithIcon } from "../../components/icons";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useCircle } from "../../lib/queries";
import { NOTE_TEXT_MAX, noteKeys, type Track } from "../../lib/status-notes";
import { ar } from "../../lib/format";
import { useKeyboardInset } from "../../lib/keyboard";
import { colors } from "../../theme/tokens";

/**
 * نوتٌ جديدة (القاعدة ٢٦٩) — **بقرار المالك**، بهيئة إنستقرام: صورتُك في الوسط
 * وفوقها الفقاعة، وتحتها «عبارة» أو «أغنية». والأغنيةُ قائمةٌ وبحثٌ ثمّ قصُّ
 * مقطعاً ببدايته ونهايته (`SongPicker`). وفي الأسفل الجمهور — الدائرةُ كلُّها أو تصنيف —
 * ثمّ «شارك». والنوتُ الجديدة تحلّ محلّ القديمة.
 */
export default function NewNote() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const client = useQueryClient();
  const me = useSession((s) => s.me);
  const circle = useCircle();
  const groups = circle.data?.groups ?? [];

  const input = useRef<RNTextInput>(null);
  const [text, setText] = useState("");
  const [track, setTrack] = useState<{ track: Track; start: number; full: boolean; seconds: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const share = useMutation({
    mutationFn: () =>
      api("/v1/notes", {
        method: "POST",
        body: JSON.stringify({
          text: text.trim() || undefined,
          trackId: track?.track.id,
          trackStart: track?.start,
          trackSeconds: track?.seconds,
          trackFull: track?.full,
          groupId,
        }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: noteKeys.all });
      router.back();
    },
  });

  const ready = (text.trim().length > 0 || Boolean(track)) && !share.isPending;
  const audience = groupId ? (groups.find((g) => g.id === groupId)?.name ?? "تصنيف") : "الدائرة كلها";

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <Pressable
          accessibilityLabel="إغلاق"
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}
        >
          <CloseIcon size={17} color="#fff" />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", color: "#fff", fontSize: 16, fontWeight: "800", marginEnd: 40 }}>نوت</Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: keyboard ? keyboard / 2 : 0 }}>
        {/* الفقاعة: الأغنيةُ ثمّ العبارةُ تُكتب في مكانها. */}
        <Pressable onPress={() => input.current?.focus()} style={{ alignItems: "center" }}>
          <View
            style={{
              minWidth: 160,
              maxWidth: 250,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,.14)",
              alignItems: "center",
            }}
          >
            {track ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", marginBottom: 4 }}>
                <MusicIcon size={13} color="#F6B93B" />
                <Text numberOfLines={1} style={{ flexShrink: 1, color: "#fff", fontSize: 13, fontWeight: "700", writingDirection: "auto" }}>
                  {track.track.title}
                </Text>
                <Pressable accessibilityLabel="احذف الأغنية" hitSlop={8} onPress={() => setTrack(null)}>
                  <CloseIcon size={11} color="rgba(255,255,255,.7)" />
                </Pressable>
              </View>
            ) : null}
            <TextInput
              ref={input}
              value={text}
              onChangeText={(value) => setText(value.replace(/\n/g, " ").slice(0, NOTE_TEXT_MAX))}
              placeholder={track ? "أضف عبارة…" : "اكتب نوت…"}
              placeholderTextColor="rgba(255,255,255,.45)"
              multiline
              maxLength={NOTE_TEXT_MAX}
              style={{ minWidth: 130, maxWidth: 222, color: "#fff", fontSize: 15, lineHeight: 22, textAlign: "center", paddingVertical: 2 }}
            />
          </View>
          <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 3, backgroundColor: "rgba(255,255,255,.14)" }} />
        </Pressable>

        <View style={{ marginTop: 6 }}>
          <Avatar name={me?.name ?? ""} size={104} mediaId={me?.avatarMediaId ?? null} frame={me?.frame ?? null} charm={picking ? null : (me?.charm ?? null)} />
        </View>

        <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 11, marginTop: 10 }}>
          {text.length > NOTE_TEXT_MAX - 15 ? `${ar(NOTE_TEXT_MAX - text.length)} حرفاً باقية` : "تبقى يوماً ثمّ تذهب"}
        </Text>

        {/* «عبارة» أو «أغنية» — ويجتمعان: سطرٌ فوق أغنية. */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={() => input.current?.focus()}
            style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>عبارة</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              input.current?.blur();
              setPicking(true);
            }}
            style={{ height: 40, paddingHorizontal: 18, borderRadius: 20, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}
          >
            <MusicIcon size={14} color="#F6B93B" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{track ? "غيّر الأغنية" : "أغنية"}</Text>
          </Pressable>
        </View>
      </View>

      {/* الجمهور ثمّ «شارك». */}
      <View style={{ paddingHorizontal: 16, paddingBottom: keyboard ? keyboard + 10 : insets.bottom + 14, gap: 10 }}>
        {choosing ? (
          <View style={{ borderRadius: 16, backgroundColor: "rgba(255,255,255,.08)", paddingVertical: 6, maxHeight: 240 }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[{ id: null as string | null, name: "الدائرة كلها" }, ...groups.map((g) => ({ id: g.id as string | null, name: g.name }))].map((row) => (
                <Pressable
                  key={row.id ?? "all"}
                  onPress={() => {
                    setGroupId(row.id);
                    setChoosing(false);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", height: 44, paddingHorizontal: 14 }}
                >
                  <Text style={{ flex: 1, color: "#fff", fontSize: 14 }}>{row.name}</Text>
                  {groupId === row.id ? <CheckIcon size={16} color="#F6B93B" /> : null}
                </Pressable>
              ))}
              {groups.length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
                  أنشئ تصنيفاً من سحب صفّ أيّ صديق في «الأصدقاء».
                </Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => setChoosing((v) => !v)}
            style={{ flex: 1, height: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,.1)" }}
          >
            <WithIcon size={16} color="#fff" />
            <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: 13 }}>
              مع: {audience}
            </Text>
          </Pressable>
          <Pressable
            disabled={!ready}
            onPress={() => share.mutate()}
            style={{ height: 46, paddingHorizontal: 24, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay, opacity: ready ? 1 : 0.45 }}
          >
            {share.isPending ? <ActivityIndicator color={colors.onBrand} /> : <Text style={{ color: colors.onBrand, fontSize: 14, fontWeight: "800" }}>شارك</Text>}
          </Pressable>
        </View>
        {share.error ? (
          <Text accessibilityRole="alert" style={{ color: "#FF7A5A", fontSize: 12.5, textAlign: "center" }}>
            {(share.error as Error).message}
          </Text>
        ) : null}
      </View>

      {picking ? (
        <SongPicker
          onClose={() => setPicking(false)}
          onPick={(picked, start, full, seconds) => {
            setTrack({ track: picked, start, full, seconds });
            setPicking(false);
          }}
        />
      ) : null}
    </View>
  );
}
