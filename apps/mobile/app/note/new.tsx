import { useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, View, type TextInput as RNTextInput } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Text, TextInput } from "../../components/type";
import { Avatar } from "../../components/avatar";
import { SongPicker } from "../../components/song-picker";
import { CheckIcon, CloseIcon, GifIcon, MusicIcon, QuoteIcon, WithIcon } from "../../components/icons";
import { GifPicker } from "../../components/gif-picker";
import { Image } from "expo-image";
import { DEV_FEATURES } from "../../lib/dev-features";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useCircle } from "../../lib/queries";
import { NOTE_TEXT_MAX, gifUrl, noteKeys, useGifs, type Gif, type Track } from "../../lib/status-notes";
import { ar } from "../../lib/format";
import { useKeyboardInset } from "../../lib/keyboard";
import { colors } from "../../theme/tokens";

/**
 * نوتٌ جديدة (القاعدة ٢٦٩) — **بقرار المالك**، بهيئة إنستقرام: صورتُك في الوسط
 * وفوقها الفقاعة، وتحتها «عبارة» أو «أغنية». والأغنيةُ قائمةٌ وبحثٌ ثمّ قصُّ
 * مقطعاً ببدايته ونهايته (`SongPicker`). وفي الأسفل الجمهور — الدائرةُ كلُّها أو تصنيف —
 * ثمّ «شارك». والنوتُ الجديدة تحلّ محلّ القديمة.
 */
// زجاجُ الفقاعة يتبع أرضيتَها (الشريط): فوق داكنٍ زجاجٌ فاتحٌ شفيف، وفوق فاتحٍ — ثيمٌ
// شريطُه فاتح — زجاجٌ داكن، وإلّا ذاب الأبيضُ في الأبيض. وأندرويد بلا غبشٍ فيأخذ ملئاً أكثف.
function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}
function glassOn(ground: string) {
  const android = Platform.OS === "android";
  return isDark(ground)
    ? { fill: android ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.07)", dot: "rgba(255,255,255,.12)", edge: "rgba(255,255,255,.22)", tint: "systemUltraThinMaterialLight" as const }
    : { fill: android ? "rgba(20,24,28,.32)" : "rgba(20,24,28,.16)", dot: "rgba(20,24,28,.14)", edge: "rgba(20,24,28,.18)", tint: "systemUltraThinMaterialDark" as const };
}

