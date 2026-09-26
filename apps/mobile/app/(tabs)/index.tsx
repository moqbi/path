import { useCallback, useMemo, useRef, useState } from "react";
import { View, SectionList, ActivityIndicator, Pressable, Animated, Easing, PanResponder } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { MomentCard, SPINE_W } from "../../components/moment-card";
import { COVER_HEIGHT, CoverLayer } from "../../components/cover";
import { Avatar } from "../../components/avatar";
import { AthrMark } from "../../components/brand";
import { ClockIcon, MessageIcon, RefreshIcon, SparkIcon, StarIcon } from "../../components/icons";
import { ComposerFan } from "../../components/composer-fan";
import { Tour } from "../../components/tour";
import { Spot } from "../../components/spot";
import { PlusEnded } from "../../components/plus-ended";
import { useCircle, useFeed, useTogether, useUnreadDm, type Moment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar, dayLabel, membership, MONTHS, timeOfDay } from "../../lib/format";
import { useTabTop } from "../../lib/tab-top";
import { playRefresh } from "../../lib/sound";
import { NameTag } from "../../components/name-tag";
import { colors } from "../../theme/tokens";

const COVER = COVER_HEIGHT;

/** أقصى ما ينزل به الغلاف، والمسافة التي يُحسب بعدها التحديث. */
const PULL_MAX = 96;
const PULL_TRIP = 62;

/**
 * الخط الزمني.
 *
 * الرأس ثابت — العلامة و«آثار+» والرسائل — ثم الغلاف وفيه صورتك جالسةٌ
 * على محور الخيط، ومن أسفلها ينزل الخيط إلى لحظات اليوم. واللحظات
 * وحدها تمرّ تحته.
 */
