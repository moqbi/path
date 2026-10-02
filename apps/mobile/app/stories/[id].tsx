import { useEffect, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator, Dimensions, ScrollView, Animated, PanResponder } from "react-native";
import type { StoryText } from "@athar/shared";
import { StoryTexts } from "../../components/story-texts";
import { Text } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../../components/avatar";
import { ReportButton } from "../../components/report-sheet";
import { Sheet } from "../../components/sheet";
import { Filtered } from "../../components/filtered";
import { StoryVideo } from "../../components/story-video";
import { CloseIcon, EyeIcon } from "../../components/icons";
import { api } from "../../lib/api";
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
};

type Viewer = {
  id: string;
  name: string;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  seenAt: string;
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

  const feed = useQuery({
    queryKey: ["stories", id],
    queryFn: () => api<{ stories: Story[] }>(`/v1/stories/user/${id}`),
  });

  const stories = feed.data?.stories ?? [];
  const story = stories[index];
  const mine = id === me?.id;
  const video = story?.media.mime.startsWith("video/") ?? false;
  const span = video && story?.seconds ? story.seconds * 1000 : SLIDE_MS;

  const viewers = useQuery({
    queryKey: ["story-viewers", story?.id],
    queryFn: () => api<{ viewers: Viewer[] }>(`/v1/stories/${story!.id}/viewers`),
    enabled: watching && mine && Boolean(story),
  });

  const remove = useMutation({
    mutationFn: (storyId: string) => api(`/v1/stories/${storyId}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["stories"] });
      router.back();
    },
  });

  // إيصال المشاهدة يُرسل مرّةً لكل شريحة تُفتح.
  useEffect(() => {
    if (!story) return;
    void api(`/v1/stories/${story.id}/seen`, { method: "POST" }).catch(() => {});
  }, [story]);

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
          Animated.timing(drop, { toValue: screen.height, duration: 200, useNativeDriver: true }).start(() =>
            live.current.close(),
          );
          return;
        }
        Animated.spring(drop, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        setDragging(false);
        if ((g.dy < -70 || g.vy < -0.9) && live.current.mine) live.current.open();
      },
      onPanResponderTerminate: () => {
        Animated.spring(drop, { toValue: 0, useNativeDriver: true }).start();
        setDragging(false);
      },
    }),
  ).current;

  const sink = {
    transform: [
      { translateY: drop.interpolate({ inputRange: [-200, 0, screen.height], outputRange: [-50, 0, screen.height * 0.6] }) },
      { scale: drop.interpolate({ inputRange: [0, screen.height], outputRange: [1, 0.72], extrapolate: "clamp" }) },
    ],
    borderRadius: drop.interpolate({ inputRange: [0, 80], outputRange: [0, 24], extrapolate: "clamp" }),
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
    <Animated.View {...pan.panHandlers} style={[{ flex: 1, backgroundColor: "#0b1219", overflow: "hidden" }, sink]}>
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
              <Text style={{ color: "rgba(255,255,255,.75)", fontSize: 11 }}>
                {relative(new Date(story.createdAt))}
              </Text>
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
                {story._count.views > 0 ? `شاهدها ${ar(story._count.views)}` : "لم يشاهدها أحد بعد"}
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
      ) : null}
    </Animated.View>

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
                  <Avatar
                    name={person.name}
                    size={40}
                    mediaId={person.avatarMediaId}
                    frame={person.frame}
                    charm={person.charm}
                  />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink }} numberOfLines={1}>
                    {person.name}
                  </Text>
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