export default function NewNote() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const glass = glassOn(colors.night);
  const keyboard = useKeyboardInset();
  const client = useQueryClient();
  const me = useSession((s) => s.me);
  const circle = useCircle();
  const groups = circle.data?.groups ?? [];

  const input = useRef<RNTextInput>(null);
  const [text, setText] = useState("");
  const [track, setTrack] = useState<{ track: Track; start: number; full: boolean; seconds: number } | null>(null);
  const [picking, setPicking] = useState(false);
  // صورةٌ متحرّكة من GIPHY (القاعدة ٣١٥) — في نسخة التطوير وحدها حتى يُعتمد، وبلا مفتاحٍ لا زرّ.
  const [gif, setGif] = useState<Gif | null>(null);
  const [gifing, setGifing] = useState(false);
  const gifs = useGifs("");
  const canGif = DEV_FEATURES && gifs.data?.enabled === true;
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
          gifId: gif?.id,
          groupId,
        }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: noteKeys.all });
      router.back();
    },
  });

  const ready = (text.trim().length > 0 || Boolean(track) || Boolean(gif)) && !share.isPending;
  const audience = groupId ? (groups.find((g) => g.id === groupId)?.name ?? "تصنيف") : "الدائرة كلها";

  // أرضيتُها الشريطُ وحبرُها حبرُه (`chromeInk`) لا أبيضُ مكتوب: ثيمٌ شريطُه فاتح كان يُذيب
  // الكتابةَ والأزرار (القاعدة ٣١٤).
  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <Pressable
          accessibilityLabel="إغلاق"
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chrome2 }}
        >
          <CloseIcon size={17} color={colors.chromeInk} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", color: colors.chromeInk, fontSize: 16, fontWeight: "800", marginEnd: 40 }}>نوت</Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: keyboard ? keyboard / 2 : 0 }}>
        {/*
          الفقاعة — **بقرار المالك** (القاعدة ٣١٥): فقاعةُ النوت نفسُها كما ستُرى فوق
          الصورة، بأرضية البطاقة وحبرها وذيلٍ من نقطتين، والكتابةُ فيها بحرفٍ كبير في
          الوسط — لا صندوقُ إدخالٍ شفّاف. وفوق العبارة الصورةُ المتحرّكة ثمّ الأغنية،
          ولكلٍّ «×» يرفعه.
        */}
        <Pressable onPress={() => input.current?.focus()} style={{ alignItems: "center", paddingHorizontal: 24 }}>
          <View
            style={{
              minWidth: 150,
              maxWidth: 240,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 9,
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: glass.edge,
              backgroundColor: glass.fill,
              alignItems: "center",
            }}
          >
            {Platform.OS !== "android" ? <BlurView intensity={40} tint={glass.tint} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} /> : null}
            {gif ? (
              <View style={{ marginBottom: 8 }}>
                <Image
                  source={{ uri: gifUrl(gif.id) }}
                  style={{ width: Math.min(180, (140 * gif.w) / gif.h), height: Math.min(140, (180 * gif.h) / gif.w), borderRadius: 14 }}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityLabel="احذف الصورة المتحركة"
                  hitSlop={8}
                  onPress={() => setGif(null)}
                  style={{ position: "absolute", top: 6, left: 6, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,26,36,.7)" }}
                >
                  <CloseIcon size={11} color="#fff" />
                </Pressable>
              </View>
            ) : null}
            {track ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  maxWidth: "100%",
                  marginBottom: 6,
                  paddingHorizontal: 10,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: "rgba(255,255,255,.12)",
                }}
              >
                <MusicIcon size={12} color={colors.clay} />
                <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.chromeInk, fontSize: 12.5, fontWeight: "700", writingDirection: "auto" }}>
                  {track.track.title}
                </Text>
                <Pressable accessibilityLabel="احذف الأغنية" hitSlop={8} onPress={() => setTrack(null)}>
                  <CloseIcon size={11} color={colors.chromeMuted} />
                </Pressable>
              </View>
            ) : null}
            <TextInput
              ref={input}
              value={text}
              onChangeText={(value) => setText(value.replace(/\n/g, " ").slice(0, NOTE_TEXT_MAX))}
              placeholder={track || gif ? "أضف عبارة…" : "وش في بالك؟"}
              placeholderTextColor={colors.chromeMuted}
              multiline
              maxLength={NOTE_TEXT_MAX}
              style={{ minWidth: 120, maxWidth: 210, color: colors.chromeInk, fontSize: 16, lineHeight: 23, fontWeight: "600", textAlign: "center", paddingVertical: 0 }}
            />
            {text.length > NOTE_TEXT_MAX - 15 ? (
              <Text style={{ color: colors.chromeMuted, fontSize: 10.5, marginTop: 3 }}>{ar(NOTE_TEXT_MAX - text.length)}</Text>
            ) : null}
          </View>
          {/* الذيلُ: نقطةٌ ثمّ أصغرُ منها تنزلان إلى الصورة — فقاعةُ خاطرة. */}
          <View style={{ width: 11, height: 11, borderRadius: 6, marginTop: 5, borderWidth: 1, borderColor: glass.edge, backgroundColor: glass.dot }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 3, borderWidth: 1, borderColor: glass.edge, backgroundColor: glass.dot }} />
        </Pressable>

        <View style={{ marginTop: 4 }}>
          <Avatar name={me?.name ?? ""} size={92} mediaId={me?.avatarMediaId ?? null} frame={me?.frame ?? null} charm={picking || gifing ? null : (me?.charm ?? null)} />
        </View>

        <Text style={{ color: colors.chromeMuted, fontSize: 11, marginTop: 10 }}>تبقى يوماً ثمّ تذهب</Text>

        {/* «عبارة» و«أغنية» و«GIF» — وتجتمع: سطرٌ فوق أغنيةٍ وصورة. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 18, paddingHorizontal: 16 }}>
          <Pill icon={<QuoteIcon size={15} color={colors.onBrand} />} label="عبارة" onPress={() => input.current?.focus()} />
          <Pill
            icon={<MusicIcon size={14} color={colors.onBrand} />}
            label={track ? "غيّر الأغنية" : "أغنية"}
            onPress={() => {
              input.current?.blur();
              setPicking(true);
            }}
          />
          {canGif ? (
            <Pill
              icon={<GifIcon size={16} color={colors.onBrand} />}
              label={gif ? "غيّر الصورة" : "GIF"}
              onPress={() => {
                input.current?.blur();
                setGifing(true);
              }}
            />
          ) : null}
        </View>
      </View>

      {/* الجمهور ثمّ «شارك». */}
      <View style={{ paddingHorizontal: 16, paddingBottom: keyboard ? keyboard + 10 : insets.bottom + 14, gap: 10 }}>
        {choosing ? (
          <View style={{ borderRadius: 16, backgroundColor: colors.chrome2, paddingVertical: 6, maxHeight: 240 }}>
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
                  <Text style={{ flex: 1, color: colors.chromeInk, fontSize: 14 }}>{row.name}</Text>
                  {groupId === row.id ? <CheckIcon size={16} color={colors.clay} /> : null}
                </Pressable>
              ))}
              {groups.length === 0 ? (
                <Text style={{ color: colors.chromeMuted, fontSize: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
                  أنشئ تصنيفاً من سحب صفّ أيّ صديق في «الأصدقاء».
                </Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => setChoosing((v) => !v)}
            style={{ flex: 1, height: 46, borderRadius: 23, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, backgroundColor: colors.chrome2 }}
          >
            <WithIcon size={16} color={colors.chromeInk} />
            <Text numberOfLines={1} style={{ flex: 1, color: colors.chromeInk, fontSize: 13 }}>
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

      {gifing ? (
        <GifPicker
          onClose={() => setGifing(false)}
          onPick={(picked) => {
            setGif(picked);
            setGifing(false);
          }}
        />
      ) : null}

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

/** زرٌّ من أزرار النوت: قرصٌ بلون اللمسة وأيقونةٌ وكلمةٌ بحبرها (القاعدة ٣١٤). */
function Pill({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
    >
      {icon}
      <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
