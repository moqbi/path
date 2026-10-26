import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated, { cancelAnimation, Extrapolation, interpolate, runOnJS, runOnUI, useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing as REasing, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";
import { Spinner } from "../../../components/spinner";
import { Text } from "../../../components/type";
import { AthrMark } from "../../../components/brand";
import { MediaImage } from "../../../components/media-image";
import { BackIcon, BookIcon, CalendarIcon, ClockIcon, CloseIcon, LockIcon, MessageIcon as CommentIcon, MoonIcon, PinIcon, PlaneIcon, QuoteIcon, SparkIcon, SunIcon } from "../../../components/icons";
import { api } from "../../../lib/api";
import { useMoment } from "../../../lib/queries";
import { ar, MONTHS, relative, timeOfDay } from "../../../lib/format";
import { FREE_DAYS, momentLine, type ArchiveMoment, type ArchivePage, type HallEcho, type HallImages } from "../../../lib/archive";
import { HALL_SKIN, hallSkinOf, type HallSkin } from "../../../lib/gallery-skin";
import { ReactionGlyph } from "../../../components/reactions";
import { Avatar } from "../../../components/avatar";

type Hall = { moments: ArchiveMoment[]; limited: boolean; hidden: number; skin: string | null; images: HallImages | null };
type Slot = { type: "rope"; key: string } | { type: "piece"; key: string; moment: ArchiveMoment };

/** اليومُ والشهرُ والسنةُ بتوقيت الرياض (+٣) — كالكتاب (القاعدة ٢٣٥). */
const riyadh = (iso: string) => {
  const date = new Date(new Date(iso).getTime() + 3 * 3_600_000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
};

/**
 * لحظاتُ السنة من الأرشيف نفسه (`/v1/archive`، الأحدثُ أوّلاً) — صفحةً صفحةً حتى
 * تعبر السنة. فالحدُّ حدُّه (القاعدة ٢٤٤) بلا بابٍ جديدٍ في الخادم.
 */
async function loadHall(year: number): Promise<Hall> {
  const moments: ArchiveMoment[] = [];
  let cursor: string | undefined;
  let limited = false;
  let hidden = 0;
  let skin: string | null = null;
  let images: HallImages | null = null;
  for (let round = 0; round < 40; round++) {
    const page = await api<ArchivePage>(`/v1/archive?limit=90${cursor ? `&cursor=${cursor}` : ""}`);
    if (round === 0) {
      limited = page.limited;
      hidden = page.hidden;
      skin = page.hallSkin ?? null;
      images = page.hallImages ?? null;
    }
    let older = false;
    for (const moment of page.moments) {
      const at = riyadh(moment.createdAt).year;
      if (at === year) moments.push(moment);
      else if (at < year) older = true;
    }
    cursor = page.nextCursor;
    if (!cursor || older) break;
  }
  return { moments: moments.reverse(), limited, hidden, skin, images };
}

/** كم تُقلَّب بسحبةٍ واحدة، وكم لوحةً تُرسم حول الحاليّة. */
const FLING_MAX = 3;
const WINDOW = 4;
/**
 * ما يُركَّب من اللوحات حول الحاليّة وحول المستقرّ معاً (القاعدة ٣٥٧): الموضعُ في Reanimated فتركيبُ
 * لوحةٍ والحركةُ جارية لا يُرمش شيئاً، وكان المركزُ المستقرَّ وحده — وسحبةٌ تقطع الحركةَ لا تُبدّله —
 * فيُرى الجدارُ فارغاً حتى تقف. ويتّسع لأبعد سحبةٍ وأربعٍ بعدها فتُحمَّل صورُها قبل أن تصلها العين.
 */
const MOUNTED = FLING_MAX + WINDOW;
/** نابضُ الانتقال: يصل ويستقرّ بلا ارتدادٍ يُرى — كـ`speed 14، bounciness 2` في `Animated`. */
const SPRING = { damping: 24, stiffness: 190, mass: 1 };
/** دورةُ نقش الجدار والأرضيّة المرسومَين — وبصورةٍ مرفوعة مقاسُ البلاطة. */
const WALL_TILE = 220;
const FLOOR_TILE = 160;
/** ارتفاعُ الإفريز تحت السقف بعد حافّة الشاشة، ومنه تتدلّى المصابيح. */
const CROWN = 16;

const SHADOW = { shadowColor: "#3A2A14", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 12 }, elevation: 10 } as const;

/**
 * قاعةُ السنة (القاعدتان ٣٤٦ و٣٥٢): الشاشةُ كلُّها جدار — يصعد تحت شريط الحالة إلى إفريزه
 * — وفي أعلاه العلامةُ و«آثار» يساراً، والرجوعُ و«عرض اللحظات» يميناً. ثمّ لافتةُ الشهر،
 * ثمّ اللوحاتُ وفوق كلّ واحدةٍ مصباحٌ في السقف يسكب ضوءَه عليها، ثمّ بطاقتُها، ثمّ لوحٌ خشبيّ
 * بحاجزه، ثمّ أرضٌ من ألواح خشب وعليها الشهور. والجدارُ يمرّ مع اللوحات بسرعتها (هي عليه)،
 * والأرضيّةُ ثابتة تحت القدم (القاعدة ٣٥٣).
 * والتاليةُ في اليسار كقراءة العربية — بالإصبع: سحبةٌ أفقيّة تمشي بك، وعموديّةٌ تنقل شهراً،
 * والضغطُ على الحاليّة يفتح نافذتَها، وعلى جارتها يأتي بها.
 */
export default function HallScreen() {
  const { year: raw } = useLocalSearchParams<{ year: string }>();
  const year = Number(raw);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const floorH = 104 + Math.max(insets.bottom, 12);
  const headTop = insets.top + 64;
  const frameTop = headTop + 96;
  // اللوحةُ بما يتّسع له الجدار: شاشةٌ قصيرة تصغّرها ولا تدفع البطاقةَ تحت الأرض.
  const room = height - frameTop - floorH - 124;
  const W = Math.round(Math.max(150, Math.min(250, width * 0.62, room / 1.25)));
  const H = Math.round(W * 1.25);
  // الجارتان تُطلّان من الحافّتين: يُرى أنّ الجدارَ يمتدّ.
  const STEP = W + 44;

  const hall = useQuery({ queryKey: ["hall", year], queryFn: () => loadHall(year), enabled: Number.isInteger(year) });
  // ثوبُ القاعة الملبوس من المتجر (القاعدة ٣٤٨)، وبلاه الكلاسيكيّة.
  const skin = useMemo(() => (hall.data?.skin ? hallSkinOf(hall.data.skin) : HALL_SKIN), [hall.data?.skin]);
  const images = hall.data?.images ?? null;

  const slots = useMemo<Slot[]>(() => {
    const data = hall.data;
    if (!data) return [];
    const out: Slot[] = data.moments.map((moment) => ({ type: "piece", key: moment.id, moment }));
    // الحبلُ في أوّل القاعة التي يقع فيها الحدّ: ما خلفه أقدمُ من ستّة أشهر.
    const edge = riyadh(new Date(Date.now() - FREE_DAYS * 86_400_000).toISOString()).year;
    if (data.limited && data.hidden > 0 && edge === year) out.unshift({ type: "rope", key: "rope" });
    return out;
  }, [hall.data, year]);

  /*
    الموضعُ قيمةٌ مشتركة من Reanimated لا `Animated.Value` (القاعدة ٣٥٦): القيمةُ التي يحرّكها
    `Animated` على الخيط الأصليّ لا تُكتب في شجرة التخطيط، فكلُّ رسمةٍ من React والنابضُ يجري —
    تركيبُ لوحةٍ أو تبدّلُ الحاليّة — تُعيد كلَّ لوحةٍ إلى آخر موضعٍ عرفته الشجرة فتقفز وتتراكب.
  */
  const pos = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [settled, setSettled] = useState(0);
  const [detail, setDetail] = useState<{ moment: ArchiveMoment; tab: Tab } | null>(null);
  const [grid, setGrid] = useState(false);
  const nav = useRef({ index: 0, count: 0, step: STEP, base: 0, vertical: false, months: [] as { first: number }[] }).current;
  nav.index = index;
  nav.count = slots.length;
  nav.step = STEP;

  // أوّلُ ما يُرى: أوّلُ لوحةٍ في آخر شهر — من دخل قاعةَ سنته يبدأ بما قرُب.
  useLayoutEffect(() => {
    if (!slots.length) return;
    const last = slots.at(-1)!;
    const month = last.type === "piece" ? riyadh(last.moment.createdAt).month : -1;
    const start = Math.max(0, slots.findIndex((slot) => slot.type === "piece" && riyadh(slot.moment.createdAt).month === month));
    setIndex(start);
    setSettled(start);
    pos.value = start * STEP;
  }, [slots.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    (to: number) => {
      const target = Math.max(0, Math.min(nav.count - 1, to));
      // قفزةٌ بعيدة من شريط الشهور لا تمرّ بجدارٍ فارغ: اللوحاتُ تُرسم حول الحاليّة وحدها.
      if (Math.abs(target - nav.index) > FLING_MAX) {
        cancelAnimation(pos);
        pos.value = target * nav.step;
        setSettled(target);
      } else {
        pos.value = withSpring(target * nav.step, SPRING, (finished) => {
          if (finished) runOnJS(setSettled)(target);
        });
      }
      setIndex(target);
    },
    [pos, nav],
  );

  const months = useMemo(() => {
    const out: { month: number; first: number; count: number }[] = [];
    slots.forEach((slot, at) => {
      if (slot.type !== "piece") return;
      const month = riyadh(slot.moment.createdAt).month;
      const row = out.at(-1);
      if (row && row.month === month) row.count += 1;
      else out.push({ month, first: at, count: 1 });
    });
    return out;
  }, [slots]);
  nav.months = months;

  /** شهرٌ قبل أو بعد: إلى أوّل لوحةٍ فيه. */
  const shiftMonth = useCallback(
    (by: number) => {
      const list = nav.months;
      if (!list.length) return;
      let now = 0;
      list.forEach((row, at) => {
        if (row.first <= nav.index) now = at;
      });
      const next = list[Math.max(0, Math.min(list.length - 1, now + by))];
      if (next) go(next.first);
    },
    [go, nav],
  );

  /*
    الضغطُ على لوحةٍ بدالّةٍ ثابتة تقرأ آخرَ حال: لوحاتٌ لا تتبدّل خصائصُها مع كلّ انتقال
    لا يُعاد رسمُها، فلا ترمش صورُها والجدارُ يمرّ (القاعدة ٣٥٣).
  */
  const tap = useRef<(at: number) => void>(() => {});
  tap.current = (at: number) => {
    const slot = slots[at];
    if (!slot) return;
    if (at !== index) return go(at);
    if (slot.type === "rope") router.push("/subscribe" as never);
    else setDetail({ moment: slot.moment, tab: "art" });
  };
  const onTap = useCallback((at: number) => tap.current(at), []);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        (Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy)) || (Math.abs(g.dy) > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4),
      onPanResponderGrant: (_, g) => {
        nav.vertical = Math.abs(g.dy) > Math.abs(g.dx);
        cancelAnimation(pos);
        nav.base = pos.value;
      },
      onPanResponderMove: (_, g) => {
        if (nav.vertical) return;
        // التاليةُ في اليسار: السحبُ يميناً يأتي بها. وخلف الطرفين مقاومة.
        const max = (nav.count - 1) * nav.step;
        let value = nav.base + g.dx;
        if (value < 0) value *= 0.3;
        else if (value > max) value = max + (value - max) * 0.3;
        pos.value = value;
      },
      onPanResponderRelease: (_, g) => {
        if (nav.vertical) {
          // إلى أعلى شهرٌ أحدث، وإلى أسفل أقدم — كما يصعد السهمُ في التلميح.
          if (Math.abs(g.dy) > 40 || Math.abs(g.vy) > 0.5) shiftMonth(g.dy < 0 ? 1 : -1);
          else go(nav.index);
          return;
        }
        const from = Math.round(nav.base / nav.step);
        const want = Math.round((nav.base + g.dx + g.vx * 160) / nav.step);
        go(Math.max(from - FLING_MAX, Math.min(from + FLING_MAX, want)));
      },
      onPanResponderTerminate: () => go(nav.index),
    }),
  ).current;

  // الأسطوانةُ تدور ما دامت الحاليّةَ والشاشةُ ظاهرة — لا حركةَ بلا عين (القاعدة ٣٢٧).
  const spin = useRef(new Animated.Value(0)).current;
  const current = slots[index];
  const spinning = current?.type === "piece" && current.moment.kind === "MUSIC";
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    if (!spinning || !focused) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spinning, focused]); // eslint-disable-line react-hooks/exhaustive-deps
  const rotate = useMemo(() => spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }), [spin]);

  const wallMonth = current?.type === "piece" ? riyadh(current.moment.createdAt).month : null;
  const wallCount = months.find((row) => row.month === wallMonth)?.count ?? 0;

  /*
    النقشُ يتكرّر بدورته، فشريطٌ بعرض الشاشة وبلاطتين يكفي: يُزاح بباقي قسمة الموضع على
    الدورة (`modulo` — على الخيط الأصليّ)، فيبدو جداراً بلا نهاية بعدد لوحاتٍ لا يُحصى.
    والعُقدُ تُبنى مرّةً: عقدةٌ جديدةٌ مع كلّ رسمةٍ تُفصل في منتصف الحركة فترمش (القاعدة ٣٥٠).
  */

  const [wallH, setWallH] = useState(0);
  const piece = current?.type === "piece" ? current.moment : null;
  const spotY = insets.top + CROWN;
  // اللوحُ الخشبيّ يبدأ تحت البطاقة، ولا يقلّ ولا يأكل الجدار.
  const wainscot = wallH ? Math.round(Math.max(64, Math.min(wallH * 0.24, wallH - (frameTop + H + 104)))) : 0;
  const monthPieces = useMemo(
    () => slots.flatMap((slot, at) => (slot.type === "piece" && riyadh(slot.moment.createdAt).month === wallMonth ? [{ at, moment: slot.moment }] : [])),
    [slots, wallMonth],
  );

  return (
    <View style={{ flex: 1, backgroundColor: skin.wall }}>
      <View
        {...pan.panHandlers}
        onLayout={(event) => setWallH(event.nativeEvent.layout.height)}
        style={{ flex: 1, backgroundColor: skin.wall, overflow: "hidden" }}
      >
        <Wall skin={skin} image={images?.wall ?? null} width={width} height={wallH} pos={pos} top={insets.top} wainscot={wainscot} />

        {slots.map((slot, at) =>
          Math.abs(at - index) > MOUNTED && Math.abs(at - settled) > MOUNTED ? null : (
            <Hung
              key={slot.key}
              pos={pos}
              at={at}
              step={STEP}
              left={(width - W) / 2}
              w={W}
              h={H}
              spotY={spotY}
              frameTop={frameTop}
              skin={skin}
              slot={slot}
              hidden={hall.data?.hidden ?? 0}
              frameImage={images?.frame ?? null}
              rotate={rotate}
              onTap={onTap}
            />
          ),
        )}

        {/* لافتةُ الشهر: اسمُ الجدار، ثمّ لمن هو، ثمّ كم فيه. */}
        <View pointerEvents="none" style={{ position: "absolute", top: headTop, left: 0, right: 0, alignItems: "center", gap: 4 }}>
          {wallMonth !== null ? (
            <>
              <Text face="display" style={{ color: skin.sign.ink, fontSize: 30, fontWeight: "800", lineHeight: 40 }}>
                جدار {MONTHS[wallMonth]}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <LockIcon size={12} color={skin.sign.muted} />
                <Text style={{ color: skin.sign.muted, fontSize: 12.5, fontWeight: "700" }}>خاص بك</Text>
              </View>
              <Text style={{ color: skin.sign.muted, fontSize: 12, opacity: 0.85 }}>{ar(wallCount)} لحظة</Text>
            </>
          ) : null}
        </View>

        {hall.isLoading ? <Spinner style={{ position: "absolute", top: frameTop + H / 2 - 10, alignSelf: "center" }} /> : null}
        {hall.data && slots.length === 0 ? (
          <Text style={{ position: "absolute", top: frameTop + H / 2 - 10, left: 0, right: 0, color: skin.sign.muted, textAlign: "center" }}>
            ما في هالسنة لحظات بعد.
          </Text>
        ) : null}

        {/* صدى الحاليّة: وجوهُ من تفاعل تصعد فوق إطارها وتذوب — طبقةٌ أخيرةٌ فوق كلّ شيء. */}
        {!!piece?.echo?.faces.length && focused && !detail ? (
          <EchoRise key={piece.id} echo={piece.echo} width={width} w={W} top={frameTop + H * 0.78} rise={H * 0.9} />
        ) : null}

        <View style={{ position: "absolute", top: frameTop + H + 22, left: 24, right: 24, alignItems: "center" }}>
          {piece ? <Placard skin={skin} moment={piece} onEcho={() => setDetail({ moment: piece, tab: "echo" })} /> : null}
        </View>

        {/* أعلى الجدار: العلامةُ يساراً، والرجوعُ و«عرض اللحظات» يميناً. */}
        {/*
          صفٌّ واحد يتوسّطه الطرفان (القاعدة ٣٥٨): كان الزرّان كتلةً والعلامةُ كتلةً تُحاذيان بهوامش
          محسوبة، فيُزيحهما مكانُ الحرف في سطره. و«ATHAR» تحت «آثار» خارج الحساب.
        */}
        <View style={{ position: "absolute", top: insets.top + 20, left: 16, right: 16, height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/me/archive" as never))}
              hitSlop={8}
              style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: skin.sign.bg, ...SOFT }}
            >
              <View style={{ transform: [{ scaleX: -1 }] }}>
                <BackIcon size={14} color={skin.sign.ink} />
              </View>
            </Pressable>
            {months.length ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setGrid(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: skin.sign.bg, ...SOFT }}
              >
                <GridGlyph size={12} color={skin.sign.ink} />
                <Text style={{ color: skin.sign.ink, fontSize: 11.5, fontWeight: "800" }}>عرض اللحظات</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32 }}>
            <Text face="display" style={{ color: skin.sign.ink, fontSize: 24, fontWeight: "800", lineHeight: 32 }}>
              آثار
            </Text>
            <AthrMark size={28} />
            <Text
              face="latin"
              style={{ position: "absolute", top: 29, left: 0, right: 0, textAlign: "center", color: skin.sign.muted, fontSize: 8.5, fontWeight: "700", letterSpacing: 4.5 }}
            >
              ATHAR
            </Text>
          </View>
        </View>
      </View>

      {/* الأرضيّة ثابتة، والشهورُ عليها تقفز إلى أوّل لوحةٍ في كلّ شهر. */}
      <Floor skin={skin} image={images?.floor ?? null} width={width} height={floorH}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {months.map((row) => {
              const on = row.month === wallMonth;
              return (
                <Pressable key={row.month} onPress={() => go(row.first)} style={{ alignItems: "center", gap: 4 }}>
                  <View
                    style={{
                      height: 34,
                      paddingHorizontal: 16,
                      borderRadius: 17,
                      justifyContent: "center",
                      backgroundColor: on ? skin.accent.bg : "rgba(251,248,241,.16)",
                      borderWidth: 1,
                      borderColor: on ? skin.accent.bg : "rgba(251,248,241,.22)",
                    }}
                  >
                    <Text style={{ color: on ? skin.accent.ink : "#FBF8F1", fontSize: 13, fontWeight: "800" }}>{MONTHS[row.month]}</Text>
                  </View>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? skin.accent.bg : "transparent" }} />
                </Pressable>
              );
            })}
          </ScrollView>
          {months.length > 1 ? (
            <Pressable accessibilityLabel="الشهر التالي" onPress={() => shiftMonth(1)} hitSlop={8} style={{ paddingHorizontal: 12, paddingBottom: 9 }}>
              <BackIcon size={18} color="#FBF8F1" />
            </Pressable>
          ) : null}
        </View>
        {months.length > 1 ? (
          <View style={{ alignItems: "center", marginTop: 6, gap: 1 }}>
            <View style={{ transform: [{ rotate: "90deg" }] }}>
              <BackIcon size={13} color="rgba(251,248,241,.8)" />
            </View>
            <Text style={{ color: "rgba(251,248,241,.85)", fontSize: 11.5, fontWeight: "600" }}>اسحب للتنقل بين الشهور</Text>
          </View>
        ) : null}
      </Floor>

      {grid ? (
        <MonthGrid
          skin={skin}
          title={wallMonth !== null ? `جدار ${MONTHS[wallMonth]}` : ""}
          items={monthPieces}
          current={index}
          onPick={(at) => {
            setGrid(false);
            go(at);
          }}
          onClose={() => setGrid(false)}
        />
      ) : null}

      {detail ? (
        <HallSheet
          skin={skin}
          frameImage={images?.frame ?? null}
          moment={detail.moment}
          tab={detail.tab}
          onClose={() => setDetail(null)}
          onOpen={(id) => {
            setDetail(null);
            router.push(`/m/${id}` as never);
          }}
        />
      ) : null}
    </View>
  );
}

