import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, PanResponder, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "./type";
import { BackIcon, CheckIcon, CloseIcon, PauseIcon, PlayIcon, SearchIcon } from "./icons";
import {
  NOTE_SECONDS,
  PREVIEW_SECONDS,
  playClip,
  previewOf,
  stopClip,
  useClip,
  useTracks,
  type Track,
} from "../lib/status-notes";
import { ar } from "../lib/format";

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${ar(Math.floor(whole / 60))}:${ar(String(whole % 60).padStart(2, "0"))}`;
};

/**
 * اختيارُ أغنية النوت (القاعدة ٢٦٩) — **بقرار المالك**، بهيئة إنستقرام: قائمةُ
 * «الأكثر استماعاً» وفوقها بحث، والضغطةُ تُسمع المعاينة وتفتح شريطها: **كاملةً**
 * (ثلاثون ثانية كما هي) أو **مقطعاً** — نافذةُ عشرين تُسحب — والخيارُ لصاحبها
 * (القاعدة ٢٧٧)، ثمّ علامةُ «تمّ».
 *
 * طبقةٌ داكنة لا `Modal` (القاعدة ١٢٦)، والبحثُ من خادمنا (`/v1/music`).
 */
export function SongPicker({
  onPick,
  onClose,
}: {
  onPick: (track: Track, start: number, full: boolean, seconds: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Track | null>(null);
  const tracks = useTracks(query);

  useEffect(() => () => void stopClip(), []);

  return (
    // فوق كلّ ما في الشاشة: التشارم مرسومةٌ بـ`zIndex` فوق الإطار، فكانت تطفو فوق القائمة.
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100, backgroundColor: "rgba(10,16,22,.97)", paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 12 }}>
        <Pressable
          accessibilityLabel={chosen ? "رجوع للقائمة" : "إغلاق"}
          onPress={() => {
            void stopClip();
            if (chosen) setChosen(null);
            else onClose();
          }}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}
        >
          {chosen ? <BackIcon size={18} color="#fff" /> : <CloseIcon size={16} color="#fff" />}
        </Pressable>
        <Text style={{ flex: 1, color: "#fff", fontSize: 16, fontWeight: "800" }}>{chosen ? "الأغنية" : "أغنية"}</Text>
      </View>

      {chosen ? (
        <Trim track={chosen} onDone={(start, full, seconds) => onPick(chosen, start, full, seconds)} onOther={() => setChosen(null)} />
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginHorizontal: 16,
              height: 42,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,.1)",
              marginBottom: 8,
            }}
          >
            <SearchIcon size={16} color="rgba(255,255,255,.6)" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث عن أغنية أو فنان"
              placeholderTextColor="rgba(255,255,255,.45)"
              returnKeyType="search"
              style={{ flex: 1, color: "#fff", fontSize: 14, textAlign: "right" }}
            />
          </View>
          <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 11.5, fontWeight: "700", paddingHorizontal: 16, marginBottom: 4 }}>
            {query.trim() ? "نتائج البحث" : "الأكثر استماعاً"}
          </Text>
          {tracks.isLoading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color="#fff" />
          ) : tracks.isError ? (
            <Text style={{ color: "#FF7A5A", fontSize: 13, textAlign: "center", marginTop: 30 }}>
              {(tracks.error as Error).message}
            </Text>
          ) : (
            <FlatList
              data={tracks.data?.tracks ?? []}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              ListEmptyComponent={
                <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 13, textAlign: "center", marginTop: 30 }}>ما لقينا شي بهالاسم.</Text>
              }
              renderItem={({ item }) => <Row track={item} onChoose={() => setChosen(item)} />}
            />
          )}
          {/* شرطُ دِيزر: اسمُه حيث تُعرض أغانيه. */}
          <Text style={{ position: "absolute", bottom: insets.bottom + 6, alignSelf: "center", color: "rgba(255,255,255,.35)", fontSize: 10 }}>
            الأغاني من Deezer
          </Text>
        </>
      )}
    </View>
  );
}

function Row({ track, onChoose }: { track: Track; onChoose: () => void }) {
  const key = `pick:${track.id}`;
  const clip = useClip(key);
  return (
    <Pressable onPress={onChoose} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
      {track.cover ? (
        <Image source={{ uri: track.cover }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "rgba(255,255,255,.1)" }} />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "rgba(255,255,255,.1)" }} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14, fontWeight: "700", writingDirection: "auto" }}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.6)", fontSize: 12, writingDirection: "auto" }}>
          {track.artist} · {clock(track.duration)}
        </Text>
      </View>
      {/* شرطُ آبل لما يُعرض من كتالوجها: اسمُها بجانب الأغنية (القاعدة ٣٠٤). */}
      {track.source === "apple" ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(255,255,255,.14)" }}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Apple Music</Text>
        </View>
      ) : null}
      {/* سماعٌ قبل الاختيار: الضغطةُ على الصفّ تختار، وهذا الزرّ يُسمع فقط. */}
      <Pressable
        accessibilityLabel={clip.playing ? "إيقاف" : "استمع"}
        hitSlop={8}
        onPress={async () => {
          if (clip.playing || clip.loading) return void stopClip();
          await playClip(key, await previewOf(track.id), 0, PREVIEW_SECONDS);
        }}
        style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }}
      >
        {clip.loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : clip.playing ? (
          <PauseIcon size={14} color="#fff" />
        ) : (
          <PlayIcon size={14} color="#fff" />
        )}
      </Pressable>
    </Pressable>
  );
}

/** أقصرُ مقطعٍ يُقصّ — كـ`CLIP_MIN_SECONDS` في الخادم. */
const CLIP_MIN = 3;

/**
 * شريطُ القصّ: ستّون عموداً لثلاثين ثانية، وفوقها نافذةٌ بمقبضين (القاعدة ٣٠٣).
 * تبدأ **كاملةً** على الشريط كلّه، ومن أراد قصّ سحب طرفيها — بلا زرٍّ يختار بين
 * «كاملة» و«قصّ» (القاعدة ٣٠٥) — وبينهما ثلاثُ ثوانٍ على الأقلّ. اللمسةُ تأخذ أقربَ
 * المقبضين إليها، ومن داخل النافذة بعيداً عنهما تسحبها كلَّها بطولها. والزمنُ من
 * اليسار إلى اليمين كأيّ شريط تشغيل (كصوت القصّة — القاعدة ٢٣٨). والأعمدةُ رسمٌ
 * ثابتٌ من معرّف الأغنية لا موجتُها: المعاينةُ على دِيزر لا عندنا لنقرأها.
 */
function Trim({ track, onDone, onOther }: { track: Track; onDone: (start: number, full: boolean, seconds: number) => void; onOther: () => void }) {
  const { width: screen } = useWindowDimensions();
  const width = screen - 48;
  const px = width / PREVIEW_SECONDS;
  const [start, setStart] = useState(0);
  // كاملةً افتراضاً: النافذةُ الشريطُ كلُّه، ومن أراد قصّ سحب طرفيها — بلا زرٍّ يختار بينهما.
  const [end, setEnd] = useState(PREVIEW_SECONDS);
  const [url, setUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const key = `trim:${track.id}`;
  const clip = useClip(key);

  const bars = useMemo(() => {
    let seed = Number(track.id.slice(-6)) || 7;
    return Array.from({ length: 60 }, () => {
      seed = (seed * 9301 + 49297) % 233280;
      return 0.25 + (seed / 233280) * 0.75;
    });
  }, [track.id]);

  const live = useRef({ start, end, url });
  live.current = { start, end, url };
  const grab = useRef<{ part: "start" | "end" | "both"; start: number; end: number }>({ part: "both", start: 0, end: 0 });

  const play = (from = live.current.start, to = live.current.end, link = live.current.url) => {
    if (link) void playClip(key, link, Math.round(from), Math.round(to) - Math.round(from));
  };

  useEffect(() => {
    let alive = true;
    previewOf(track.id)
      .then((link) => {
        if (!alive) return;
        setUrl(link);
        play(0, PREVIEW_SECONDS, link);
      })
      .catch((error: Error) => alive && setProblem(error.message));
    return () => {
      alive = false;
      void stopClip();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { start: from, end: to } = live.current;
        const at = event.nativeEvent.locationX / px;
        // أقربُ المقبضين في مدى ثلاث ثوانٍ، وإلّا فداخلُ النافذة يسحبها كلَّها.
        const near = Math.abs(at - from) <= Math.abs(at - to) ? "start" : "end";
        const gap = Math.min(Math.abs(at - from), Math.abs(at - to));
        const part = gap <= 3 || at < from || at > to ? near : "both";
        grab.current = { part, start: from, end: to };
      },
      onPanResponderMove: (_e, g) => {
        const { part, start: from, end: to } = grab.current;
        const shift = g.dx / px;
        if (part === "start") setStart(Math.max(0, Math.min(to - CLIP_MIN, from + shift)));
        else if (part === "end") setEnd(Math.min(PREVIEW_SECONDS, Math.max(from + CLIP_MIN, to + shift)));
        else {
          const moved = Math.max(-from, Math.min(PREVIEW_SECONDS - to, shift));
          setStart(from + moved);
          setEnd(to + moved);
        }
      },
      onPanResponderRelease: () => {
        const { start: from, end: to } = live.current;
        // النهايةُ تُسمع بآخر ثلاثٍ قبلها، والبدايةُ والنافذةُ من أوّلها.
        if (grab.current.part === "end") play(Math.max(from, to - 3), to);
        else play(from, to);
      },
    }),
  ).current;

  const from = Math.round(start);
  const to = Math.round(end);
  const full = from === 0 && to === PREVIEW_SECONDS;

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, alignItems: "center" }}>
      {track.cover ? (
        <Image source={{ uri: track.cover }} style={{ width: 150, height: 150, borderRadius: 14, marginTop: 20 }} />
      ) : null}
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 16, writingDirection: "auto" }}>
        {track.title}
      </Text>
      <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.65)", fontSize: 13, marginTop: 2, writingDirection: "auto" }}>
        {track.artist}
      </Text>

      <Pressable
        accessibilityLabel={clip.playing ? "إيقاف" : "استمع"}
        onPress={() => (clip.playing ? void stopClip() : play())}
        style={{ marginTop: 20, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)" }}
      >
        {!url && !problem ? <ActivityIndicator color="#fff" /> : clip.playing ? <PauseIcon size={20} color="#fff" /> : <PlayIcon size={20} color="#fff" />}
      </Pressable>

      {/* الشريط: الزمنُ من اليسار إلى اليمين أيّاً كان اتّجاهُ الكتابة. */}
      <View {...pan.panHandlers} style={{ width, height: 64, marginTop: 20, direction: "ltr" }}>
        {/* ما فوق الشريط لا يأخذ اللمس، فيُقاس `locationX` من الشريط نفسه. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 8, bottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {bars.map((h, i) => {
            const t = (i / bars.length) * PREVIEW_SECONDS;
            const inside = t >= start && t < end;
            return <View key={i} style={{ width: 3, height: 44 * h, borderRadius: 2, backgroundColor: inside ? "#fff" : "rgba(255,255,255,.28)" }} />;
          })}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: start * px,
            width: (end - start) * px,
            borderRadius: 12,
            borderWidth: 3,
            borderColor: "#F6B93B",
          }}
        />
        {([start, end] as const).map((at, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{ position: "absolute", top: 14, bottom: 14, left: at * px - 7, width: 14, borderRadius: 7, backgroundColor: "#F6B93B", alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 2, height: 14, borderRadius: 1, backgroundColor: "#0E1A24" }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
        <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 12 }}>
          {full
            ? "الأغنية كاملة — اسحب طرفَي النافذة لتقصّ منها"
            : `من \u2066${clock(from)}\u2069 إلى \u2066${clock(to)}\u2069، ${ar(to - from)} ث`}
        </Text>
        {full ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStart(0);
              setEnd(PREVIEW_SECONDS);
              play(0, PREVIEW_SECONDS);
            }}
            hitSlop={8}
          >
            <Text style={{ color: "#F6B93B", fontSize: 12, fontWeight: "800" }}>كاملة</Text>
          </Pressable>
        )}
      </View>
      {problem ? <Text style={{ color: "#FF7A5A", fontSize: 13, marginTop: 12 }}>{problem}</Text> : null}

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", paddingBottom: 34 }}>
        <Pressable
          onPress={onOther}
          style={{ flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)" }}
        >
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>أغنية أخرى</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void stopClip();
            onDone(full ? 0 : from, full, full ? PREVIEW_SECONDS : to - from);
          }}
          disabled={!url}
          style={{ flex: 1.3, height: 48, borderRadius: 12, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#F6B93B", opacity: url ? 1 : 0.45 }}
        >
          <CheckIcon size={16} color="#0E1A24" />
          <Text style={{ color: "#0E1A24", fontSize: 14, fontWeight: "800" }}>تمّ</Text>
        </Pressable>
      </View>
    </View>
  );
}
