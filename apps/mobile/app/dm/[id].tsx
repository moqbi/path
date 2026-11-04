import { Spinner } from "../../components/spinner";
import { chatRefused } from "../../lib/dm-closed";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReportButton, ReportSheet } from "../../components/report-sheet";
import { SwipeRow } from "../../components/swipe-row";
import { Avatar } from "../../components/avatar";
import { scrolled } from "../../lib/scrolled";
import { View, FlatList, Pressable } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Picker from "expo-image-picker";
import { Audio, VOICE_PRESET } from "../../lib/av";
import { ChatLine, bubbleStyle, needsHead } from "../../components/chat-line";
import { viewPhoto } from "../../components/photo-viewer";
import { MediaImage } from "../../components/media-image";
import { ScreenHeader } from "../../components/screen-header";
import { Ticks, receiptOf } from "../../components/receipt";
import { CameraIcon, CloseIcon, FlagIcon, ModDeleteIcon, PencilIcon, TrashIcon, MicIcon, PauseIcon, PlayIcon, PlusIcon, SendIcon, StickerIcon } from "../../components/icons";
import { SourceSheet } from "../../components/source-sheet";
import { takeShot } from "../../lib/capture";
import { StickerImage, StickerPanel } from "../../components/sticker-panel";
import { DEV_FEATURES } from "../../lib/dev-features";
import { SelectableText } from "../../components/selectable-text";
import { LinkPreview } from "../../components/link-preview";
import { api, baseUrl, currentAccess } from "../../lib/api";
import { uploadFile } from "../../lib/upload";
import { useKeyboardInset } from "../../lib/keyboard";
import { keys } from "../../lib/queries";
import { useOpenThread } from "../../lib/open-thread";
import { useSession } from "../../lib/session";
import { ar } from "../../lib/format";
import { colors } from "../../theme/tokens";

type Line = {
  id: string;
  body: string;
  kind: "TEXT" | "VOICE" | "PHOTO";
  mediaId: string | null;
  seconds: number | null;
  senderId: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  editedAt: string | null;
  /** ملصقٌ بدل النصّ (القاعدة ٢٩١). */
  sticker?: { mediaId: string } | null;
  /** مقطعٌ صوتيّ يُرفع الآن — يُرسم في الحال قبل أن يردّ الخادم (القاعدة ٤٢٢). */
  pending?: boolean;
};

const clock = (seconds: number) =>
  `${ar(Math.floor(seconds / 60))}:${ar(String(seconds % 60).padStart(2, "0"))}`;

/**
 * المقطعُ الذي يُسمع الآن — واحدٌ في المحادثة كلّها: تشغيلُ مقطعٍ يوقف
 * ما قبله، فلا يتكلّم اثنان فوق بعض.
 */
let speaking: (() => void) | null = null;

/**
 * فقاعة صوت: زرُّ تشغيلٍ وشريطٌ ومدّة — لا مشغّلُ نظامٍ عارٍ.
 *
 * والزرُّ يقول ما يجري (القاعدة ٢٢٢): دوّارةٌ وهو يُجلب، ثمّ إيقافٌ مؤقّتٌ
 * وهو يُسمع، والشريطُ يمتلئ والوقتُ يعدّ ما مضى. كان «تشغيل» ثابتاً فلا
 * يُعرف أبدأ المقطعُ أم لا. وبانتهائه يعود إلى أوّله فيُعاد بضغطة.
 */
