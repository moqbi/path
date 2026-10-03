import { useEffect, useRef, useState } from "react";
import { ReportButton } from "../../components/report-sheet";
import { View, FlatList, Pressable, ActivityIndicator } from "react-native";
import { Text, TextInput } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Picker from "expo-image-picker";
import { Audio } from "expo-av";
import { ChatLine, bubbleStyle, needsHead } from "../../components/chat-line";
import { viewPhoto } from "../../components/photo-viewer";
import { MediaImage } from "../../components/media-image";
import { ScreenHeader } from "../../components/screen-header";
import { Ticks, receiptOf } from "../../components/receipt";
import { CameraIcon, CloseIcon, MicIcon, PauseIcon, PlayIcon } from "../../components/icons";
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

  const ink = mine ? colors.onBrand : colors.ink2;
  const started = state === "playing" || state === "paused";
  const progress = started && length > 0 ? Math.min(1, at / length) : 0;
  const shown = started ? Math.floor(at / 1000) : seconds;

  return (
    <Pressable
      onPress={() => void toggle()}
      accessibilityRole="button"
      accessibilityLabel={state === "playing" ? "إيقاف مؤقّت" : "تشغيل الرسالة الصوتية"}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        maxWidth: "78%",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: mine ? colors.clay : colors.card,
        borderWidth: mine ? 0 : 1,
        borderColor: colors.line,
      }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: mine ? "rgba(14,26,36,.18)" : colors.chip }}>
        {state === "loading" ? (
          <ActivityIndicator size="small" color={ink} />
        ) : state === "playing" ? (
          <PauseIcon size={13} color={ink} />
        ) : (
          <PlayIcon size={13} color={ink} />
        )}
      </View>
      <View style={{ width: 90, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: mine ? "rgba(14,26,36,.25)" : colors.line }}>
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
  const pinned = useRef(true);
  const toEnd = (animated = true) => {
    if (pinned.current) requestAnimationFrame(() => list.current?.scrollToEnd({ animated }));
  };
  useEffect(() => {
    if (keyboard > 0) toEnd();
  }, [keyboard]);

  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [taping, setTaping] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // ما سُجِّل ووقف ولم يُرسل بعد: يُسمع ويُحذف قبل أن يخرج.
  const [tape, setTape] = useState<{ uri: string; seconds: number } | null>(null);
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
    onError: (problem: Error) => setError(problem.message),
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
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
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

  async function sendTape() {
    if (!tape) return;
    const { uri, seconds: length } = tape;
    await dropTape();
    try {
      const mediaId = await uploadFile(uri, "audio/mp4", "VOICE");
      pinned.current = true;
      send.mutate({ kind: "VOICE", mediaId, seconds: length });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّر الإرسال");
    }
  }

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

  const other = thread.data?.other;
  const lines = thread.data?.messages ?? [];

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.ground }}>
      <ScreenHeader
        title={other?.name ?? "محادثة"}
        back="/messages"
        // اسمُ من أحادثه بابُ ملفّه: من فتح محادثةً قد يريد أن يرى صاحبها.
        onTitlePress={other ? () => router.push(`/u/${other.id}` as never) : undefined}
      />

      {/* يصعد كلُّه بارتفاع الكيبورد (`useKeyboardInset`) لا بحسابٍ يُخطئ بقدر الرأس. */}
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
            ) : (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>
                لا رسائل بعد. اكتب أول سطر.
              </Text>
            )
          }
          renderItem={({ item, index }) => {
            const mine = item.senderId === me?.id;
            const open = editing === item.id;
            // صورةُ المرسل واسمُه ووسمُه فوق أوّل رسالةٍ من سلسلته (القاعدة ٢١٦).
            const person = mine ? me : other;

            return (
              <ChatLine
                person={person ?? { name: "", avatarMediaId: null }}
                mine={mine}
                at={item.createdAt}
                head={needsHead(item, lines[index - 1])}
                meta={
                  <>
                    {item.editedAt ? <Text style={{ color: colors.faint, fontSize: 10 }}>عُدّلت</Text> : null}
                    {mine ? <Ticks state={receiptOf(item)} size={14} /> : null}
                    {shown === item.id ? (
                      mine ? (
                        item.kind === "TEXT" ? (
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
                {open ? (
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
                    onLongPress={() => setShown((v) => (v === item.id ? null : item.id))}
                  >
                    <MediaImage mediaId={item.mediaId} style={{ width: 220, height: 220, borderRadius: 16 }} />
                  </Pressable>
                ) : item.kind === "VOICE" && item.mediaId ? (
                  <Voice mediaId={item.mediaId} seconds={item.seconds ?? 0} mine={mine} />
                ) : (
                  <Pressable
                    // ضغطةٌ على رسالتي تكشف «تعديل»، وعلى رسالته «إبلاغ».
                    onPress={() => setShown((v) => (v === item.id ? null : item.id))}
                    style={bubbleStyle(mine)}
                  >
                    <Text style={{ color: colors.ink, fontSize: 14.5, lineHeight: 24 }}>{item.body}</Text>
                  </Pressable>
                )}
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

              <Pressable
                onPress={() => {
                  const text = body.trim();
                  if (!text) return;
                  setBody("");
                  // من أرسل يريد أن يرى ما أرسل.
                  pinned.current = true;
                  send.mutate({ kind: "TEXT", body: text });
                }}
                style={{ height: 48, paddingHorizontal: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.clay }}
              >
                <Text style={{ color: colors.onBrand, fontSize: 13.5, fontWeight: "700" }}>إرسال</Text>
              </Pressable>
            </View>
          )}

          {!me?.isPlus ? (
            <Text style={{ color: colors.faint, fontSize: 10.5, textAlign: "center", marginTop: 8 }}>
              الصوت حتى {ar(maxSeconds)} ثانية · ومع آثار+ ١٢٠
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