const SOFT = { shadowColor: "#3A2A14", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 } as const;

/** شبكةٌ صغيرة بأيقونة «عرض اللحظات». */
function GridGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {[
        [3, 3],
        [13, 3],
        [3, 13],
        [13, 13],
      ].map(([x, y]) => (
        <Rect key={`${x}${y}`} x={x} y={y} width={8} height={8} rx={2} fill="none" stroke={color} strokeWidth={2} />
      ))}
    </Svg>
  );
}

/**
 * لوحةٌ معلّقة: موضعُها من موضع الجدار، ومصباحُها في السقف فوقها يسكب ضوءَه مخروطاً عليها،
 * وظلُّها على الجدار. والعُقدُ تُبنى مرّةً لكلّ لوحة (`useMemo`) لا مع كلّ رسمة (القاعدة ٣٥٠)،
 * وخصائصُها ثابتةٌ فلا يُعاد رسمُها مع كلّ انتقال إلا الحاليّةُ وما تركته (القاعدة ٣٥٣).
 */
const Hung = memo(function Hung({
  pos,
  at,
  step,
  left,
  w,
  h,
  spotY,
  frameTop,
  skin,
  slot,
  hidden,
  frameImage,
  rotate,
  onTap,
}: {
  pos: SharedValue<number>;
  at: number;
  step: number;
  left: number;
  w: number;
  h: number;
  spotY: number;
  frameTop: number;
  skin: HallSkin;
  slot: Slot;
  hidden: number;
  frameImage: string | null;
  rotate?: Animated.AnimatedInterpolation<string>;
  onTap: (at: number) => void;
}) {
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value - at * step }] }));
  const glow = useAnimatedStyle(() => ({
    opacity: interpolate(pos.value - at * step, [-step, 0, step], [0.45, 1, 0.45], Extrapolation.CLAMP),
  }));
  const coneW = w * 1.5;
  const coneH = frameTop + h * 0.75 - spotY;
  const fixture = 16;
  return (
    <Reanimated.View
      pointerEvents="box-none"
      style={[{ position: "absolute", top: 0, left, width: w, height: frameTop + h + 12 }, slide]}
    >
      {/* المخروط: ضوءٌ دافئ يبدأ ضيّقاً عند المصباح ويتّسع على اللوحة ويذوب تحتها. */}
      <Reanimated.View pointerEvents="none" style={[{ position: "absolute", top: spotY + 10, left: (w - coneW) / 2 }, glow]}>
        <Svg width={coneW} height={coneH}>
          <Defs>
            <LinearGradient id={`cone${at}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={skin.light} stopOpacity={0.85} />
              <Stop offset="0.55" stopColor={skin.light} stopOpacity={0.32} />
              <Stop offset="1" stopColor={skin.light} stopOpacity={0} />
            </LinearGradient>
            <RadialGradient id={`pool${at}`} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={skin.light} stopOpacity={0.45} />
              <Stop offset="1" stopColor={skin.light} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Polygon
            points={`${coneW / 2 - fixture / 2},0 ${coneW / 2 + fixture / 2},0 ${coneW * 0.92},${coneH} ${coneW * 0.08},${coneH}`}
            fill={`url(#cone${at})`}
          />
          <Rect x={coneW * 0.06} y={coneH - h * 0.95} width={coneW * 0.88} height={h * 0.7} fill={`url(#pool${at})`} />
        </Svg>
      </Reanimated.View>
      {/* المصباحُ في السقف: ساقٌ قصيرة ورأسٌ نحاسيّ مائلٌ إلى أسفل، ووهجٌ عند فوهته. */}
      <View pointerEvents="none" style={{ position: "absolute", top: spotY - 4, left: (w - fixture) / 2, width: fixture, alignItems: "center" }}>
        <View style={{ width: 3, height: 5, backgroundColor: skin.brass.edge }} />
        <View style={{ width: fixture, height: 11, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, backgroundColor: skin.sign.ink, borderWidth: 1, borderColor: skin.brass.edge }} />
        <View style={{ width: fixture - 6, height: 3, borderRadius: 2, backgroundColor: skin.light, marginTop: -1 }} />
      </View>
      <View style={{ position: "absolute", top: frameTop, left: 0, width: w, height: h }}>
        <Pressable onPress={() => onTap(at)} style={{ flex: 1 }}>
          {slot.type === "rope" ? (
            <Rope skin={skin} hidden={hidden} w={w} h={h} />
          ) : (
            <Piece skin={skin} frameImage={frameImage} moment={slot.moment} w={w} h={h} rotate={rotate} />
          )}
        </Pressable>
      </View>
    </Reanimated.View>
  );
});