function Voice({ mediaId, seconds, mine }: { mediaId: string; seconds: number; mine: boolean }) {
  const sound = useRef<Audio.Sound | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(seconds * 1000);

  useEffect(
    () => () => {
      void sound.current?.unloadAsync();
      if (speaking === pause) speaking = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function pause() {
    void sound.current?.pauseAsync();
    setState("paused");
  }

  async function toggle() {
    if (state === "loading") return;
    if (state === "playing") {
      pause();
      if (speaking === pause) speaking = null;
      return;
    }
    if (speaking && speaking !== pause) speaking();
    speaking = pause;

    if (sound.current) {
      await sound.current.playAsync();
      setState("playing");
      return;
    }
    setState("loading");
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound: made } = await Audio.Sound.createAsync(
        { uri: `${baseUrl}/v1/media/${mediaId}`, headers: { authorization: `Bearer ${currentAccess()}` } },
        { shouldPlay: true, progressUpdateIntervalMillis: 200 },
      );
      made.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setAt(status.positionMillis);
        if (status.durationMillis) setLength(status.durationMillis);
        if (status.didJustFinish) {
          void made.setPositionAsync(0);
          void made.pauseAsync();
          setAt(0);
          setState("idle");
          if (speaking === pause) speaking = null;
        }
      });
      sound.current = made;
      setState("playing");
    } catch {
      setState("idle");
      if (speaking === pause) speaking = null;
    }
  }

  // داخل فقاعة الرسالة كالنصّ (القاعدة ٤٠٤): أرضُها أرضُ الفقاعة، فالحبرُ حبرُ النصّ.
  const ink = colors.ink2;
  const started = state === "playing" || state === "paused";
  const progress = started && length > 0 ? Math.min(1, at / length) : 0;
  const shown = started ? Math.floor(at / 1000) : seconds;

  return (
    <Pressable
      onPress={() => void toggle()}
      accessibilityRole="button"
      accessibilityLabel={state === "playing" ? "إيقاف مؤقّت" : "تشغيل الرسالة الصوتية"}
      style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: mine ? colors.paper : colors.chip }}>
        {state === "loading" ? (
          <Spinner size="small" color={ink} />
        ) : state === "playing" ? (
          <PauseIcon size={13} color={ink} />
        ) : (
          <PlayIcon size={13} color={ink} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: colors.line }}>
        <View style={{ width: `${progress * 100}%`, height: 3, borderRadius: 2, backgroundColor: ink }} />
      </View>
      <Text style={{ color: ink, fontSize: 12, fontWeight: "600" }}>{clock(shown)}</Text>
    </Pressable>
  );
}

/**
 * المحادثة.
 *
 * فقاعةٌ لكلّ رسالة، وتحت رسائلي إيصالها. ولمسةٌ على فقاعتي تكشف
 * «تعديل»: النصّ يُصحَّح مكانه ويبقى أثر التعديل مكتوباً للطرفين — لا
 * نُخفي أنّ الكلام تغيّر.
 */
/**
 * ما في الفقاعة حين تُسحب (القاعدة ٣٨٩): حشوتُها وأرضُها بلا حدٍّ ولا انحناء — الحدُّ والانحناءُ
 * على `SwipeRow` الذي يلفّها، فتنكشف الأيقوناتُ داخل الفقاعة لا في قرصٍ بجانبها.
 */
