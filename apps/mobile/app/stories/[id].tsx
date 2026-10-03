import { useEffect, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator, Dimensions, ScrollView, Animated, PanResponder } from "react-native";
import type { StorySticker, StoryText } from "@athar/shared";
import { Audio } from "expo-av";
import { StoryTexts } from "../../components/story-texts";
import { StoryStickers } from "../../components/story-stickers";
import { ReactionGlyph } from "../../components/reactions";
import { openMaps } from "../../lib/maps";
import { Text } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { ReportButton } from "../../components/report-sheet";
import { Sheet } from "../../components/sheet";
import { Filtered } from "../../components/filtered";
import { StoryVideo } from "../../components/story-video";
import { CloseIcon, EyeIcon, LockIcon } from "../../components/icons";
import { api, baseUrl, currentAccess } from "../../lib/api";
import { storiesQuery } from "../../lib/story-prefetch";
import type { StoryRing } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar, relative } from "../../lib/format";
import { colors } from "../../theme/tokens";

/** مدّة شريحة الصورة. والفيديو مدّته مدّته. */
const SLIDE_MS = 5000;

type Story = {
  id: string;
  mediaId: string;
  caption: string | null;
  filter: string | null;
  seconds: number | null;
  texts?: StoryText[] | null;
  createdAt: string;
  media: { mime: string };
  author: { id: string; name: string; avatarMediaId: string | null };
  _count: { views: number };
  /** خاصّةٌ بمن اختارهم صاحبُها (القاعدة ٢١٩) — اختياريٌّ لخادمٍ أقدم. */
  private?: boolean;
  /** الملصقاتُ وصوتُ القصّة وتفاعلي ومجموعُ التفاعلات (القاعدة ٢٣٨) — اختياريّةٌ لخادمٍ أقدم. */
  stickers?: StorySticker[] | null;
  audioMediaId?: string | null;
  audioSeconds?: number | null;
  myReaction?: Face | null;
  reactions?: number;
};

/** الوجوهُ الخمسة — مفتوحةٌ للجميع (القاعدة ٣). */
const FACES = ["LOVE", "LAUGH", "GASP", "SAD", "SMILE"] as const;
type Face = (typeof FACES)[number];

type Viewer = {
  id: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  seenAt: string;
  reaction?: Face | null;
};

/**
 * عارض القصص.
 *
 * شريط تقدّم لكل شريحة، ولمسةٌ على النصف الأيمن ترجع وعلى الأيسر تتقدّم
 * (وهو المعتاد في RTL)، والضغط المطوّل يوقف العدّ — من يقرأ تعليقاً على
 * صورة لا يجب أن تُسحب من تحته.
 *
 * **والسحبُ إيماءتان — بقرار المالك**: إلى أسفل تُغلق، والقصّةُ تتبع الإصبع
 * وتصغر وتنكشف الشاشةُ تحتها، فإن لم تبلغ الحدّ عادت مكانها. وإلى أعلى
 * تفتح «من شاهدها» لصاحبها. والسحبُ يوقف العدّ كالضغط المطوّل.
 */