/**
 * الجدار: نقشٌ مرفوع (القاعدة ٣٥٠) يتكرّر بلاطاتٍ، وبلاه جصٌّ بخطوط ورقِ جدارٍ خافتة. وفي أعلاه
 * السقفُ تحت شريط الحالة ثمّ إفريزٌ مدرّج، وضوءٌ يبهت إلى أسفل، وحوافٌّ أعتم، ولوحٌ خشبيّ في
 * أسفله بحاجزه وألواحه المحفورة، وقاعدةٌ تلتقي بالأرض. والنقشُ والألواحُ يمرّان مع اللوحات.
 */
const Wall = memo(function Wall({
  skin,
  image,
  width,
  height,
  pos,
  top,
  wainscot,
}: {
  skin: HallSkin;
  image: string | null;
  width: number;
  height: number;
  pos: SharedValue<number>;
  top: number;
  wainscot: number;
}) {
  // باقي القسمة على دورة النقش موجباً: جدارٌ بلا نهاية بعدد لوحاتٍ لا يُحصى.
  const shift = useAnimatedStyle(() => {
    const m = pos.value % WALL_TILE;
    return { transform: [{ translateX: m < 0 ? m + WALL_TILE : m }] };
  });
  if (!height) return null;
  const cols = Math.ceil(width / WALL_TILE) + 2;
  const rows = Math.ceil(height / WALL_TILE);
  const panel = WALL_TILE / 2;
  const crown = top + CROWN;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Reanimated.View style={[{ position: "absolute", top: 0, bottom: 0, left: -WALL_TILE, width: cols * WALL_TILE }, shift]}>
        {image
          ? Array.from({ length: cols * rows }, (_, at) => (
              <MediaImage
                fade={false}
                key={at}
                mediaId={image}
                style={{ position: "absolute", left: (at % cols) * WALL_TILE, top: Math.floor(at / cols) * WALL_TILE, width: WALL_TILE, height: WALL_TILE }}
              />
            ))
          : Array.from({ length: cols * 4 }, (_, at) => (
              // ورقُ جدار: خطوطٌ عموديّة رفيعة بظلّ الجدار، كلُّ اثنين متقاربين.
              <View
                key={at}
                style={{ position: "absolute", top: crown, bottom: 0, left: at * (WALL_TILE / 4) + (at % 2 ? 6 : 0), width: 1, backgroundColor: skin.wallShade, opacity: 0.32 }}
              />
            ))}
        {/* اللوحُ الخشبيّ: حاجزٌ بارزٌ في أعلاه، ثمّ ألواحٌ محفورة بدورة البلاطة نفسها فيتّصل. */}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: wainscot, backgroundColor: skin.wall }}>
          <View style={{ height: 2, backgroundColor: skin.bevel.light }} />
          <View style={{ height: 7, backgroundColor: skin.wallShade }} />
          <View style={{ height: 2, backgroundColor: skin.bevel.dark }} />
          <View style={{ height: 6, backgroundColor: "rgba(0,0,0,.05)" }} />
          {Array.from({ length: cols * 2 }, (_, at) => (
            <View
              key={at}
              style={{
                position: "absolute",
                top: 26,
                bottom: 24,
                left: at * panel + 9,
                width: panel - 18,
                borderWidth: 2,
                borderTopColor: skin.bevel.dark,
                borderLeftColor: skin.bevel.dark,
                borderBottomColor: skin.bevel.light,
                borderRightColor: skin.bevel.light,
                borderRadius: 3,
              }}
            >
              <View style={{ flex: 1, margin: 6, borderWidth: 1, borderColor: skin.bevel.dark, borderRadius: 2, opacity: 0.45 }} />
            </View>
          ))}
        </View>
      </Reanimated.View>
      {/* الضوءُ والعمق: سقفٌ يُظلّ أعلاه، وضوءٌ دافئ يبهت إلى أسفل، والحافّتان أعتم. */}
      <Svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="wallLight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0.16} />
            <Stop offset="0.14" stopColor="#000" stopOpacity={0} />
            <Stop offset="0.7" stopColor="#000" stopOpacity={0.02} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.14} />
          </LinearGradient>
          <RadialGradient id="wallEdge" cx="50%" cy="45%" rx="70%" ry="72%">
            <Stop offset="0.6" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.26} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#wallLight)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#wallEdge)" />
      </Svg>
      {/* السقفُ تحت شريط الحالة، ثمّ إفريزٌ مدرّج: ضوءٌ فوق ظلٍّ فوق ضوء، كما يلتقي الجصُّ بالجدار. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: crown - 8, backgroundColor: skin.ceiling }} />
      <View style={{ position: "absolute", top: crown - 8, left: 0, right: 0 }}>
        <View style={{ height: 2, backgroundColor: skin.bevel.light }} />
        <View style={{ height: 3, backgroundColor: skin.wallShade }} />
        <View style={{ height: 2, backgroundColor: skin.bevel.light }} />
        <View style={{ height: 1, backgroundColor: skin.bevel.dark }} />
        <View style={{ height: 5, backgroundColor: "rgba(0,0,0,.05)" }} />
      </View>
      {/* القاعدة: شريطٌ داكنٌ يلتقي بالأرض. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 9, backgroundColor: skin.floorEdge }} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 9, height: 2, backgroundColor: skin.bevel.light }} />
    </View>
  );
});

/**
 * الأرضيّة: نقشٌ مرفوع، وبلاه ألواحُ خشبٍ بدرجاتٍ متفاوتة وفواصلَ متخالفة ولمعةٍ من الضوء —
 * ثابتةٌ لا تمرّ مع اللوحات: أرضٌ تتحرّك تحت القدم تُقرأ رمشة (القاعدة ٣٥٣).
 */
function Floor({
  skin,
  image,
  width,
  height,
  children,
}: {
  skin: HallSkin;
  image: string | null;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const cols = Math.ceil(width / FLOOR_TILE) + 2;
  const plank = 22;
  const rows = Math.ceil(height / plank);
  return (
    <View style={{ height, backgroundColor: skin.floor, overflow: "hidden", paddingTop: 14, paddingBottom: Math.max(insets.bottom, 12) }}>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, bottom: 0, left: -FLOOR_TILE, width: cols * FLOOR_TILE }}
      >
        {image
          ? Array.from({ length: cols * Math.ceil(height / FLOOR_TILE) }, (_, at) => (
              <MediaImage
                fade={false}
                key={at}
                mediaId={image}
                style={{ position: "absolute", top: Math.floor(at / cols) * FLOOR_TILE, left: (at % cols) * FLOOR_TILE, width: FLOOR_TILE, height: FLOOR_TILE }}
              />
            ))
          : Array.from({ length: rows }, (_, row) =>
              Array.from({ length: cols * 2 + 1 }, (_, at) => {
                // درجةُ كلّ لوحٍ من موضعه لا عشوائيّة: ترسم الرسمةُ نفسها في كلّ مرّة.
                const tone = ((row * 7 + at * 13) % 5) - 2;
                return (
                  <View
                    key={`${row}-${at}`}
                    style={{
                      position: "absolute",
                      top: row * plank,
                      height: plank,
                      left: at * (FLOOR_TILE / 2) - (row % 3) * (FLOOR_TILE / 6),
                      width: FLOOR_TILE / 2,
                      backgroundColor: tone > 0 ? `rgba(255,236,200,${tone * 0.05})` : `rgba(0,0,0,${-tone * 0.06})`,
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: skin.floorEdge,
                    }}
                  >
                    <View style={{ position: "absolute", top: plank * 0.35, left: 10, right: 18, height: 1, backgroundColor: "rgba(0,0,0,.08)" }} />
                  </View>
                );
              }),
            )}
      </Animated.View>
      {/* ظلُّ الجدار على أوّل الأرض، ولمعةُ الضوء عليها. */}
      <Svg pointerEvents="none" width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity={0.42} />
            <Stop offset="0.3" stopColor="#000" stopOpacity={0.05} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.3} />
          </LinearGradient>
          <RadialGradient id="floorSheen" cx="50%" cy="20%" rx="55%" ry="60%">
            <Stop offset="0" stopColor="#FFE9C2" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FFE9C2" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#floorShade)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#floorSheen)" />
      </Svg>
      {children}
    </View>
  );
}