export default function Timeline() {
  const me = useSession((s) => s.me);
  const router = useRouter();
  // حشوةُ الحافّة العليا في الرأس الداكن نفسه — انظر `components/screen-header.tsx`.
  const insets = useSafeAreaInsets();

  /*
    العدسات ثلاثٌ في الخط الزمني نفسه لا ثلاثُ صفحات: الرأس والغلاف
    والصورة تبقى، ويتبدّل ما تحتها وحده.
  */
  const params = useLocalSearchParams<{ view?: string; with?: string }>();
  const view = params.view === "private" || params.view === "together" ? params.view : "";
  const withId = view === "together" ? (params.with ?? "") : "";

  const feed = useFeed(view === "private" ? "private" : "");
  const together = useTogether(withId);
  const circle = useCircle();
  const unread = useUnreadDm();
  const unreadCount = unread.data?.unread ?? 0;
  // العودةُ من محادثةٍ قُرئت تُعيد العدّ: الخطّ الزمنيّ لا يُفكّ من الشجرة.
  const recount = unread.refetch;
  useFocusEffect(
    useCallback(() => {
      void recount();
    }, [recount]),
  );

  const lensMoments = useMemo(
    () =>
      view === "together"
        ? (together.data?.moments ?? [])
        : (feed.data?.pages.flatMap((page) => page.moments) ?? []),
    [view, together.data, feed.data],
  );
  /*
    لحظةٌ واحدة مرّةً واحدة، والأحدثُ أوّلاً — مهما جاءت الصفحات.
    صفحتان تتداخلان بعد تحديثٍ (لحظةٌ نُشرت بين الجلبين) كانتا تُكرّران
    لحظةً بمفتاحها نفسه، ومفتاحٌ مكرّر في القائمة يُربك رسمها فتتداخل
    البطاقات ويخرج بعضها عن ترتيبه.
  */
  const moments = useMemo(() => {
    const seen = new Set<string>();
    return lensMoments
      .filter((moment) => (seen.has(moment.id) ? false : (seen.add(moment.id), true)))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [lensMoments]);

  const friend = circle.data?.members.find((person) => person.id === withId) ?? null;
  const since = together.data?.since ? new Date(together.data.since) : null;

  // اللحظات تُجمَّع تحت فواصل الأيام، فالخط يُقرأ يوميات لا تدفّقاً.
  const days = useMemo(() => {
    const out: { title: string; data: Moment[] }[] = [];
    for (const moment of moments) {
      const label = dayLabel(new Date(moment.createdAt));
      const last = out.at(-1);
      if (last && last.title === label) last.data.push(moment);
      else out.push({ title: label, data: [moment] });
    }
    return out;
  }, [moments]);

  /*
    السحب للتحديث: الغلاف واللحظات ينزلان معاً.

    `RefreshControl` يمدّ القائمة وحدها ويرسم دوّارة النظام فوقها، فيبقى
    الغلاف ساكناً وينفصل عمّا تحته. وهنا طبقةٌ واحدة تحمل الاثنين وتنزل
    بإصبعٍ واحد، وبالإفلات تعود إلى مكانها ويدور سهمُ التحديث في الغلاف —
    وهو نفسه زرّ التحديث، فالحركة تقول أين يجلس الفعل.

    والمقاومة نصف المسافة: سحبٌ يتبع الإصبع بتمامه يُحسّ منفلتاً.
  */
  const pull = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const atTop = useRef(true);

  /*
    ساعةُ التمرير — **بقرار المالك**: قرصٌ صغير يسار القائمة فيه ساعةٌ
    ووقتُ أعلى لحظةٍ ظاهرة، يظهر ما دام الإصبعُ يمرّر ويبهت بعده. من
    نزل في يومٍ طويل يعرف أين هو منه بلا أن يقرأ بطاقةً بطاقة.
  */
  const list = useRef<SectionList<Moment>>(null);
  const [clock, setClock] = useState<string | null>(null);
  const clockFade = useRef(new Animated.Value(0)).current;
  const clockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showClock = () => {
    if (clockTimer.current) clearTimeout(clockTimer.current);
    Animated.timing(clockFade, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };
  const hideClock = () => {
    if (clockTimer.current) clearTimeout(clockTimer.current);
    clockTimer.current = setTimeout(() => {
      Animated.timing(clockFade, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    }, 700);
  };
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Moment | undefined }[] }) => {
    const first = viewableItems.find((row) => row.item && "createdAt" in row.item)?.item;
    if (first) setClock(timeOfDay(new Date(first.createdAt)));
  }).current;

  // الضغطةُ على «اللحظات» وهو ظاهرٌ ترجع إلى أعلاه.
  useTabTop(() => list.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true }));
  const [pulling, setPulling] = useState(false);

  const refreshMe = useSession((s) => s.refresh);
  // والتحديث يسأل عن صاحب الشاشة أيضاً: غلافُه وإطارُه وتميمتُه منه.
  const reload = () =>
    Promise.all([
      view === "together" ? together.refetch() : feed.refetch(),
      refreshMe(),
      unread.refetch(),
    ]);

  /*
    `PanResponder` يُبنى مرّةً واحدة، فما يُغلق عليه يبقى من أوّل رسم.
    و`reload` يتبدّل بتبدّل العدسة — فلو أُخذ كما هو لأعاد جلب الخطّ
    العام ونحن في «آثارنا». ومرآةٌ تُحدَّث كل رسمةٍ تحلّ ذلك.
  */
  const latest = useRef(reload);
  latest.current = reload;

  const settle = () =>
    Animated.spring(pull, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();

  const grip = useRef(
    PanResponder.create({
      /*
        الالتقاط في طور **الهبوط** لا الصعود.

        `onMoveShouldSetPanResponder` يُسأل بعد أن تُسأل القائمة تحتنا،
        والقائمة تأخذ الإيماءة لنفسها فلا يصلنا شيء — فكان السحب لا
        يحرّك الغلاف على الجهاز وإن عمل باللمس المُصطنع في المتصفّح.
        و`…Capture` يُسأل قبلها، فنأخذها نحن.

        والشرط يبقى ضيّقاً: القائمة في أعلاها، والإصبع نازلٌ رأسياً —
        وما عدا ذلك يمرّ إلى القائمة كما كان.
      */
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_event, gesture) =>
        atTop.current && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.6,
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dy <= 0) return pull.setValue(0);
        pull.setValue(Math.min(gesture.dy * 0.5, PULL_MAX));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy * 0.5 < PULL_TRIP) return settle();

        setPulling(true);
        playRefresh();
        // دورةٌ كاملة تدور ما دام الجلب جارياً، ثم يعود كلُّ شيء مكانه.
        spin.setValue(0);
        const turn = Animated.loop(
          Animated.timing(spin, {
            toValue: 1,
            duration: 750,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        );
        turn.start();
        Animated.timing(pull, {
          toValue: PULL_TRIP,
          duration: 140,
          useNativeDriver: false,
        }).start();

        void Promise.resolve(latest.current()).finally(() => {
          turn.stop();
          spin.setValue(0);
          setPulling(false);
          settle();
        });
      },
      onPanResponderTerminate: settle,
    }),
  ).current;

  if (!me) return null;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.paper }}>
      {/*
        الرأس: العلامة ثم ATHAR، و«آثار+» قبل الرسائل.

        ومقاسه مقاس `ScreenHeader` بعينه — ٥٦ ارتفاعاً، وحشوةٌ ١٦، وعلامةٌ
        ٣٢: رأسٌ أكبر في شاشةٍ واحدة يُقرأ «تطبيقاً آخر» حين ينتقل إليها.
      */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 56,
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          backgroundColor: colors.chrome,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <AthrMark size={32} />
          <Text face="latin" style={{ color: colors.chromeInk, fontSize: 16, fontWeight: "700", letterSpacing: 2 }}>
            ATHAR
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Spot id="header.plus">
          <Pressable
            onPress={() => router.push("/subscribe" as never)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: colors.goldSoft,
              borderWidth: 1,
              borderColor: colors.goldLine,
            }}
          >
            <SparkIcon size={13} color={colors.goldInk} />
            <Text style={{ color: colors.goldInk, fontSize: 12, fontWeight: "700" }}>آثار+</Text>
          </Pressable>
          </Spot>

          <Spot id="header.chats">
          <Pressable
            onPress={() => router.push("/messages" as never)}
            accessibilityLabel="المحادثات"
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            <MessageIcon size={21} color={colors.chromeInk} />
            {/* عددُ الرسائل التي لم تُقرأ — لا نقطةٌ صمّاء: الرقم يقول كم ينتظر. */}
            {unreadCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 2,
                  right: 0,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.live,
                  borderWidth: 1.5,
                  borderColor: colors.chrome,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700", lineHeight: 13 }}>
                  {unreadCount > 99 ? "+٩٩" : ar(unreadCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
          </Spot>
        </View>
      </View>

      {/*
        الغلافُ واللحظات في طبقةٍ واحدة تنزل بالسحب: هما ما يتحرّك،
        والرأس والشريط السفلي ثابتان.
      */}
      <Animated.View style={{ flex: 1 }} {...grip.panHandlers}>

        {/* الغلاف: صورتك على محور الخيط، والمدّة تحت الاسم، والتحديث مقابله. */}
        <Animated.View style={{ height: Animated.add(COVER, pull), overflow: "hidden" }}>
          {/*
            السحبُ يمدّ الغلاف ولا يُنزله: كان الغلافُ واللحظات ينزلان معاً
            فيبقى فوقهما فراغٌ بلون الورق. الآن يطول الإطارُ بمقدار السحب
            وتكبر الصورةُ فيه من أعلاها — فلا يظهر شيءٌ ليس غلافاً.
          */}
          <Animated.View
            style={{
              height: COVER,
              transform: [
                {
                  translateY: pull.interpolate({
                    inputRange: [0, PULL_MAX],
                    outputRange: [0, PULL_MAX / 2],
                    extrapolate: "clamp",
                  }),
                },
                {
                  scale: pull.interpolate({
                    inputRange: [0, PULL_MAX],
                    outputRange: [1, (COVER + PULL_MAX) / COVER],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          >
            <CoverLayer mediaId={me.coverMediaId} spec={me.background?.spec} height={COVER} x={me.coverX} y={me.coverY} zoom={me.coverZoom} />
          </Animated.View>

          <View
            style={{
              position: "absolute",
              insetInline: 0,
              bottom: 0,
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 12,
              paddingHorizontal: 20,
              paddingBottom: 16,
            }}
          >
            {/*
              زرُّ التحديث في الطرف الأيمن قبل الصورة — **بقرار المالك** —
              والصورةُ والاسم يتقدّمان يساراً بعده. فلم تعد الصورة على محور
              الخيط، فذهب وصلُ الخيط تحتها: خيطٌ ينزل من تحت زرٍّ لا يعني شيئاً.
            */}
            <Pressable
              onPress={() => {
              /*
                الضغطة كانت تجلب بلا أثرٍ يُرى: الجلب أسرع من العين، فبدا
                الزرّ معطّلاً. الآن يدور السهم ما دام الجلب جارياً — ولو
                لمحةً — وتُسمع النغمة، فيُعرف أنّه عمل.
              */
              if (pulling) return;
              playRefresh();
              setPulling(true);
              spin.setValue(0);
              const turn = Animated.loop(
                Animated.timing(spin, {
                  toValue: 1,
                  duration: 750,
                  easing: Easing.linear,
                  useNativeDriver: false,
                }),
              );
              turn.start();
              void Promise.resolve(latest.current()).finally(() => {
                turn.stop();
                spin.setValue(0);
                setPulling(false);
              });
            }}
              accessibilityLabel="تحديث الخط الزمني"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                // قرصٌ داكن لا شفّاف: بلا درعٍ كان الأبيضُ يذوب في غلافٍ فاتح.
                backgroundColor: "rgba(14,26,36,.38)",
                marginBottom: 4,
              }}
            >
              {/*
                السهم يتبع الإصبع وهو ينزل، ثم يدور دورةً بعد دورة ما دام
                الجلب جارياً — فالحركة في مكان الفعل لا دوّارةٌ غريبة فوق
                القائمة.
              */}
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: pulling
                        ? spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] })
                        : pull.interpolate({
                            inputRange: [0, PULL_MAX],
                            outputRange: ["0deg", "270deg"],
                            extrapolate: "clamp",
                          }),
                    },
                  ],
                }}
              >
                <RefreshIcon size={17} color="#fff" />
              </Animated.View>
            </Pressable>
            <View style={{ width: SPINE_W, alignItems: "center" }}>
              <Avatar
                name={me.name}
                size={68}
                mediaId={me.avatarMediaId}
                frame={me.frame}
                charm={me.charm}
              />
            </View>

            {/*
              الاسم أبعدُ عن الصورة (`marginRight`): التميمةُ تجلس يسارها
              وأغلبُها خارجها (القاعدة ٥٩)، فكانت تلامس الاسم.
            */}
            <View style={{ flex: 1, paddingBottom: 6, marginRight: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: "600",
                    writingDirection: "auto",
                    // ظلُّ الحرف بدل إعتام الغلاف كلّه.
                    textShadowColor: "rgba(14,26,36,.62)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
                  }}
                >
                  {me.name}
                </Text>
                <NameTag isPlus={me.isPlus} tag={me.tag} size={10} />
              </View>
              <Text style={{ color: "rgba(255,255,255,.92)", fontSize: 11.5, textShadowColor: "rgba(14,26,36,.62)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}>
                لك معانا {membership(me.createdAt)}
              </Text>
            </View>

          </View>

        </Animated.View>

        <View style={{ flex: 1 }}>
        <SectionList
          ref={list}
          sections={days}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 30 }}
          onScrollBeginDrag={showClock}
          onScrollEndDrag={hideClock}
          onMomentumScrollBegin={showClock}
          onMomentumScrollEnd={hideClock}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 90, flexGrow: 1 }}
          style={{ backgroundColor: colors.paper }}
          // موضعُ رأس القائمة وحده هو ما يأذن للسحب أن يلتقط الإيماءة.
          scrollEventThrottle={16}
          onScroll={(event) => {
            atTop.current = event.nativeEvent.contentOffset.y <= 1;
          }}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (view === "together") return;
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}>
              <View style={{ width: SPINE_W, alignItems: "center" }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line }} />
              </View>
              <Text style={{ color: colors.ink2, fontSize: 15, fontWeight: "700" }}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <MomentCard moment={item} viewerId={me.id} isPlus={me.isPlus} moderate={me.canModerate} />
          )}
          ListHeaderComponent={
            <LensHead
              view={view}
              friend={friend}
              me={me}
              count={moments.length}
              since={since}
              people={circle.data?.members ?? []}
              onPick={(id) => router.setParams({ view: "together", with: id })}
              onClear={() => router.setParams({ view: "together", with: "" })}
            />
          }
          ListEmptyComponent={
            (view === "together" ? together.isLoading : feed.isLoading) ? (
              <ActivityIndicator style={{ marginTop: 50 }} color={colors.clay} />
            ) : view === "together" && !friend ? null : (
              <View style={{ marginTop: 40, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 24 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
                  {view === "private"
                    ? "ما فيه لحظات خاصة"
                    : view === "together"
                      ? "ما فيه آثار بعد"
                      : "خطك الزمني فارغ"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 22 }}>
                  {view === "private"
                    ? "عند النشر اختر «من يراها» — تصنيفاً من أصدقائك أو أشخاصاً بأعيانهم."
                    : view === "together"
                      ? "أشِر إليه في لحظة، أو تفاعل مع لحظاته — وسيبدأ الخطّ المشترك."
                      : "اضغط الزائد وانشر لحظتك الأولى، أو انتظر أحداً من أصدقائك ينشر."}
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator style={{ paddingVertical: 18 }} color={colors.clay} />
            ) : null
          }
        />

        {clock ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 10,
              left: 12,
              opacity: clockFade,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 10,
              height: 28,
              borderRadius: 14,
              backgroundColor: colors.chrome,
            }}
          >
            <ClockIcon size={14} color={colors.chromeInk} />
            <Text style={{ color: colors.chromeInk, fontSize: 11.5, fontWeight: "700" }}>{clock}</Text>
          </Animated.View>
        ) : null}
        </View>

      </Animated.View>

      <ComposerFan />
      <Tour />
      <PlusEnded />
    </SafeAreaView>
  );
}