export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useSession((s) => s.me);
  const client = useQueryClient();

  /*
    الحشوةُ من مزوّد الجذر لا من `SafeAreaView`: الأخير يقيس موضعه هو، والقصّةُ
    نافذةٌ شفّافة تحت تحويلٍ (السحبُ يصغّرها) — فكان يقرأ صفراً ويجلس الاسمُ
    خلف البطّاريّة وإشارة الشبكة.
  */
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  // من شاهدها: نافذةٌ فوق القصة، والعدُّ يقف ما دامت مفتوحة.
  const [watching, setWatching] = useState(false);
  const [dragging, setDragging] = useState(false);
  const paused = held || watching || dragging;
  const started = useRef(Date.now());
  // الوقفةُ لا تبدأ الشريحة من أوّلها: ما مضى منها يُحفظ ويُستأنف منه.
  const elapsed = useRef(0);

  // من الذاكرة إن جلبها الشريطُ سلفاً — فلا دوّارةَ على أسود (`story-prefetch`).
  const feed = useQuery({
    ...storiesQuery(id),
    queryFn: () => api<{ stories: Story[] }>(`/v1/stories/user/${id}`),
  });

  const stories = feed.data?.stories ?? [];
  const story = stories[index];
  const mine = id === me?.id;
  const video = story?.media.mime.startsWith("video/") ?? false;
  /*
    الصورةُ بصوتها تبقى بطول مقطعها (القاعدة ٢٣٨): خمسُ ثوانٍ تقطع أغنيةً من
    خمس عشرة. والفيديو مدّتُه مدّتُه.
  */
  const span =
    video && story?.seconds
      ? story.seconds * 1000
      : !video && story?.audioMediaId && story.audioSeconds
        ? story.audioSeconds * 1000
        : SLIDE_MS;

  const viewers = useQuery({
    queryKey: ["story-viewers", story?.id],
    queryFn: () => api<{ viewers: Viewer[] }>(`/v1/stories/${story!.id}/viewers`),
    enabled: watching && mine && Boolean(story),
  });

  /*
    صوتُ القصّة: يُجلب مع الشريحة ويقف بوقوفها، ويُكتم بضغط ملصقه — والكتمُ
    يبقى على ما بعدها: من كتم قصّةً في مجلسٍ لا يريد أن تنطق التاليةُ.
  */
  const [muted, setMuted] = useState(false);
  const [audible, setAudible] = useState(false);
  const voice = useRef<Audio.Sound | null>(null);
  const audioId = !video ? story?.audioMediaId ?? null : null;
  useEffect(() => {
    setAudible(false);
    if (!audioId) return;
    let alive = true;
    void Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    Audio.Sound.createAsync(
      { uri: `${baseUrl}/v1/media/${audioId}`, headers: { authorization: `Bearer ${currentAccess()}` } },
      { shouldPlay: false, isLooping: true },
    )
      .then(({ sound }) => {
        if (!alive) {
          void sound.unloadAsync();
          return;
        }
        voice.current = sound;
        // يبدأ من حيث وصل العدّ: التحميلُ قد يتأخّر عن الصورة لحظة.
        void sound
          .setPositionAsync(elapsed.current)
          .then(() => alive && setAudible(true))
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
      const sound = voice.current;
      voice.current = null;
      setAudible(false);
      void sound?.unloadAsync().catch(() => {});
    };
  }, [audioId]);
  /*
    كلُّ نداءٍ على الصوت يُبلع فشلُه: الشريحةُ قد تتبدّل والصوتُ يُفكّ في اللحظة
    نفسها، و«لم يُحمَّل» من صوتٍ ذاهبٍ ليس خطأً يُرى.
  */
  useEffect(() => {
    const sound = voice.current;
    if (!sound || !audible) return;
    (paused ? sound.pauseAsync() : sound.playAsync()).catch(() => {});
  }, [paused, audible]);
  useEffect(() => {
    void voice.current?.setIsMutedAsync(muted).catch(() => {});
  }, [muted, audible]);

  /*
    التفاعلُ السريع — **بقرار المالك**: الوجوهُ الخمسة في أسفل القصّة، والضغطةُ
    تُرسل وتطيّر الوجه، وضغطُ الوجه نفسه ثانيةً يرفعه. ويُكتب في الذاكرة في الحال
    فلا ينتظر الإصبعُ الخادم.
  */
  const [burst, setBurst] = useState<{ face: Face; key: number } | null>(null);
  const fly = useRef(new Animated.Value(0)).current;
  function react(face: Face) {
    if (!story) return;
    const next = story.myReaction === face ? null : face;
    client.setQueryData<{ stories: Story[] }>(storiesQuery(id).queryKey, (old) =>
      old ? { stories: old.stories.map((item) => (item.id === story.id ? { ...item, myReaction: next } : item)) } : old,
    );
    void api(`/v1/stories/${story.id}/react`, { method: "POST", body: JSON.stringify({ kind: next }) }).catch(() => {});
    if (!next) return;
    setBurst({ face: next, key: Date.now() });
    fly.setValue(0);
    Animated.timing(fly, { toValue: 1, duration: 900, useNativeDriver: true }).start(() => setBurst(null));
  }

  const remove = useMutation({
    mutationFn: (storyId: string) => api(`/v1/stories/${storyId}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["stories"] });
      router.back();
    },
  });

  // إيصال المشاهدة يُرسل مرّةً لكل شريحة تُفتح.
  const receipts = useRef<Promise<unknown>[]>([]);
  const seenAll = useRef(false);
  useEffect(() => {
    if (!story) return;
    receipts.current.push(api(`/v1/stories/${story.id}/seen`, { method: "POST" }).catch(() => {}));
    if (index === stories.length - 1) seenAll.current = true;
  }, [story, index, stories.length]);

  /*
    الحلقةُ تبهت ساعةَ تُغلق القصّة لا بعد تحديث الصفحة: كانت قائمةُ الحلقات
    في الذاكرة على حالها، والشاشةُ تحتها لم تُفكّ فلا تُعاد. فمن بلغ آخرَها
    تُطفأ حلقتُه في الحال، ثمّ تُسأل القائمةُ من الخادم بعد أن تصل الإيصالات —
    هو الحَكَم إن بقي فيها ما لم يُرَ.
  */
  useEffect(
    () => () => {
      if (seenAll.current) {
        client.setQueryData<{ rings: StoryRing[] }>(["stories"], (old) =>
          old ? { rings: old.rings.map((ring) => (ring.userId === id ? { ...ring, fresh: false } : ring)) } : old,
        );
      }
      void Promise.allSettled(receipts.current).then(() =>
        client.invalidateQueries({ queryKey: ["stories"], exact: true }),
      );
    },
    [client, id],
  );

  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused || !story) return;
    started.current = Date.now() - elapsed.current;
    const tick = setInterval(() => {
      elapsed.current = Date.now() - started.current;
      const done = elapsed.current / span;
      if (done >= 1) {
        if (index + 1 < stories.length) setIndex(index + 1);
        else router.back();
        return;
      }
      setProgress(done);
    }, 60);
    return () => clearInterval(tick);
  }, [index, paused, span, stories.length, router, story]);

  const screen = Dimensions.get("window");

  const drop = useRef(new Animated.Value(0)).current;
  // ما يتغيّر بين رسمٍ ورسم يُقرأ من مرجع: المستجيبُ يُبنى مرّةً واحدة.
  const live = useRef({ mine, watching, close: () => router.back(), open: () => setWatching(true) });
  live.current = { mine, watching, close: () => router.back(), open: () => setWatching(true) };

  const pan = useRef(
    PanResponder.create({
      // رأسيّةٌ صريحة وحدها تُلتقط — النقرةُ والضغطُ المطوّل يبقيان للنصفين.
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        !live.current.watching && Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: (_e, g) => {
        // إلى أعلى مقاومةٌ خفيفة تقول إنّ هناك شيئاً، لا تحريكٌ كامل.
        drop.setValue(g.dy > 0 ? g.dy : g.dy * 0.25);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 0.9) {
          Animated.timing(drop, { toValue: screen.height, duration: 220, useNativeDriver: false }).start(() =>
            live.current.close(),
          );
          return;
        }
        Animated.spring(drop, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        setDragging(false);
        if ((g.dy < -70 || g.vy < -0.9) && live.current.mine) live.current.open();
      },
      onPanResponderTerminate: () => {
        Animated.spring(drop, { toValue: 0, useNativeDriver: false }).start();
        setDragging(false);
      },
    }),
  ).current;

  /*
    السحبُ إلى أسفل يطوي القصّة دائرةً تحت الإصبع — **بقرار المالك**، كسناب
    (القاعدة ٢١٨): النافذةُ تقصر حتى تصير مربّعاً (`hole`) وتستدير حوافُّها حتى
    تصير دائرة، وتصغر وتنزل مع الإصبع، والمحتوى في وسطها لا يُقصّ من أعلاه.
    وكلُّه بمحرّك جافاسكربت: الارتفاعُ ونصفُ القطر خصائصُ تخطيطٍ لا يحرّكها
    المحرّكُ الأصليّ، وقيمةٌ واحدة لا تُقسَم بين محرّكين.
  */
  const ROUND = screen.height * 0.5;
  const hole = drop.interpolate({ inputRange: [0, ROUND], outputRange: [screen.height, screen.width], extrapolate: "clamp" });
  const lift = drop.interpolate({ inputRange: [0, ROUND], outputRange: [0, (screen.width - screen.height) / 2], extrapolate: "clamp" });
  const sink = {
    height: hole,
    borderRadius: drop.interpolate({ inputRange: [0, ROUND], outputRange: [0, screen.width / 2], extrapolate: "clamp" }),
    transform: [
      { translateY: drop.interpolate({ inputRange: [-200, 0, screen.height], outputRange: [-50, 0, screen.height * 0.7] }) },
      { scale: drop.interpolate({ inputRange: [0, ROUND, screen.height], outputRange: [1, 0.42, 0.3], extrapolate: "clamp" }) },
    ],
  };
  const veil = drop.interpolate({ inputRange: [0, screen.height * 0.6], outputRange: [1, 0], extrapolate: "clamp" });

  if (feed.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0b1219", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!story) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0b1219", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 13.5 }}>لا قصص هنا.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={{ color: colors.clay, fontSize: 13 }}>رجوع</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  function step(next: number) {
    if (next < 0) return;
    if (next >= stories.length) {
      router.back();
      return;
    }
    setIndex(next);
  }

  return (
    <View style={{ flex: 1 }}>
      {/* الأرضيةُ تبهت مع السحب فتنكشف الشاشةُ تحت القصّة. */}
      <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "#0b1219", opacity: veil }} />
    <View {...pan.panHandlers} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Animated.View style={[{ width: screen.width, backgroundColor: "#0b1219", overflow: "hidden" }, sink]}>
    <Animated.View style={{ position: "absolute", left: 0, width: screen.width, height: screen.height, top: lift }}>
      {/* المقطع يُشغَّل، والصورة تُرسم بفلترها. و`<Image>` لا يفكّ MP4. */}
      {video ? (
        <StoryVideo
          source={story.mediaId}
          width={screen.width}
          height={screen.height}
          paused={paused}
        />
      ) : (
        <Filtered
          mediaId={story.mediaId}
          filter={story.filter}
          width={screen.width}
          height={screen.height}
        />
      )}

      {/* نصوصُها فوقها بموضعها ومقاسها — لا محروقةً في الصورة. */}
      <StoryTexts texts={story.texts} width={screen.width} height={screen.height} />

      {/* نصفان للتنقّل: يمينٌ يرجع ويسارٌ يتقدّم، والضغط المطوّل يوقف. */}
      <Pressable
        accessibilityLabel="السابق"
        style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%" }}
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        onPress={() => step(index - 1)}
      />
      <Pressable
        accessibilityLabel="التالي"
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%" }}
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        onPress={() => step(index + 1)}
      />

      {/* الملصقاتُ فوق النصفين: الموقعُ يفتح الخرائط والموسيقى تكتم — وما بينها للتنقّل. */}
      <StoryStickers
        stickers={story.stickers}
        width={screen.width}
        height={screen.height}
        at={new Date(story.createdAt)}
        playing={audible && !paused}
        muted={muted}
        onPlace={(place) => void openMaps({ lat: place.lat, lng: place.lng, placeName: place.name, placeCity: place.city })}
        onMusic={() => setMuted((value) => !value)}
      />

      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, paddingTop: insets.top }}>
        <View pointerEvents="box-none" style={{ padding: 12 }}>
          <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
            {stories.map((item, position) => (
              <View key={item.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,.28)", overflow: "hidden" }}>
                <View
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: "#fff",
                    width: position < index ? "100%" : position === index ? `${Math.min(100, progress * 100)}%` : "0%",
                  }}
                />
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Avatar name={story.author.name} size={34} mediaId={story.author.avatarMediaId} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "600" }}>
                {story.author.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 11 }}>
                  {relative(new Date(story.createdAt))}
                </Text>
                {story.private ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <LockIcon size={11} color="rgba(255,255,255,.85)" />
                    <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 11, fontWeight: "600" }}>خاصة</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* الإبلاغ على القصة نفسها لا على صاحبها وحده — شرط آبل. */}
            {mine ? null : <ReportButton target="STORY" targetId={story.id} tone="loud" />}

            <Pressable
              accessibilityLabel="إغلاق"
              onPress={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.16)" }}
            >
              <CloseIcon size={17} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      {mine ? (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            {/* العدّادُ بابُ القائمة: من نشر قصّةً يسأل «مَن» قبل «كم». */}
            <Pressable
              accessibilityLabel="من شاهدها"
              onPress={() => setWatching(true)}
              hitSlop={10}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.16)" }}
            >
              <EyeIcon size={15} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                {story._count.views > 0
                  ? `شاهدها ${ar(story._count.views)}${story.reactions ? `، تفاعل ${ar(story.reactions)}` : ""}`
                  : "لم يشاهدها أحد بعد"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => remove.mutate(story.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.16)" }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>احذف القصة</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 8 }}>
          <View style={{ flexDirection: "row", alignSelf: "center", gap: 6, padding: 6, borderRadius: 999, backgroundColor: "rgba(14,26,36,.55)" }}>
            {FACES.map((face) => {
              const on = story.myReaction === face;
              return (
                <Pressable
                  key={face}
                  accessibilityLabel={on ? "ارفع التفاعل" : "تفاعل"}
                  onPress={() => react(face)}
                  onPressIn={() => setHeld(true)}
                  onPressOut={() => setHeld(false)}
                  hitSlop={4}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? "rgba(246,185,59,.9)" : "transparent",
                    transform: [{ scale: on ? 1.08 : 1 }],
                  }}
                >
                  <ReactionGlyph kind={face} size={34} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {burst ? (
        <Animated.View
          key={burst.key}
          pointerEvents="none"
          style={{
            position: "absolute",
            alignSelf: "center",
            left: screen.width / 2 - 48,
            top: screen.height * 0.45,
            opacity: fly.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [80, -120] }) },
              { scale: fly.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.25, 1] }) },
            ],
          }}
        >
          <ReactionGlyph kind={burst.face} size={96} />
        </Animated.View>
      ) : null}
    </Animated.View>
    </Animated.View>
    </View>

      {watching && mine ? (
        <Sheet title="من شاهد قصّتك" onClose={() => setWatching(false)}>
          {viewers.isLoading ? (
            <ActivityIndicator color={colors.clay} style={{ marginVertical: 24 }} />
          ) : (viewers.data?.viewers.length ?? 0) === 0 ? (
            <Text style={{ textAlign: "center", color: colors.muted, fontSize: 13, marginVertical: 24 }}>
              لم يشاهدها أحدٌ من أصدقائك بعد.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.5 }}>
              {viewers.data!.viewers.map((person) => (
                <Pressable
                  key={person.id}
                  onPress={() => {
                    setWatching(false);
                    router.push(`/u/${person.id}`);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 }}
                >
                  {/*
                    الوجهُ فوق صورة من تفاعل — **بقرار المالك**: سؤالُ صاحب القصّة
                    «مَن؟ وبماذا؟». ومن شاهد ولم يتفاعل يُقال له ذلك نصّاً.
                  */}
                  {/* حشوةٌ للشارة: القائمةُ تقصّ ما خرج عن حدّها. */}
                  <View style={{ paddingTop: 7, paddingRight: 7 }}>
                    <Avatar name={person.name} size={44} mediaId={person.avatarMediaId} frame={person.frame} />
                    {person.reaction ? (
                      <View
                        style={{
                          position: "absolute",
                          top: -1,
                          right: -1,
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.line,
                        }}
                      >
                        <ReactionGlyph kind={person.reaction} size={20} />
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: person.reaction ? colors.clayInk : colors.faint }}>
                      {person.reaction ? "شاهدها وتفاعل" : "شاهدها وما تفاعل"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11.5, color: colors.faint }}>
                    {relative(new Date(person.seenAt))}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Sheet>
      ) : null}
    </View>
  );
}