/**
 * بطاقةُ الشرح تحت اللوحة، كبطاقة متحف: الساعةُ | التاريخ، ثمّ ما لا تقوله اللوحةُ وحدها —
 * نصُّ الصورة وعنوانُ الأغنية — مرّةً واحدة، ثمّ خطٌّ، ثمّ صداها: وجوهُ من تفاعل متراكبة
 * وعددُها والتعليقات، والضغطُ عليه يفتح النافذة على التفاعلات.
 */
function Placard({ skin, moment, onEcho }: { skin: HallSkin; moment: ArchiveMoment; onEcho?: () => void }) {
  const when = riyadh(moment.createdAt);
  const line = moment.kind === "PHOTO" ? moment.text : moment.kind === "MUSIC" ? momentLine(moment) : null;
  const echo = moment.echo;
  return (
    <View
      style={{
        backgroundColor: skin.placard.bg,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minWidth: 220,
        maxWidth: 290,
        alignItems: "center",
        gap: 7,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,.05)",
        ...SOFT,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <ClockIcon size={14} color={skin.placard.muted} />
          <Text style={{ color: skin.placard.ink, fontSize: 12.5, fontWeight: "700" }}>{timeOfDay(new Date(moment.createdAt))}</Text>
        </View>
        <View style={{ width: 1, height: 14, backgroundColor: skin.placard.muted, opacity: 0.4 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <CalendarIcon size={14} color={skin.placard.muted} />
          <Text style={{ color: skin.placard.ink, fontSize: 12.5, fontWeight: "700" }}>
            {ar(when.day)} {MONTHS[when.month]} {ar(when.year)}
          </Text>
        </View>
      </View>
      {line ? (
        <Text numberOfLines={2} style={{ color: skin.placard.ink, fontSize: 12.5, textAlign: "center", lineHeight: 19 }}>
          {line}
        </Text>
      ) : null}
      {echo && (echo.reactions || echo.comments) ? (
        <>
          <View style={{ alignSelf: "stretch", height: 1, backgroundColor: skin.placard.muted, opacity: 0.22 }} />
          <Pressable onPress={onEcho} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* متجاورةً لا متراكبة: كانت كلُّ واحدةٍ تغطّي حافّةَ ما قبلها فيُقرأ الوجهُ مقصوصاً. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              {echo.faces.slice(0, 3).map((face, at) => (
                <ReactionGlyph key={at} kind={face.kind} emoji={face.emoji} size={22} />
              ))}
            </View>
            {echo.reactions ? <Text style={{ color: skin.placard.ink, fontSize: 13, fontWeight: "800" }}>{ar(echo.reactions)}</Text> : null}
            {echo.comments ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <CommentIcon size={13} color={skin.placard.muted} />
                <Text style={{ color: skin.placard.muted, fontSize: 12, fontWeight: "700" }}>{ar(echo.comments)}</Text>
              </View>
            ) : null}
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/** «عرض اللحظات»: لحظاتُ الشهر بلاطاتٍ في نافذة، والضغطُ يمشي بك إلى لوحتها على الجدار. */
function MonthGrid({
  skin,
  title,
  items,
  current,
  onPick,
  onClose,
}: {
  skin: HallSkin;
  title: string;
  items: { at: number; moment: ArchiveMoment }[];
  current: number;
  onPick: (at: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tile = (width - 36 - 16) / 3;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="إغلاق" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(20,14,6,.45)" }} />
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: height * 0.78,
          backgroundColor: skin.placard.bg,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: skin.placard.muted, opacity: 0.35, alignSelf: "center", marginTop: 10 }} />
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
          <Text face="display" style={{ flex: 1, color: skin.placard.ink, fontSize: 19, fontWeight: "800" }}>
            {title}
          </Text>
          <Pressable accessibilityLabel="إغلاق" onPress={onClose} hitSlop={10} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.06)" }}>
            <CloseIcon size={15} color={skin.placard.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {items.map(({ at, moment }) => (
            <Pressable
              key={moment.id}
              onPress={() => onPick(at)}
              style={{
                width: tile,
                height: tile * 1.2,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: skin.photo.mat,
                borderWidth: at === current ? 2.5 : 1,
                borderColor: at === current ? skin.accent.bg : "rgba(0,0,0,.08)",
                alignItems: "center",
                justifyContent: "center",
                padding: moment.kind === "PHOTO" && moment.mediaId ? 0 : 8,
              }}
            >
              {moment.kind === "PHOTO" && moment.mediaId ? (
                <MediaImage fade={false} mediaId={moment.mediaId} style={{ width: "100%", height: "100%" }} />
              ) : (
                <Text numberOfLines={4} style={{ color: skin.placard.ink, fontSize: 11.5, textAlign: "center", lineHeight: 17 }}>
                  {momentLine(moment)}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** وجوهُ من تفاعل تصعد من أسفل الحاليّة فوقها إلى أعلاها واحداً بعد آخر وتذوب — مرّةً لكلّ وقوفٍ عندها. */
function EchoRise({ echo, width, w, top, rise }: { echo: HallEcho; width: number; w: number; top: number; rise: number }) {
  const faces = echo.faces.slice(0, 8);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, elevation: 40 }}>
      {faces.map((face, at) => {
        // فوق اللوحة نفسها، يمينٌ ثمّ يسار في عرضها — أمامها لا خلفها ولا على جانبيها.
        const side = at % 2 ? 1 : -1;
        const x = width / 2 + side * (w * 0.12 + ((at * 23) % Math.round(w * 0.28)));
        return <RisingFace key={at} kind={face.kind} emoji={face.emoji} delay={300 + at * 380} x={x} from={top} rise={rise} sway={side * 8} />;
      })}
    </View>
  );
}

function RisingFace({ kind, emoji, delay, x, from, rise, sway }: { kind: string; emoji: string | null; delay: number; x: number; from: number; rise: number; sway: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const motion = useMemo(
    () => ({
      opacity: t.interpolate({ inputRange: [0, 0.1, 0.72, 1], outputRange: [0, 1, 1, 0] }),
      y: t.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }),
      x: t.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, sway, -sway, 0] }),
      scale: t.interpolate({ inputRange: [0, 0.14, 1], outputRange: [0.4, 1.12, 0.85] }),
    }),
    [t, rise, sway],
  );
  useEffect(() => {
    const run = Animated.timing(t, { toValue: 1, duration: 2800, delay, easing: Easing.out(Easing.quad), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - 15,
        top: from,
        opacity: motion.opacity,
        transform: [{ translateY: motion.y }, { translateX: motion.x }, { scale: motion.scale }],
      }}
    >
      <ReactionGlyph kind={kind} emoji={emoji} size={30} />
    </Animated.View>
  );
}

type Tab = "art" | "echo" | "comments";

/**
 * نافذةُ اللوحة — **بقرار المالك**: تصعد من أسفل بمقبضها، وتُغلق بـ«×» وبزرّ الرجوع وبسحبها
 * إلى أسفل من أيّ موضعٍ فيها ما دامت قائمتُها في أعلاها (القاعدة ٧٨). وفيها ثلاثُ شرائح:
 * **اللوحة** كبيرةً وبطاقتُها و«افتح اللحظة»، و**التفاعلات** قائمةً مرتّبة تُمرَّر — شرائحُ
 * لكلّ تفاعلٍ بعدده تُصفّي، والصفوفُ تدخل متتابعة — و**التعليقات** بوجوه أصحابها. والقائمتان
 * من اللحظة نفسها (`/v1/moments/:id`) — الصدى في الأرشيف اثنا عشر وجهاً لا أكثر.
 */
function HallSheet({
  skin,
  frameImage,
  moment,
  tab: first,
  onClose,
  onOpen,
}: {
  skin: HallSkin;
  frameImage: string | null;
  moment: ArchiveMoment;
  tab: Tab;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>(first);
  const [hold, setHold] = useState(false);
  /*
    تمريرُ آبل الأصليّ يلتقط السحبةَ الأفقيّة أيضاً ويُلغي ما تحتها، فيُطفأ في شريحة اللوحة ما دام
    ما فيها يتّسع للنافذة — والكومةُ لا تنازعها سحبةٌ أبداً. وفي شاشةٍ أقصر يبقى ويقف بلمسها (`hold`).
  */
  const [fit, setFit] = useState({ view: 0, content: 0 });
  const overflows = fit.content > fit.view + 1;
  const full = useMoment(moment.id);
  const reactions = full.data?.moment.reactions ?? null;
  const comments = full.data?.moment.comments ?? null;
  const reactionCount = reactions?.length ?? moment.echo?.reactions ?? 0;
  const commentCount = comments?.length ?? moment.echo?.comments ?? 0;

  const drag = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 3 }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = useCallback(() => {
    Animated.timing(drag, { toValue: height, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onClose());
  }, [drag, height, onClose]);

  const atTop = useRef(true);
  // شريحةٌ جديدة قائمةٌ جديدة في أعلاها: السحبُ إلى أسفل يُغلق من أوّل لمسة.
  const pick = (next: Tab) => {
    atTop.current = true;
    setTab(next);
  };
  const pulling = useRef(false);
  const downward = (g: { dx: number; dy: number }) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.3;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) => downward(g) && atTop.current,
      onMoveShouldSetPanResponder: (_, g) => downward(g),
      onPanResponderGrant: (_, g) => {
        pulling.current = downward(g);
      },
      onPanResponderTerminationRequest: () => !pulling.current,
      onPanResponderMove: (_, g) => {
        if (!pulling.current && downward(g)) pulling.current = true;
        if (pulling.current) drag.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if (!pulling.current) return;
        pulling.current = false;
        if (g.dy > 110 || g.vy > 1.1) close();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 5 }).start();
      },
      onPanResponderTerminate: () => {
        pulling.current = false;
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;
  const backdrop = useMemo(() => drag.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: "clamp" }), [drag, height]);

  const when = riyadh(moment.createdAt);
  const tabs: { key: Tab; label: string }[] = [
    { key: "art", label: "اللوحة" },
    { key: "echo", label: reactionCount ? `التفاعلات ${ar(reactionCount)}` : "التفاعلات" },
    { key: "comments", label: commentCount ? `التعليقات ${ar(commentCount)}` : "التعليقات" },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,10,14,.6)", opacity: backdrop }}>
        <Pressable accessibilityLabel="إغلاق" onPress={close} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.9,
          backgroundColor: "#141A20",
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          transform: [{ translateY: drag }],
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -6 },
          elevation: 24,
        }}
      >
        <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,.28)", alignSelf: "center", marginTop: 10 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع إلى القاعة"
            onPress={close}
            hitSlop={10}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }}
          >
            <CloseIcon size={16} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text face="display" numberOfLines={1} style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>
              {ar(when.day)} {MONTHS[when.month]} {ar(when.year)}
            </Text>
            <Text numberOfLines={1} style={{ color: "rgba(255,255,255,.6)", fontSize: 12, marginTop: 1 }}>
              {timeOfDay(new Date(moment.createdAt))}
              {moment.placeName ? ` · ${moment.placeName}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", paddingHorizontal: 18, marginTop: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.1)" }}>
          {tabs.map((one) => {
            const on = one.key === tab;
            return (
              <Pressable key={one.key} onPress={() => pick(one.key)} style={{ flex: 1, alignItems: "center", paddingVertical: 11 }}>
                <Text style={{ color: on ? "#fff" : "rgba(255,255,255,.55)", fontSize: 13.5, fontWeight: on ? "800" : "600" }}>{one.label}</Text>
                <View style={{ position: "absolute", bottom: -1, height: 2.5, width: "70%", borderRadius: 2, backgroundColor: on ? skin.accent.bg : "transparent" }} />
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          key={tab}
          scrollEnabled={!hold && (tab !== "art" || overflows)}
          onLayout={(event) => {
            const view = event.nativeEvent.layout.height;
            setFit((now) => (now.view === view ? now : { ...now, view }));
          }}
          onContentSizeChange={(_, content) => setFit((now) => (now.content === content ? now : { ...now, content }))}
          onScroll={(event) => {
            atTop.current = event.nativeEvent.contentOffset.y <= 2;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30, gap: 14 }}
        >
          {tab === "art" ? (
            <View style={{ alignItems: "center", gap: 18 }}>
              <View style={{ padding: 18, borderRadius: 18, backgroundColor: skin.wall, alignItems: "center" }}>
                <DetailPiece skin={skin} frameImage={frameImage} moment={moment} w={Math.min(270, width * 0.66)} onHold={setHold} />
              </View>
              <Placard skin={skin} moment={moment} onEcho={() => pick("echo")} />
              <Pressable
                onPress={() => onOpen(moment.id)}
                style={{ height: 46, paddingHorizontal: 26, borderRadius: 23, justifyContent: "center", backgroundColor: skin.accent.bg }}
              >
                <Text style={{ color: skin.accent.ink, fontSize: 14.5, fontWeight: "800" }}>افتح اللحظة</Text>
              </Pressable>
            </View>
          ) : tab === "echo" ? (
            <ReactionList skin={skin} rows={reactions} loading={full.isLoading} />
          ) : (
            <CommentList rows={comments} loading={full.isLoading} />
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

type ReactionRow = { userId: string; kind: string; emoji: string | null; name: string; avatarMediaId: string | null; mine: boolean };

/** التفاعلاتُ مرتّبة: الأكثرُ أوّلاً، وداخلَ كلّ تفاعلٍ بالاسم — وشرائحُ بعددها تُصفّي. */
function ReactionList({ skin, rows, loading }: { skin: HallSkin; rows: ReactionRow[] | null; loading: boolean }) {
  const [only, setOnly] = useState<string | null>(null);
  const groups = useMemo(() => {
    const count = new Map<string, { kind: string; emoji: string | null; count: number }>();
    for (const row of rows ?? []) {
      const key = row.kind === "CUSTOM" ? `CUSTOM:${row.emoji}` : row.kind;
      const now = count.get(key);
      if (now) now.count += 1;
      else count.set(key, { kind: row.kind, emoji: row.emoji, count: 1 });
    }
    return [...count.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [rows]);
  const sorted = useMemo(() => {
    const rank = new Map(groups.map(([key], at) => [key, at]));
    const keyOf = (row: ReactionRow) => (row.kind === "CUSTOM" ? `CUSTOM:${row.emoji}` : row.kind);
    return [...(rows ?? [])]
      .filter((row) => !only || keyOf(row) === only)
      .sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0) || a.name.localeCompare(b.name, "ar"));
  }, [rows, groups, only]);

  if (loading && !rows) return <Spinner style={{ marginTop: 30 }} />;
  if (!rows?.length) return <Text style={{ color: "rgba(255,255,255,.6)", textAlign: "center", marginTop: 30 }}>ما تفاعل أحد مع هذه اللحظة بعد.</Text>;
  return (
    <View style={{ gap: 14 }}>
      {/* تلتفّ من اليمين ولا تُمرَّر: صفٌّ أفقيٌّ في جذرٍ من اليمين كان يتوسّط ويُقصّ ولا يتحرّك. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip on={!only} onPress={() => setOnly(null)} accent={skin.accent}>
          <Text style={{ color: !only ? skin.accent.ink : "#fff", fontSize: 13, fontWeight: "800" }}>الكل {ar(rows.length)}</Text>
        </Chip>
        {groups.map(([key, group]) => (
          <Chip key={key} on={only === key} onPress={() => setOnly(only === key ? null : key)} accent={skin.accent}>
            <ReactionGlyph kind={group.kind} emoji={group.emoji} size={20} />
            <Text style={{ color: only === key ? skin.accent.ink : "#fff", fontSize: 13, fontWeight: "800" }}>{ar(group.count)}</Text>
          </Chip>
        ))}
      </View>
      {sorted.map((row, at) => (
        <Entering key={`${row.userId}:${row.kind}:${row.emoji ?? ""}`} delay={Math.min(at, 12) * 45}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
            <Avatar name={row.name} size={44} mediaId={row.avatarMediaId} />
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 14.5, fontWeight: "700" }}>
              {row.mine ? "أنت" : row.name}
            </Text>
            <ReactionGlyph kind={row.kind} emoji={row.emoji} size={28} />
          </View>
          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,.07)", marginTop: 10, marginStart: 56 }} />
        </Entering>
      ))}
    </View>
  );
}

type CommentRow = { id: string; body: string; createdAt: string; sticker?: { mediaId: string } | null; user: { id: string; name: string; avatarMediaId: string | null } };

function CommentList({ rows, loading }: { rows: CommentRow[] | null; loading: boolean }) {
  if (loading && !rows) return <Spinner style={{ marginTop: 30 }} />;
  if (!rows?.length) return <Text style={{ color: "rgba(255,255,255,.6)", textAlign: "center", marginTop: 30 }}>ما علّق أحد على هذه اللحظة بعد.</Text>;
  return (
    <View style={{ gap: 6 }}>
      {rows.map((row, at) => (
        <Entering key={row.id} delay={Math.min(at, 12) * 45}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 6 }}>
            <Avatar name={row.user.name} size={40} mediaId={row.user.avatarMediaId} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, color: "#fff", fontSize: 13.5, fontWeight: "800" }}>
                  {row.user.name}
                </Text>
                <Text style={{ color: "rgba(255,255,255,.5)", fontSize: 11 }}>{relative(new Date(row.createdAt))}</Text>
              </View>
              {row.sticker ? (
                <MediaImage mediaId={row.sticker.mediaId} resizeMode="contain" style={{ width: 96, height: 96 }} />
              ) : (
                <Text style={{ color: "rgba(255,255,255,.88)", fontSize: 14, lineHeight: 22 }}>{row.body}</Text>
              )}
            </View>
          </View>
        </Entering>
      ))}
    </View>
  );
}

function Chip({ on, onPress, accent, children }: { on: boolean; onPress: () => void; accent: { bg: string; ink: string }; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 13, borderRadius: 18, backgroundColor: on ? accent.bg : "rgba(255,255,255,.1)" }}
    >
      {children}
    </Pressable>
  );
}

/** صفٌّ يدخل صاعداً ويظهر — متتابعةً، فتُقرأ القائمةُ حيّةً لا جدولاً جامداً. */
function Entering({ delay, children }: { delay: number; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(t, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const y = useMemo(() => t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }), [t]);
  return <Animated.View style={{ opacity: t, transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

/**
 * صورُ اللحظة متعدّدة الصور كومةً في الإطار الكبير، **بحركةٍ واحدة: السحب** (القاعدة ٣٥٤) —
 * كانت نقراً يرفع العليا وسحباً يُغلق النافذة معاً فيتنازعان الإصبع. العليا تتبع الإصبع يميناً
 * ويساراً وتميل معه، وما تجاوز ربعَ عرضها أو أُفلت بسرعةٍ يطير في جهته، وإلّا عاد. وبعد آخرها
 * إطارٌ فارغ، وسحبةٌ أخرى تُعيدها كلَّها معكوسةً، الأخيرةُ أوّلاً.
 */
const DetailPiece = memo(function DetailPiece({
  skin,
  frameImage,
  moment,
  w,
  onHold,
}: {
  skin: HallSkin;
  frameImage: string | null;
  moment: ArchiveMoment;
  w: number;
  /** الإصبعُ على الكومة: تمريرُ النافذة يقف — `UIScrollView` يأخذ السحبةَ الأفقيّة أيضاً فيُلغي الكومة. */
  onHold?: (on: boolean) => void;
}) {
  const h = w * 1.28;
  const photos = moment.mediaId
    ? [
        { mediaId: moment.mediaId, pos: moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined },
        ...(moment.morePhotos ?? []).map((mediaId, at) => ({ mediaId, pos: moment.morePhotoPos?.[at] })),
      ]
    : [];
  const count = photos.length;
  /*
    الكومةُ كلُّها على الخيط الأصليّ (القاعدة ٣٥٦): كم طار منها (`gone`) والسحبُ (`drag`) قيمتان
    مشتركتان، وكلُّ إطارٍ يقرأ منهما مكانَه — العليا تتبع الإصبع، وما طار مخفيّ، وما تحتها مائل.
    فالطيرانُ ثمّ صعودُ التالية يقعان في إطارٍ واحد بلا رسمةٍ من React بينهما: كانت `setGone`
    ترسم الكومةَ والنابضُ يجري فتعود العليا إلى وسطها لحظةً.
  */
  const gone = useSharedValue(0);
  const drag = useSharedValue(0);
  const busy = useRef(false);
  const sideways = useRef(false);
  // للعدّاد ونصِّ «انتهت الصور» وحدهما: نسخةٌ في React تتبع القيمة بعد أن تستقرّ.
  const [shown, setShown] = useState(0);
  const settle = useCallback((n: number) => {
    busy.current = false;
    setShown(n);
  }, []);
  const pan = useRef(
    PanResponder.create({
      /*
        تأخذ اللمسةَ من أوّلها (القاعدة ٣٥٧): النافذةُ تأخذها عند النزول، وما دامت لها لا يُسأل
        أحدٌ تحتها عن الحركة بعدها — React Native يسأل آباءَ صاحب اللمسة وحدهم — فلم تكن السحبةُ
        تصل إلى الكومة أصلاً. والعموديّةُ تُسلَّم للنافذة لتُغلق.
      */
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => !sideways.current,
      onPanResponderGrant: () => {
        sideways.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (!sideways.current) {
          if (Math.abs(g.dx) < 8 || Math.abs(g.dx) < Math.abs(g.dy) * 1.2) return;
          sideways.current = true;
        }
        if (busy.current) return;
        // يميناً التالية ما بقي شيء، ويساراً السابقة ما طار شيء — وإلّا فلا شيء يتحرّك.
        if (g.dx > 0 && gone.value >= count) return;
        drag.value = g.dx;
      },
      onPanResponderRelease: (_, g) => {
        const was = sideways.current;
        sideways.current = false;
        if (busy.current || !was) return;
        const far = Math.abs(g.dx) > w * 0.25 || Math.abs(g.vx) > 0.5;
        const next = g.dx > 0 && gone.value < count;
        const back = g.dx < 0 && gone.value > 0;
        if (!far || (!next && !back)) {
          drag.value = withSpring(0, { damping: 18, stiffness: 220 });
          return;
        }
        busy.current = true;
        if (next) {
          // العليا تطير يميناً وتصعد التي تحتها.
          drag.value = withTiming(w * 1.3, { duration: 200, easing: REasing.out(REasing.quad) }, () => {
            gone.value = gone.value + 1;
            drag.value = 0;
            runOnJS(settle)(gone.value);
          });
          return;
        }
        /*
          السابقةُ تعود من اليمين حيث طارت وتعلو الكومة: تصير هي العليا في موضعها الذي جرّها الإصبعُ
          إليه، ثمّ تستقرّ — في دالّةٍ واحدة على الخيط الأصليّ فلا يُرى إطارٌ بينهما. ولا دالّةَ تنادي
          نفسها هنا: إرجاعُ الكومة كلّها بدالّةٍ تكرّر نفسها كان يُسقط التطبيق.
        */
        runOnUI((width: number) => {
          "worklet";
          const x = width * 1.3 + drag.value;
          gone.value = gone.value - 1;
          drag.value = x;
          drag.value = withTiming(0, { duration: 200, easing: REasing.out(REasing.quad) }, () => {
            runOnJS(settle)(gone.value);
          });
        })(w);
      },
      onPanResponderTerminate: () => {
        sideways.current = false;
        if (!busy.current) drag.value = withSpring(0, { damping: 18, stiffness: 220 });
      },
    }),
  ).current;
  const empty = useAnimatedStyle(() => ({ opacity: gone.value >= count ? 1 : 0 }));

  if (moment.kind !== "PHOTO" || count < 2) {
    return (
      <View style={{ width: w, height: h }}>
        <Piece skin={skin} frameImage={frameImage} moment={moment} w={w} h={h} />
      </View>
    );
  }
  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      <View
        {...pan.panHandlers}
        onTouchStart={() => onHold?.(true)}
        onTouchEnd={() => onHold?.(false)}
        onTouchCancel={() => onHold?.(false)}
        style={{ width: w, height: h }}
      >
        <Reanimated.View
          pointerEvents="none"
          style={[{ position: "absolute", top: 0, left: 0, width: w, height: h, borderWidth: 2, borderStyle: "dashed", borderColor: skin.placard.muted, borderRadius: 6, alignItems: "center", justifyContent: "center", gap: 6 }, empty]}
        >
          <Text style={{ color: skin.placard.muted, fontSize: 13, fontWeight: "700" }}>انتهت الصور</Text>
          <Text style={{ color: skin.placard.muted, fontSize: 12 }}>اسحب يساراً للسابقة</Text>
        </Reanimated.View>
        {/* الأخيرةُ أوّلاً في الشجرة فالأولى فوقها. */}
        {photos
          .map((photo, at) => (
            <StackCard key={photo.mediaId} at={at} gone={gone} drag={drag} w={w} h={h}>
              <PhotoFrame skin={skin} frameImage={frameImage} mediaId={photo.mediaId} pos={photo.pos} />
            </StackCard>
          ))
          .reverse()}
        <View pointerEvents="none" style={{ position: "absolute", top: 12, right: 12, paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: "rgba(14,26,36,.6)" }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
            {ar(Math.min(shown + 1, count))}/{ar(count)}
          </Text>
        </View>
      </View>
      <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 12 }}>اسحب يميناً للتالية، ويساراً للسابقة</Text>
    </View>
  );
});

/** إطارٌ في الكومة: مكانُه من موضعه بالنسبة إلى ما طار — العليا تتبع الإصبع، وما تحتها مائلٌ، وما طار مخفيّ. */
function StackCard({
  at,
  gone,
  drag,
  w,
  h,
  children,
}: {
  at: number;
  gone: SharedValue<number>;
  drag: SharedValue<number>;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const depth = at - gone.value;
    const d = drag.value;
    // السابقةُ — آخرُ ما طار — تعود من اليمين مع الإصبع حين يُسحب يساراً.
    if (depth === -1 && d < 0) {
      const x = w * 1.3 + d;
      return {
        opacity: interpolate(x, [0, w * 0.6, w * 1.3], [1, 1, 0], Extrapolation.CLAMP),
        transform: [{ translateX: x }, { translateY: 0 }, { rotate: `${interpolate(x, [-w, 0, w], [-14, 0, 14], Extrapolation.CLAMP)}deg` }],
      };
    }
    if (depth < 0 || depth > 2) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "0deg" }] };
    if (depth === 0) {
      // يميناً تتبع الإصبع، ويساراً تبقى مكانها والسابقةُ تعلوها — إلّا الأولى: تقاوم قليلاً.
      const x = d > 0 ? d : gone.value === 0 ? d * 0.15 : 0;
      return {
        opacity: interpolate(Math.abs(x), [0, w * 0.6, w * 1.3], [1, 1, 0], Extrapolation.CLAMP),
        transform: [{ translateX: x }, { translateY: 0 }, { rotate: `${interpolate(x, [-w, 0, w], [-14, 0, 14], Extrapolation.CLAMP)}deg` }],
      };
    }
    return { opacity: 1, transform: [{ translateX: depth * 10 }, { translateY: depth * -8 }, { rotate: depth % 2 ? "-4deg" : "3deg" }] };
  });
  return <Reanimated.View style={[{ position: "absolute", top: 0, left: 0, width: w, height: h }, style]}>{children}</Reanimated.View>;
}

/**
 * إطارُ الصورة: لونُ الثوب وعرضُه وبطانتُه — وإن رُفع للثوب إطارٌ مرسوم (القاعدة ٣٥٠) مُدّ فوق
 * الصورة كلّها، والصورةُ تحته بحشوة عرض الإطار فلا يُغطّي منها إلا حافّتها.
 */
function PhotoFrame({ skin, frameImage, mediaId, pos }: { skin: HallSkin; frameImage: string | null; mediaId: string; pos?: { x: number; y: number } }) {
  return (
    <View style={{ flex: 1, backgroundColor: frameImage ? skin.photo.mat : skin.photo.frame, padding: skin.photo.width, ...SHADOW }}>
      <View style={{ flex: 1, backgroundColor: skin.photo.mat, padding: skin.photo.matWidth }}>
        <MediaImage fade={false} mediaId={mediaId} style={{ flex: 1 }} position={pos} />
      </View>
      {frameImage ? (
        <MediaImage fade={false} mediaId={frameImage} resizeMode="fill" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : null}
    </View>
  );
}

/** اللوحةُ بحسب نوع اللحظة: صورةٌ في إطار (ومتعدّدةُ الصور كومةٌ مائلة)، وخاطرةٌ لوحةُ نصّ، ومكانٌ لوحةٌ نحاسيّة، وأغنيةٌ أسطوانة. */
function Piece({
  skin,
  frameImage,
  moment,
  w,
  h,
  rotate,
}: {
  skin: HallSkin;
  frameImage: string | null;
  moment: ArchiveMoment;
  w: number;
  h: number;
  rotate?: Animated.AnimatedInterpolation<string>;
}) {
  if (moment.kind === "PHOTO" && moment.mediaId) {
    const more = moment.morePhotos ?? [];
    return (
      <View style={{ flex: 1 }}>
        {/* ما بعد الأولى إطاران مائلان خلفها: يُرى أنّها كومةٌ قبل أن تُفتح. */}
        {more.slice(0, 2).map((mediaId, at) => (
          <View
            key={mediaId}
            style={{ position: "absolute", top: 0, left: 0, width: w, height: h, transform: [{ rotate: at ? "-5deg" : "4deg" }, { translateX: at ? -8 : 8 }] }}
          >
            <PhotoFrame skin={skin} frameImage={frameImage} mediaId={mediaId} pos={moment.morePhotoPos?.[at]} />
          </View>
        ))}
        <PhotoFrame
          skin={skin}
          frameImage={frameImage}
          mediaId={moment.mediaId}
          pos={moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined}
        />
        {more.length ? (
          <View style={{ position: "absolute", top: skin.photo.width + 6, right: skin.photo.width + 6, paddingHorizontal: 7, height: 20, borderRadius: 10, justifyContent: "center", backgroundColor: "rgba(14,26,36,.6)" }}>
            <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700" }}>{ar(more.length + 1)} صور</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (moment.kind === "MUSIC") {
    const disc = w * 0.96;
    const label = disc * 0.4;
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={{
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            backgroundColor: skin.vinyl.disc,
            alignItems: "center",
            justifyContent: "center",
            ...SHADOW,
            transform: rotate ? [{ rotate }] : [],
          }}
        >
          {[0.86, 0.72, 0.58].map((ring) => (
            <View key={ring} style={{ position: "absolute", width: disc * ring, height: disc * ring, borderRadius: (disc * ring) / 2, borderWidth: 1, borderColor: skin.vinyl.groove }} />
          ))}
          <View style={{ width: label, height: label, borderRadius: label / 2, overflow: "hidden", backgroundColor: skin.accent.bg }}>
            {moment.musicThumb ? <Image source={{ uri: moment.musicThumb }} style={{ width: label, height: label }} /> : null}
          </View>
          <View style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: skin.wall }} />
        </Animated.View>
      </View>
    );
  }

  if (moment.kind === "PLACE") {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ backgroundColor: skin.brass.bg, borderRadius: 6, borderWidth: 3, borderColor: skin.brass.edge, paddingVertical: 22, paddingHorizontal: 14, alignItems: "center", gap: 8, ...SHADOW }}>
          <PinIcon size={26} color={skin.brass.ink} />
          <Text face="display" numberOfLines={3} style={{ color: skin.brass.ink, fontSize: 18, fontWeight: "800", textAlign: "center" }}>
            {moment.placeName ?? "مكان"}
          </Text>
          {moment.placeCity ? <Text style={{ color: skin.brass.ink, fontSize: 12, opacity: 0.8 }}>{moment.placeCity}</Text> : null}
        </View>
      </View>
    );
  }

  // الخاطرةُ والسفرُ والنومُ والصحو: نصٌّ في الإطار نفسه على بطانةٍ كريميّة — لوحةٌ كالصورة.
  const icon =
    moment.kind === "CITY" ? <PlaneIcon size={30} color={skin.photo.frame} /> :
    moment.kind === "SLEEP" ? <MoonIcon size={30} color={skin.photo.frame} /> :
    moment.kind === "WAKE" ? <SunIcon size={30} color={skin.photo.frame} /> :
    moment.kind === "THOUGHT" ? <QuoteIcon size={28} color={skin.photo.frame} /> :
    <BookIcon size={28} color={skin.photo.frame} />;
  const body =
    moment.kind === "SLEEP" || moment.kind === "WAKE"
      ? `${momentLine(moment)} ${timeOfDay(new Date(moment.createdAt))}`
      : momentLine(moment);
  return (
    <View style={{ flex: 1, backgroundColor: frameImage ? skin.photo.mat : skin.photo.frame, padding: skin.photo.width, ...SHADOW }}>
      <View style={{ flex: 1, backgroundColor: skin.photo.mat, padding: skin.photo.matWidth }}>
        <View style={{ flex: 1, backgroundColor: skin.plaque.bg, borderWidth: 1, borderColor: skin.plaque.edge, padding: 14, alignItems: "center", justifyContent: "center", gap: 12 }}>
          {icon}
          <Text face="display" numberOfLines={7} style={{ color: skin.plaque.ink, fontSize: body.length > 90 ? 14 : 18, fontWeight: "700", textAlign: "center", lineHeight: body.length > 90 ? 22 : 28 }}>
            {body}
          </Text>
        </View>
      </View>
      {frameImage ? <MediaImage fade={false} mediaId={frameImage} resizeMode="fill" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
    </View>
  );
}

/** حبلُ آثار+ (القاعدة ٢٤٤): ما خلفه محفوظٌ، يفتحه الاشتراك — لا يُحذف شيء. */
function Rope({ skin, hidden, w, h }: { skin: HallSkin; hidden: number; w: number; h: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 }}>
      <View style={{ alignItems: "center", gap: 6, marginBottom: 22 }}>
        <LockIcon size={22} color={skin.sign.ink} />
        <Text face="display" style={{ color: skin.sign.ink, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
          {ar(hidden)} لحظة أقدم خلف الحبل
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: skin.accent.bg }}>
          <SparkIcon size={14} color={skin.accent.ink} />
          <Text style={{ color: skin.accent.ink, fontSize: 12.5, fontWeight: "800" }}>افتحها مع آثار+</Text>
        </View>
      </View>
      <View style={{ width: w, height: h * 0.32, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        {[0, 1].map((side) => (
          <View key={side} style={{ width: 10, height: "100%", borderRadius: 5, backgroundColor: skin.rope.post }} />
        ))}
        <View style={{ position: "absolute", left: 6, right: 6, top: 6, height: h * 0.16, borderBottomWidth: 6, borderLeftWidth: 0, borderColor: skin.rope.cord, borderBottomLeftRadius: w, borderBottomRightRadius: w }} />
      </View>
    </View>
  );
}
