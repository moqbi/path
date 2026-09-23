import { useMemo, useRef, useState } from "react";
import { View, SectionList, ActivityIndicator, Pressable, Animated, Easing, PanResponder } from "react-native";
import { Text } from "../../components/type";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MomentCard, SPINE_W } from "../../components/moment-card";
import { SPINE_X } from "../../components/spine";
import { CoverLayer } from "../../components/cover";
import { Avatar } from "../../components/avatar";
import { AthrMark } from "../../components/brand";
import { MessageIcon, RefreshIcon, SparkIcon, StarIcon } from "../../components/icons";
import { ComposerFan } from "../../components/composer-fan";
import { Tour } from "../../components/tour";
import { useCircle, useFeed, useTogether, type Moment } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { ar, dayLabel, membership, MONTHS } from "../../lib/format";
import { playRefresh } from "../../lib/sound";
import { NameTag } from "../../components/name-tag";
import { colors } from "../../theme/tokens";

const COVER = 176;

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

  const lensMoments = useMemo(
    () =>
      view === "together"
        ? (together.data?.moments ?? [])
        : (feed.data?.pages.flatMap((page) => page.moments) ?? []),
    [view, together.data, feed.data],
  );
  const moments = lensMoments;

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
  const [pulling, setPulling] = useState(false);

  const reload = () => (view === "together" ? together.refetch() : feed.refetch());

  /*
    `PanResponder` يُبنى مرّةً واحدة، فما يُغلق عليه يبقى من أوّل رسم.
    و`reload` يتبدّل بتبدّل العدسة — فلو أُخذ كما هو لأعاد جلب الخطّ
    العام ونحن في «آثارنا». ومرآةٌ تُحدَّث كل رسمةٍ تحلّ ذلك.
  */
  const latest = useRef(reload);
  latest.current = reload;

  const settle = () =>
    Animated.spring(pull, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 14 }).start();

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
            useNativeDriver: true,
          }),
        );
        turn.start();
        Animated.timing(pull, {
          toValue: PULL_TRIP,
          duration: 140,
          useNativeDriver: true,
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

          <Pressable
            onPress={() => router.push("/messages" as never)}
            accessibilityLabel="المحادثات"
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            <MessageIcon size={21} color={colors.chromeInk} />
          </Pressable>
        </View>
      </View>

      {/*
        الغلافُ واللحظات في طبقةٍ واحدة تنزل بالسحب: هما ما يتحرّك،
        والرأس والشريط السفلي ثابتان.
      */}
      <Animated.View
        style={{ flex: 1, transform: [{ translateY: pull }] }}
        {...grip.panHandlers}
      >

        {/* الغلاف: صورتك على محور الخيط، والمدّة تحت الاسم، والتحديث مقابله. */}
        <View style={{ height: COVER, overflow: "hidden" }}>
          <CoverLayer mediaId={me.coverMediaId} spec={me.background?.spec} height={COVER} />

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
            <View style={{ width: SPINE_W, alignItems: "center" }}>
              <Avatar
                name={me.name}
                size={68}
                mediaId={me.avatarMediaId}
                frame={me.frame}
                charm={me.charm}
              />
            </View>

            <View style={{ flex: 1, paddingBottom: 6 }}>
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
                  useNativeDriver: true,
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
          </View>

          {/* الخيط يبدأ من أسفل الصورة داخل الغلاف نفسه. */}
          <View
            style={{
              position: "absolute",
              insetInlineStart: SPINE_X,
              bottom: 0,
              width: 1,
              height: 10,
              backgroundColor: "rgba(255,255,255,.75)",
            }}
          />
        </View>

        <SectionList
          sections={days}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
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

      </Animated.View>

      <ComposerFan />
      <Tour />
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