function inner(mine: boolean) {
  const b = bubbleStyle(mine);
  return {
    alignSelf: "stretch" as const,
    paddingHorizontal: b.paddingHorizontal,
    paddingVertical: b.paddingVertical,
    backgroundColor: b.backgroundColor,
  };
}

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useOpenThread(`/dm/${id}`);
  const me = useSession((s) => s.me);
  const client = useQueryClient();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const list = useRef<FlatList<Line>>(null);
  /*
    القائمةُ تلتصق بآخرها ما دام صاحبُها عنده: عند الفتح، وبعد الإرسال،
    وحين يصعد الكيبورد — كانت تبقى حيث هي فيُكتب السطرُ ويُرسل ولا يُرى.
    ومن صعد يقرأ قديماً لا يُسحب إلى الأسفل برسالةٍ وصلت.
  */
  // والقائمةُ مقلوبة (`inverted`): آخرُها أوّلُها وموضعُها صفر، فتُفتح عنده بلا قفز —
  // كانت تُفتح من أعلاها ثمّ تُسحب إلى آخرها مع كلّ دفعةٍ ترسمها، فتنزلق المحادثةُ
  // الطويلةُ مراراً في كلّ فتح. والجديدُ يدخل من أسفلها وهي واقفةٌ عنده.
  const pinned = useRef(true);
  const toEnd = (animated = true) => {
    if (pinned.current) requestAnimationFrame(() => list.current?.scrollToOffset({ offset: 0, animated }));
  };
  useEffect(() => {
    if (keyboard > 0) toEnd();
  }, [keyboard]);

  const [body, setBody] = useState("");
  const [stickers, setStickers] = useState(false);
  // نافذةُ الزائد: الكاميرا والاستوديو (القاعدة ٢٩٥).
  const [attach, setAttach] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [taping, setTaping] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // ما سُجِّل ووقف ولم يُرسل بعد: يُسمع ويُحذف قبل أن يخرج.
  const [tape, setTape] = useState<{ uri: string; seconds: number } | null>(null);
  const [outbox, setOutbox] = useState<Line[]>([]);
  const [hearing, setHearing] = useState(false);
  const heard = useRef<Audio.Sound | null>(null);
  const recorder = useRef<Audio.Recording | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxSeconds = me?.isPlus ? 120 : 20;

  const thread = useQuery({
    queryKey: keys.thread(id),
    queryFn: () =>
      api<{ id: string; other: { id: string; name: string; isPlus?: boolean; tag?: { name: string; bg: string; fg: string } | null; avatarMediaId: string | null; frame: { spec: string; mediaId: string | null; frameHole?: number | null } | null; charm: { spec: string; mediaId: string | null } | null }; messages: Line[] }>(
        `/v1/dm/${id}?limit=50`,
      ),
    refetchInterval: 8_000,
  });

  // فتحُ المحادثة يعني قراءتها: الإيصال يُكتب عند الفتح لا عند الخروج.
  useEffect(() => {
    if (!thread.data) return;
    void api(`/v1/dm/${id}/read`, { method: "POST" }).then(() => {
      void client.invalidateQueries({ queryKey: keys.dm });
    });
  }, [thread.data, id, client]);

  useEffect(() => () => {
    if (ticker.current) clearInterval(ticker.current);
    void recorder.current?.stopAndUnloadAsync();
    void heard.current?.unloadAsync();
  }, []);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.thread(id) });
    void client.invalidateQueries({ queryKey: keys.dm });
  };

  const send = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api(`/v1/dm/${id}/messages`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
    // «مقفل الخاص» (القاعدة ٣٨٥) سطرٌ زجاجيّ في أعلى الشاشة، وغيرُه تحت الحقل.
    onError: (problem: Error) =>
      problem.message.includes("مقفل الخاص") ? chatRefused(problem) : setError(problem.message),
  });

  const edit = useMutation({
    mutationFn: (input: { messageId: string; body: string }) =>
      api(`/v1/messages/${input.messageId}`, { method: "PATCH", body: JSON.stringify({ body: input.body }) }),
    onSuccess: () => {
      setEditing(null);
      setShown(null);
      refresh();
    },
  });

  const drop = useMutation({
    mutationFn: (messageId: string) => api(`/v1/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: () => refresh(),
    onError: (e) => setError(e instanceof Error ? e.message : "تعذّر الحذف"),
  });

  const modDrop = useMutation({
    mutationFn: (messageId: string) => api(`/v1/moderation/messages/${messageId}`, { method: "DELETE" }),
    onSuccess: () => refresh(),
    onError: (e) => setError(e instanceof Error ? e.message : "تعذّر الحذف"),
  });

  async function beginTape() {
    setError(null);
    setTape(null);
    const granted = await Audio.requestPermissionsAsync();
    if (!granted.granted) {
      setError("لازم تسمح بالميكروفون.");
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const { recording } = await Audio.Recording.createAsync(
      VOICE_PRESET,
    );
    recorder.current = recording;
    setTaping(true);
    setSeconds(0);

    // يقف وحده عند الحدّ، فلا يكتشف صاحبه بعد دقيقتين أنّ ما سجّله لن يُقبل.
    ticker.current = setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= maxSeconds) void stopTape(true);
        return value + 1;
      });
    }, 1000);
  }

  /**
   * الإيقاف لا الإرسال.
   *
   * ما سُجِّل يقف ويُعرض فيُسمع أو يُحذف، ثمّ يُرسل بزرٍّ ثانٍ — ومن
   * أرسل بمجرّد أن رفع إصبعه أرسل ما لم يسمعه.
   */
  async function stopTape(keep: boolean) {
    if (ticker.current) clearInterval(ticker.current);
    const machine = recorder.current;
    recorder.current = null;
    setTaping(false);
    const length = Math.max(1, seconds);
    setSeconds(0);
    if (!machine) return;

    await machine.stopAndUnloadAsync().catch(() => undefined);
    // يُعاد وضعُ الصوت إلى السمّاعة، وإلّا خرجت المعاينة خافتةً في آبل.
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    const uri = machine.getURI();
    if (!keep || !uri) return;
    setTape({ uri, seconds: length });
  }

  async function hearTape() {
    if (!tape) return;
    if (heard.current) {
      // إيقافٌ مؤقّتٌ يُستأنف من حيث وقف، والانتهاءُ يُرجعه إلى أوّله.
      if (hearing) await heard.current.pauseAsync();
      else await heard.current.playAsync();
      setHearing(!hearing);
      return;
    }
    const { sound } = await Audio.Sound.createAsync({ uri: tape.uri }, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.setPositionAsync(0);
        void sound.pauseAsync();
        setHearing(false);
      }
    });
    heard.current = sound;
    setHearing(true);
  }

  async function dropTape() {
    await heard.current?.unloadAsync().catch(() => undefined);
    heard.current = null;
    setHearing(false);
    setTape(null);
  }

  // الرفعُ والفحصُ على الخادم ثمّ الإرسالُ ثوانٍ، فيُرسم المقطعُ في الحال بساعةٍ مكان
  // الإيصال، ويذهب حين تصل رسالتُه الحقيقيّة أو يفشل (القاعدة ٤٢٢).
  async function sendTape() {
    if (!tape) return;
    const { uri, seconds: length } = tape;
    const local: Line = {
      id: `local-${Date.now()}`,
      body: "",
      kind: "VOICE",
      mediaId: null,
      seconds: length,
      senderId: me?.id ?? "",
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
      editedAt: null,
      pending: true,
    };
    setOutbox((lines) => [...lines, local]);
    pinned.current = true;
    list.current?.scrollToOffset({ offset: 0, animated: true });
    await dropTape();
    try {
      let mediaId: string;
      try {
        mediaId = await uploadFile(uri, "audio/mp4", "VOICE");
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : "تعذّر الإرسال");
        return;
      }
      // خطأُ الإرسال يقوله `onError` نفسُه («مقفل الخاص» سطرٌ زجاجيّ وغيرُه تحت الحقل).
      await send.mutateAsync({ kind: "VOICE", mediaId, seconds: length }).catch(() => undefined);
      await client.refetchQueries({ queryKey: keys.thread(id) }).catch(() => undefined);
    } finally {
      setOutbox((lines) => lines.filter((line) => line.id !== local.id));
    }
  }

  /** صورةٌ من الكاميرا أو الألبوم تُرفع ثمّ تُرسل. */
  async function sendAsset(asset: { uri: string; mimeType?: string | null; width: number; height: number }) {
    try {
      const mediaId = await uploadFile(asset.uri, asset.mimeType ?? "image/jpeg", "MESSAGE", asset);
      pinned.current = true;
      send.mutate({ kind: "PHOTO", mediaId });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر الإرسال");
    }
  }

  /*
    العودة من الكاميرا المدمجة (القاعدة ٥ب): اللقطةُ تنتظر في `lib/capture` وتُقرأ مرّةً.
    و`useFocusEffect` لأنّ المحادثة قائمةٌ تحت الكاميرا بحالتها لم تُبنَ من جديد.
  */
  // والنداءُ ثابتٌ (`useCallback`): بلاه يُعاد مع كلّ رسمةٍ والمحادثةُ ظاهرة.
  const sendRef = useRef(sendAsset);
  sendRef.current = sendAsset;
  useFocusEffect(
    useCallback(() => {
      const shot = takeShot();
      if (shot && !shot.video) void sendRef.current({ uri: shot.uri, mimeType: shot.mime, width: shot.width, height: shot.height });
    }, []),
  );

  async function sendPhoto() {
    const granted = await Picker.requestMediaLibraryPermissionsAsync();
    if (!granted.granted) {
      setError("لازم تسمح بالوصول لألبومك.");
      return;
    }
    const result = await Picker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    await sendAsset(result.assets[0]);
  }

  const sendText = () => {
    const text = body.trim();
    if (!text) return;
    setBody("");
    // من أرسل يريد أن يرى ما أرسل.
    pinned.current = true;
    send.mutate({ kind: "TEXT", body: text });
  };

  const other = thread.data?.other;
  const rows = useMemo(
    () => [...(thread.data?.messages ?? []), ...outbox].reverse(),
    [thread.data?.messages, outbox],
  );

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader
        title={other?.name ?? "محادثة"}
        back="/messages"
        // صورةُ من أحادثه مكانَ العلامة — **بقرار المالك**: الرأسُ يقول مع من لا في أيّ تطبيق.
        face={
          other ? (
            <Pressable accessibilityLabel={`ملف ${other.name}`} onPress={() => router.push(`/u/${other.id}` as never)}>
              <Avatar name={other.name} size={32} mediaId={other.avatarMediaId} frame={other.frame} charm={other.charm} />
            </Pressable>
          ) : undefined
        }
        // اسمُ من أحادثه بابُ ملفّه: من فتح محادثةً قد يريد أن يرى صاحبها.
        onTitlePress={other ? () => router.push(`/u/${other.id}` as never) : undefined}
      />

      {/* يصعد كلُّه بارتفاع الكيبورد (`useKeyboardInset`) لا بحسابٍ يُخطئ بقدر الرأس. */}
      <View style={{ flex: 1, paddingBottom: keyboard }}>
        <FlatList
          ref={list}
          scrollEnabled={!swiping}
          onScrollBeginDrag={scrolled}
          data={rows}
          inverted
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
            ) : (
              <Text style={{ color: colors.groundMuted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
                لا رسائل بعد. اكتب أول سطر.
              </Text>
            )
          }
          renderItem={({ item, index }) => {
            if (item.pending) {
              return (
                <ChatLine
                  person={me ?? { name: "", avatarMediaId: null }}
                  mine
                  at={item.createdAt}
                  head={needsHead(item, rows[index + 1])}
                  meta={<Text style={{ color: colors.groundFaint, fontSize: 10.5 }}>يُرسل…</Text>}
                >
                  <View style={[bubbleStyle(true), { flexDirection: "row", alignItems: "center", gap: 10, opacity: 0.75 }]}>
                    <Spinner size="small" color={colors.clay} />
                    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line }} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{clock(item.seconds ?? 0)}</Text>
                  </View>
                </ChatLine>
              );
            }
            const mine = item.senderId === me?.id;
            const open = editing === item.id;
            // صورةُ المرسل واسمُه ووسمُه فوق أوّل رسالةٍ من سلسلته (القاعدة ٢١٦).
            const person = mine ? me : other;
            // بالسحب لا بالضغطة في نسخة التطوير (القاعدة ٣٦٧)، فالضغطةُ لا تكشف شيئاً.
            const toggle = DEV_FEATURES ? undefined : () => setShown((v) => (v === item.id ? null : item.id));

            // ما يُسحب الفقاعةُ وحدها — **بقرار المالك**: كانت السحبةُ تُزيح السطرَ كلَّه بصورته واسمه،
            // والأيقوناتُ تنكشف عند حافّة الشاشة خارج الفقاعة. الآن تنكشف داخل حدّها (`radius` ١٨)
            // وما حولها ساكن (القاعدة ٣٨٦).
            const swipe = DEV_FEATURES && !open;
            const text = item.kind === "TEXT" && !item.sticker;
            // ما يجلس في فقاعة: النصُّ والصوت — تنكشف أفعالُ السحب داخل حدّها.
            const bubbled = text || (item.kind === "VOICE" && Boolean(item.mediaId));
            const content = (
              open ? (
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
                  <Pressable
                    onPress={() => viewPhoto(item.mediaId)}
                    onLongPress={toggle}
                  >
                    <MediaImage mediaId={item.mediaId} style={{ width: 220, height: 220, borderRadius: 16 }} />
                  </Pressable>
                ) : item.sticker ? (
                  // الملصقُ رسمُه وحده بلا فقاعة، والضغطةُ تكشف البلاغ كالنصّ.
                  <Pressable onPress={toggle}>
                    <StickerImage mediaId={item.sticker.mediaId} />
                  </Pressable>
                ) : item.kind === "VOICE" && item.mediaId ? (
                  // في فقاعةٍ كالنصّ (القاعدة ٤٠٤) — وفي السحب الفقاعةُ هي `SwipeRow` نفسُه.
                  <View style={swipe ? inner(mine) : bubbleStyle(mine)}>
                    <Voice mediaId={item.mediaId} seconds={item.seconds ?? 0} mine={mine} />
                  </View>
                ) : (
                  <Pressable
                    // ضغطةٌ على رسالتي تكشف «تعديل»، وعلى رسالته «إبلاغ».
                    onPress={toggle}
                    // في السحب الفقاعةُ هي `SwipeRow` نفسُه (أرضُه وحدُّه)، وما فيها يُزاح داخلها.
                    style={swipe ? inner(mine) : bubbleStyle(mine)}
                  >
                    <SelectableText
                      text={item.body}
                      onTap={toggle}
                      style={{ color: colors.ink, fontSize: 14.5, lineHeight: 24 }}
                    />
                    <LinkPreview text={item.body} style={{ marginTop: 10, marginBottom: 0 }} />
                  </Pressable>
                )
            );
            const bubble = !swipe ? (
              content
            ) : (
              <View style={bubbled ? { alignSelf: "stretch" } : undefined}>
                {mine ? (
                  <SwipeRow
                    width={56}
                    radius={18}
                    surface={bubbled ? inner(mine).backgroundColor as string : item.sticker ? colors.groundSolid : "transparent"}
                    inside={bubbled ? bubbleStyle(mine) : undefined}
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
                      delete: <TrashIcon size={20} color={bubbled ? colors.live : "#fff"} />,
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
                    surface={bubbled ? inner(mine).backgroundColor as string : item.sticker ? colors.groundSolid : "transparent"}
                    inside={bubbled ? bubbleStyle(mine) : undefined}
                    /* المشرفُ يحذف بصلاحيته — سلّةٌ ودرع (القاعدة ٣٩٠) — وغيرُه يُبلغ. */
                    confirmLabel={me?.canModerate ? "حذف بصلاحية الإشراف" : "بلاغ عن الرسالة"}
                    onSwiping={setSwiping}
                    icons={{
                      delete: me?.canModerate ? (
                        <ModDeleteIcon size={20} color={bubbled ? colors.live : "#fff"} />
                      ) : (
                        <FlagIcon size={20} color={bubbled ? colors.live : "#fff"} />
                      ),
                    }}
                    onDelete={() =>
                      me?.canModerate ? modDrop.mutateAsync(item.id).then(() => undefined) : setReporting(item.id)
                    }
                  >
                    {content}
                  </SwipeRow>
                )}
              </View>
            );

            return (
              <ChatLine
                person={person ?? { name: "", avatarMediaId: null }}
                mine={mine}
                at={item.createdAt}
                head={needsHead(item, rows[index + 1])}
                meta={
                  <>
                    {item.editedAt ? <Text style={{ color: colors.groundFaint, fontSize: 10 }}>عُدّلت</Text> : null}
                    {mine ? <Ticks state={receiptOf(item)} size={14} /> : null}
                    {shown === item.id ? (
                      mine ? (
                        item.kind === "TEXT" && !item.sticker ? (
                          <Pressable
                            onPress={() => {
                              setDraft(item.body);
                              setEditing(item.id);
                            }}
                          >
                            <Text style={{ color: colors.clayInk, fontSize: 11.5, fontWeight: "600" }}>تعديل</Text>
                          </Pressable>
                        ) : null
                      ) : (
                        <ReportButton target="MESSAGE" targetId={item.id} />
                      )
                    ) : null}
                  </>
                }
              >
                {bubble}
              </ChatLine>
            );
          }}
        />

        {/* سطر الإرسال: نصّ، وصورة، وصوت. */}
        <View style={{ paddingHorizontal: 20, paddingBottom: keyboard ? 10 : Math.max(insets.bottom, 18), paddingTop: 10 }}>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.live, fontSize: 11.5, textAlign: "center", marginBottom: 8 }}>
              {error}
            </Text>
          ) : null}

          {taping ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, height: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.live, backgroundColor: colors.liveSoft, paddingHorizontal: 16 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live }} />
              <Text style={{ flex: 1, minWidth: 0, color: colors.live, fontSize: 13, fontWeight: "600" }}>
                {clock(seconds)} / {clock(maxSeconds)}
              </Text>
              <Pressable
                accessibilityLabel="إلغاء التسجيل"
                onPress={() => void stopTape(false)}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
              >
                <CloseIcon size={16} color={colors.muted} />
              </Pressable>
              <Pressable
                onPress={() => void stopTape(true)}
                style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>إيقاف</Text>
              </Pressable>
            </View>
          ) : tape ? (
            /* وقف التسجيل: يُسمع، أو يُحذف، أو يُرسل. */
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 14 }}>
              <Pressable
                accessibilityLabel={hearing ? "إيقاف السماع" : "اسمع التسجيل"}
                onPress={() => void hearTape()}
                style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}
              >
                {hearing ? (
                  <PauseIcon size={13} color={colors.ink2} />
                ) : (
                  <PlayIcon size={13} color={colors.ink2} />
                )}
              </Pressable>
              <Text style={{ flex: 1, minWidth: 0, color: colors.ink2, fontSize: 12.5, fontWeight: "600" }}>
                {clock(tape.seconds)}
              </Text>
              <Pressable
                accessibilityLabel="احذف التسجيل"
                onPress={() => void dropTape()}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }}
              >
                <CloseIcon size={16} color={colors.live} />
              </Pressable>
              <Pressable
                onPress={() => void sendTape()}
                style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 13, fontWeight: "700" }}>أرسل</Text>
              </Pressable>
            </View>
          ) : DEV_FEATURES ? (
            /*
              شريطٌ واحد لا أزرارٌ متفرّقة (القاعدة ٢٩٥): الزائدُ والحقلُ والملصقاتُ والمايكُ
              أو الإرسال داخل قرصٍ واحد، والأيقوناتُ بلا أقراصٍ إلا الأخير — الفعلُ الأساسيّ.
              المايكُ ما دام الحقلُ فارغاً، والإرسالُ حين يُكتب شيء.
            */
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                minHeight: 42,
                borderRadius: 21,
                borderWidth: 1,
                borderColor: stickers ? colors.clay : colors.line,
                backgroundColor: colors.card,
                paddingHorizontal: 4,
                paddingVertical: 3,
              }}
            >
              <Pressable
                accessibilityLabel="أرسل صورة"
                onPress={() => setAttach(true)}
                hitSlop={4}
                style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
              >
                <PlusIcon size={20} color={colors.ink2} />
              </Pressable>

              <TextInput
                value={body}
                onChangeText={setBody}
                onFocus={() => setStickers(false)}
                placeholder="اكتب رسالة…"
                placeholderTextColor={colors.faint}
                maxLength={2000}
                multiline
                style={{ flex: 1, minWidth: 0, maxHeight: 110, paddingVertical: 8, paddingHorizontal: 4, fontSize: 13.5, textAlign: "right", color: colors.ink }}
              />

              <Pressable
                accessibilityLabel="الملصقات"
                accessibilityState={{ expanded: stickers }}
                onPress={() => setStickers((v) => !v)}
                hitSlop={4}
                style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
              >
                <StickerIcon size={19} color={stickers ? colors.clay : colors.muted} />
              </Pressable>

              <Pressable
                accessibilityLabel={body.trim() ? "إرسال" : "رسالة صوتية"}
                onPress={body.trim() ? sendText : () => void beginTape()}
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                {body.trim() ? <SendIcon size={16} color={colors.onBrand} /> : <MicIcon size={17} color={colors.onBrand} />}
              </Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="اكتب رسالة…"
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
                accessibilityLabel="رسالة صوتية"
                onPress={() => void beginTape()}
                style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}
              >
                <MicIcon size={19} color={colors.ink2} />
              </Pressable>

              {DEV_FEATURES ? (
                <Pressable
                  accessibilityLabel="الملصقات"
                  accessibilityState={{ expanded: stickers }}
                  onPress={() => setStickers((v) => !v)}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: stickers ? colors.clay : colors.line, backgroundColor: colors.card }}
                >
                  <StickerIcon size={19} color={colors.ink2} />
                </Pressable>
              ) : null}

              <Pressable
                onPress={sendText}
                style={{ height: 48, paddingHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>إرسال</Text>
              </Pressable>
            </View>
          )}

          {DEV_FEATURES && stickers && !taping && !tape ? (
            <View style={{ marginTop: 10 }}>
              <StickerPanel
                tone="light"
                isPlus={me?.isPlus ?? false}
                onPick={(stickerId) => {
                  setStickers(false);
                  pinned.current = true;
                  send.mutate({ kind: "TEXT", stickerId });
                }}
              />
            </View>
          ) : null}

          <SourceSheet
            open={attach}
            title="أرسل صورة"
            onCamera={() => {
              setAttach(false);
              router.push("/camera?mode=picture" as never);
            }}
            onLibrary={() => {
              setAttach(false);
              void sendPhoto();
            }}
            onClose={() => setAttach(false)}
          />

          {!me?.isPlus ? (
            <Text style={{ color: colors.groundFaint, fontSize: 10.5, textAlign: "center", marginTop: 8 }}>
              الصوت حتى {ar(maxSeconds)} ثانية · ومع آثار+ ١٢٠
            </Text>
          ) : null}
        </View>
      </View>
      {reporting ? <ReportSheet target="MESSAGE" targetId={reporting} onClose={() => setReporting(null)} /> : null}
    </SafeAreaView>
  );
}
