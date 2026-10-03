import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, PanResponder, Pressable, View } from "react-native";
import * as Picker from "expo-image-picker";
import { Audio } from "expo-av";
import { SOUND_SOURCE, STORY_SECONDS } from "@athar/shared";
import { Text, TextInput } from "./type";
import { CheckIcon, CloseIcon, MusicIcon, PauseIcon, PlayIcon } from "./icons";
import { baseUrl, currentAccess } from "../lib/api";
import { uploadSound } from "../lib/upload";
import { ar } from "../lib/format";

/** ما رُفع وسُحب صوتُه — يبقى في الناشر فيُعاد قصُّه بلا رفعٍ ثانٍ. */
export type SoundSource = { mediaId: string; seconds: number; peaks: number[] };
export type SoundChoice = SoundSource & { start: number; end: number; label: string };

/** أقصرُ مقطعٍ يُقبل، وطولُه حين يُفتح الشريط أوّل مرّة. */
const MIN = 3;
const FIRST = 15;

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${ar(Math.floor(whole / 60))}:${ar(String(whole % 60).padStart(2, "0"))}`;
};

/**
 * صوتُ القصّة (القاعدة ٢٣٨) — **بقرار المالك**: يُختار فيديو من الاستديو،
 * فيسحب الخادمُ صوتَه ويرمي صورتَه، ثمّ يُقصّ هنا على موجته ويُسمع قبل اعتماده.
 *
 * والقصُّ لا يحدث على الجهاز: البدايةُ والنهاية تُرسلان مع القصّة، والخادمُ يقصّ
 * ويُبقي المقطعَ وحده — فلا يبقى الأصلُ في الدلو. وطبقةٌ لا `Modal` (القاعدة ١٢٦).
 */
export function StorySound({
  initial,
  onDone,
  onRemove,
  onClose,
}: {
  initial: SoundChoice | null;
  onDone: (choice: SoundChoice) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<SoundSource | null>(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [start, setStart] = useState(initial?.start ?? 0);
  const [end, setEnd] = useState(initial?.end ?? 0);
  const [label, setLabel] = useState(initial?.label ?? "");

  async function pick() {
    setProblem(null);
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      setProblem("لازم تسمح بالوصول لألبومك.");
      return;
    }
    const result = await Picker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      // الصورةُ تُرمى على الخادم، فلا تُرفع بدقّتها: الجودةُ المتوسّطة تُصغّر
      // الملفّ أضعافاً ويبقى صوتُها كما هو.
      videoQuality: Picker.UIImagePickerControllerQualityType.Medium,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const seconds = Math.round((asset.duration ?? 0) / 1000);
    if (seconds > SOUND_SOURCE.seconds) {
      setProblem(`المقطع طويل — الحدّ ${ar(SOUND_SOURCE.seconds / 60)} دقائق`);
      return;
    }
    if (asset.fileSize && asset.fileSize > SOUND_SOURCE.bytes) {
      setProblem("المقطع كبير — اختر مقطعاً أقصر");
      return;
    }

    setBusy(true);
    try {
      const made = await uploadSound(asset.uri, asset.mimeType ?? "video/mp4");
      setSource(made);
      setStart(0);
      setEnd(Math.min(FIRST, made.seconds));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "تعذّر سحب الصوت");
    } finally {
      setBusy(false);
    }
  }

  // أوّلُ فتحٍ بلا صوتٍ سابق يذهب إلى الاستديو مباشرةً: من ضغط «موسيقى» يريد أن يختار.
  useEffect(() => {
    if (!initial) void pick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(8,13,18,.9)", paddingTop: 54, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <MusicIcon size={20} color="#F6B93B" />
        <Text style={{ flex: 1, color: "#fff", fontSize: 17, fontWeight: "800" }}>صوت القصة</Text>
        <Pressable
          accessibilityLabel="إغلاق"
          onPress={onClose}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.16)" }}
        >
          <CloseIcon size={16} color="#fff" />
        </Pressable>
      </View>

      {busy ? (
        <View style={{ alignItems: "center", marginTop: 40, gap: 12 }}>
          <ActivityIndicator color="#fff" />
          <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 13 }}>نسحب الصوت من المقطع…</Text>
        </View>
      ) : source ? (
        <Trimmer
          source={source}
          start={start}
          end={end}
          onChange={(a, b) => {
            setStart(a);
            setEnd(b);
          }}
        />
      ) : null}

      {problem ? (
        <Text accessibilityRole="alert" style={{ color: "#FF7A5A", fontSize: 13, textAlign: "center", marginTop: 18 }}>
          {problem}
        </Text>
      ) : null}

      {source && !busy ? (
        <>
          <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11.5, fontWeight: "600", marginTop: 22, marginBottom: 6 }}>
            اسم الصوت (اختياري)
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            maxLength={40}
            placeholder="مثلاً: اسم الأغنية"
            placeholderTextColor="rgba(255,255,255,.4)"
            style={{ height: 44, borderRadius: 12, paddingHorizontal: 12, color: "#fff", fontSize: 14, backgroundColor: "rgba(255,255,255,.1)" }}
          />
        </>
      ) : null}

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: "row", gap: 10, paddingBottom: 34 }}>
        <Pressable
          onPress={() => void pick()}
          disabled={busy}
          style={{ flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)", opacity: busy ? 0.5 : 1 }}
        >
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>{source ? "مقطع آخر" : "اختر مقطعاً"}</Text>
        </Pressable>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            style={{ flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.14)" }}
          >
            <Text style={{ color: "#FF7A5A", fontSize: 13.5, fontWeight: "700" }}>احذف الصوت</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => source && onDone({ ...source, start, end, label: label.trim() })}
          disabled={!source || busy}
          style={{
            flex: 1.3,
            height: 48,
            borderRadius: 12,
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F6B93B",
            opacity: !source || busy ? 0.45 : 1,
          }}
        >
          <CheckIcon size={16} color="#0E1A24" />
          <Text style={{ color: "#0E1A24", fontSize: 14, fontWeight: "800" }}>اعتمد</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * شريطُ القصّ: الموجةُ كلُّها، وفوقها نافذةٌ تُسحب من وسطها فتنتقل ومن طرفيها
 * فتطول وتقصر — بين ثلاث ثوانٍ و`STORY_SECONDS`. والزمنُ من اليسار إلى اليمين
 * كأيّ شريط تشغيل: اتّجاهُ الزمن ليس اتّجاهَ الكتابة.
 */
function Trimmer({
  source,
  start,
  end,
  onChange,
}: {
  source: SoundSource;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  const width = Dimensions.get("window").width - 32;
  const total = Math.max(1, source.seconds);
  const px = width / total;
  const longest = Math.min(STORY_SECONDS, total);

  const live = useRef({ start, end, onChange });
  live.current = { start, end, onChange };
  const grab = useRef<{ mode: "move" | "head" | "tail"; start: number; end: number }>({ mode: "move", start: 0, end: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const x = event.nativeEvent.locationX;
        const { start: a, end: b } = live.current;
        const head = a * px;
        const tail = b * px;
        if (Math.abs(x - head) < 22) grab.current = { mode: "head", start: a, end: b };
        else if (Math.abs(x - tail) < 22) grab.current = { mode: "tail", start: a, end: b };
        else if (x > head && x < tail) grab.current = { mode: "move", start: a, end: b };
        else {
          // ضغطةٌ خارج النافذة تنقلها إلى حيث ضُغط.
          const length = b - a;
          const next = Math.max(0, Math.min(total - length, x / px - length / 2));
          live.current.onChange(next, next + length);
          grab.current = { mode: "move", start: next, end: next + length };
        }
      },
      onPanResponderMove: (_e, g) => {
        const shift = g.dx / px;
        const { mode, start: a, end: b } = grab.current;
        if (mode === "move") {
          const length = b - a;
          const next = Math.max(0, Math.min(total - length, a + shift));
          live.current.onChange(next, next + length);
        } else if (mode === "head") {
          const next = Math.max(Math.max(0, b - longest), Math.min(b - MIN, a + shift));
          live.current.onChange(next, b);
        } else {
          const next = Math.min(Math.min(total, a + longest), Math.max(a + MIN, b + shift));
          live.current.onChange(a, next);
        }
      },
    }),
  ).current;

  // المعاينةُ تدور داخل النافذة ما دامت تُسمع، وتنتقل معها إن سُحبت.
  const sound = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const span = useRef({ start, end });
  span.current = { start, end };

  useEffect(() => {
    let alive = true;
    void Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    Audio.Sound.createAsync(
      { uri: `${baseUrl}/v1/media/${source.mediaId}`, headers: { authorization: `Bearer ${currentAccess()}` } },
      { shouldPlay: false, progressUpdateIntervalMillis: 100 },
      (status) => {
        if (!status.isLoaded) return;
        const seconds = status.positionMillis / 1000;
        setAt(status.isPlaying ? seconds : null);
        if (status.isPlaying && seconds >= span.current.end) {
          void sound.current?.setPositionAsync(span.current.start * 1000).catch(() => {});
        }
      },
    )
      .then(({ sound: made }) => {
        if (alive) sound.current = made;
        else void made.unloadAsync();
      })
      .catch(() => {});
    return () => {
      alive = false;
      const made = sound.current;
      sound.current = null;
      void made?.unloadAsync().catch(() => {});
    };
  }, [source.mediaId]);

  // نافذةٌ سُحبت والصوتُ يُسمع: يبدأ من أوّلها الجديد.
  useEffect(() => {
    if (playing) void sound.current?.setPositionAsync(start * 1000).catch(() => {});
  }, [start, playing]);

  async function toggle() {
    const made = sound.current;
    if (!made) return;
    try {
      if (playing) {
        await made.pauseAsync();
        setPlaying(false);
      } else {
        await made.setPositionAsync(start * 1000);
        await made.playAsync();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    }
  }

  const peaks = source.peaks.length ? source.peaks : new Array(60).fill(0.3);
  const bar = width / peaks.length;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Pressable
          accessibilityLabel={playing ? "أوقف المعاينة" : "اسمع المقطع"}
          onPress={() => void toggle()}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}
        >
          {playing ? <PauseIcon size={18} color="#0E1A24" /> : <PlayIcon size={18} color="#0E1A24" />}
        </Pressable>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
          {clock(start)} – {clock(end)}، {ar(Math.round(end - start))} ثانية
        </Text>
      </View>

      <View {...pan.panHandlers} style={{ direction: "ltr", width, height: 72, justifyContent: "center" }}>
        <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", height: 56, direction: "ltr" }}>
          {peaks.map((value, i) => {
            const t = (i + 0.5) / peaks.length * total;
            const inside = t >= start && t <= end;
            return (
              <View
                key={i}
                style={{
                  width: Math.max(1, bar - 1.5),
                  marginRight: 1.5,
                  height: Math.max(3, value * 54),
                  borderRadius: 2,
                  backgroundColor: inside ? "#F6B93B" : "rgba(255,255,255,.28)",
                }}
              />
            );
          })}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: start * px,
            width: Math.max(8, (end - start) * px),
            top: 0,
            bottom: 0,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: "#fff",
          }}
        />
        {[start, end].map((value, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{ position: "absolute", left: value * px - 6, top: 22, width: 12, height: 28, borderRadius: 6, backgroundColor: "#fff" }}
          />
        ))}
        {at !== null ? (
          <View pointerEvents="none" style={{ position: "absolute", left: at * px - 1, top: 4, bottom: 4, width: 2, backgroundColor: "#FF7A5A" }} />
        ) : null}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", direction: "ltr", marginTop: 6 }}>
        <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 11 }}>{clock(0)}</Text>
        <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 11 }}>{clock(total)}</Text>
      </View>
      <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11.5, textAlign: "center", marginTop: 12 }}>
        اسحب النافذة لتختار الجزء، واسحب طرفيها لتطوّله أو تقصّره — حتى {ar(STORY_SECONDS)} ثانية
      </Text>
    </View>
  );
}