/**
 * ما فوق اللحظات في كل عدسة.
 *
 * «الخاصة» سطرٌ يشرح ما تراه، و«آثارنا» بطاقةُ العدد بينكما — أو قائمةُ
 * الأصدقاء إن لم يُختر صاحبها بعد. ولا شرائح تحت الغلاف ولا زرّ رجوع:
 * اسم التبويب يقول أيّ عدسةٍ مفتوحة.
 */
function LensHead({
  view,
  friend,
  me,
  count,
  since,
  people,
  onPick,
  onClear,
}: {
  view: string;
  friend: { id: string; name: string; avatarMediaId: string | null; frame: { spec: string; mediaId: string | null; frameHole?: number | null } | null; charm: { spec: string; mediaId: string | null } | null } | null;
  me: { name: string; avatarMediaId: string | null };
  count: number;
  since: Date | null;
  people: { id: string; name: string; avatarMediaId: string | null; frame: { spec: string; mediaId: string | null; frameHole?: number | null } | null; charm: { spec: string; mediaId: string | null } | null }[];
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  if (view === "private") {
    return (
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, paddingTop: 14, textAlign: "right" }}>
        ما نُشر لتصنيفٍ من أصدقائك أو لأشخاص بأعيانهم — غيرهم لا يراها أصلاً.
      </Text>
    );
  }

  if (view !== "together") return null;

  if (friend) {
    return (
      <View style={{ marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 16, alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Avatar name={me.name} size={44} mediaId={me.avatarMediaId} />
          <View style={{ marginRight: -12 }}>
            <Avatar
              name={friend.name}
              size={44}
              frame={friend.frame}
              charm={friend.charm}
              mediaId={friend.avatarMediaId}
            />
          </View>
        </View>

        <Text style={{ color: colors.clayInk, fontSize: 12.5, fontWeight: "600" }}>
          آثاركما المشتركة
        </Text>
        <Text style={{ color: colors.ink, fontSize: 28, marginVertical: 2 }}>{ar(count)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
          لحظة تجمعك بـ{friend.name}
          {since ? ` منذ ${MONTHS[since.getMonth()]} ${ar(since.getFullYear())}` : ""}
        </Text>

        <Pressable onPress={onClear} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "600" }}>غيّر الصديق</Text>
        </Pressable>
      </View>
    );
  }

  if (people.length === 0) {
    return (
      <View style={{ marginTop: 40, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, padding: 24 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 }}>
          ما عندك أصدقاء بعد
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 22 }}>
          أضف صديقاً أولاً من تبويب الأصدقاء.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 11.5, lineHeight: 19, marginBottom: 8, textAlign: "right" }}>
        اختر صاحبك لترى ما جمعكما: إشارةٌ منه أو تفاعلٌ أو تعليق.
      </Text>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: "hidden" }}>
        {people.map((person, index) => (
          <Pressable
            key={person.id}
            onPress={() => onPick(person.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.line,
            }}
          >
            <Avatar
              name={person.name}
              size={42}
              frame={person.frame}
              charm={person.charm}
              mediaId={person.avatarMediaId}
            />
            <Text numberOfLines={1} style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: "600", textAlign: "right" }}>
              {person.name}
            </Text>
            <Text style={{ color: colors.clayInk, fontSize: 12, fontWeight: "600" }}>آثارنا</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
