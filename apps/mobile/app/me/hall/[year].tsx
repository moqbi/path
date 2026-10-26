import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { Spinner } from "../../../components/spinner";
import { Text } from "../../../components/type";
import { ScreenHeader } from "../../../components/screen-header";
import { MediaImage } from "../../../components/media-image";
import { BookIcon, LockIcon, MessageIcon as CommentIcon, MoonIcon, PinIcon, PlaneIcon, QuoteIcon, SparkIcon, SunIcon } from "../../../components/icons";
import { api } from "../../../lib/api";
import { ar, MONTHS, timeOfDay } from "../../../lib/format";
import { FREE_DAYS, momentLine, type ArchiveMoment, type ArchivePage, type HallEcho } from "../../../lib/archive";
import { HALL_SKIN, hallSkinOf, type HallSkin } from "../../../lib/gallery-skin";
import { ReactionGlyph } from "../../../components/reactions";
import { Avatar } from "../../../components/avatar";

type Hall = { moments: ArchiveMoment[]; limited: boolean; hidden: number; skin: string | null };
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
  for (let round = 0; round < 40; round++) {
    const page = await api<ArchivePage>(`/v1/archive?limit=90${cursor ? `&cursor=${cursor}` : ""}`);
    if (round === 0) {
      limited = page.limited;
      hidden = page.hidden;
      skin = page.hallSkin ?? null;
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
  return { moments: moments.reverse(), limited, hidden, skin };
}

/** كم تُقلَّب بسحبةٍ واحدة، وكم لوحةً تُرسم حول الحاليّة. */
const FLING_MAX = 3;
const WINDOW = 3;

/**
 * قاعةُ السنة (القاعدة ٣٤٦): لحظاتُ صاحبها لوحاتٍ على جدارٍ واحد بترتيبها،
 * والتاليةُ في اليسار كقراءة العربية — **بالإصبع لا بالأسهم**: سحبةٌ تمشي بك،
 * والضغطُ على الحاليّة يفتح شرحَها، وعلى جارتها يأتي بها. والشهرُ لافتةُ الجدار،
 * وشريطُ الشهور في الأرضيّة يقفز. وكلُّ لونٍ من `HALL_SKIN` — ثوبُ المتجر القادم.
 */
export default function HallScreen() {
  const { year: raw } = useLocalSearchParams<{ year: string }>();
  const year = Number(raw);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const W = Math.min(220, Math.round(width * 0.56));
  const H = Math.round(W * 1.28);
  const STEP = W + 34;

  const hall = useQuery({ queryKey: ["hall", year], queryFn: () => loadHall(year), enabled: Number.isInteger(year) });
  // ثوبُ القاعة الملبوس من المتجر (القاعدة ٣٤٨)، وبلاه الكلاسيكيّة.
  const skin = useMemo(() => (hall.data?.skin ? hallSkinOf(hall.data.skin) : HALL_SKIN), [hall.data?.skin]);

  const slots = useMemo<Slot[]>(() => {
    const data = hall.data;
    if (!data) return [];
    const out: Slot[] = data.moments.map((moment) => ({ type: "piece", key: moment.id, moment }));
    // الحبلُ في أوّل القاعة التي يقع فيها الحدّ: ما خلفه أقدمُ من ستّة أشهر.
    const edge = riyadh(new Date(Date.now() - FREE_DAYS * 86_400_000).toISOString()).year;
    if (data.limited && data.hidden > 0 && edge === year) out.unshift({ type: "rope", key: "rope" });
    return out;
  }, [hall.data, year]);

  const pos = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState<ArchiveMoment | null>(null);
  const nav = useRef({ index: 0, count: 0, step: STEP, base: 0 }).current;
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
    pos.setValue(start * STEP);
  }, [slots.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    (to: number) => {
      const target = Math.max(0, Math.min(nav.count - 1, to));
      // قفزةٌ بعيدة من شريط الشهور لا تمرّ بجدارٍ فارغ: اللوحاتُ تُرسم حول الحاليّة وحدها.
      if (Math.abs(target - nav.index) > WINDOW) pos.setValue(target * nav.step);
      else Animated.spring(pos, { toValue: target * nav.step, useNativeDriver: true, speed: 16, bounciness: 3 }).start();
      setIndex(target);
    },
    [pos, nav],
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        pos.stopAnimation((value) => {
          nav.base = value;
        });
      },
      onPanResponderMove: (_, g) => {
        // التاليةُ في اليسار: السحبُ يميناً يأتي بها. وخلف الطرفين مقاومة.
        const max = (nav.count - 1) * nav.step;
        let value = nav.base + g.dx;
        if (value < 0) value *= 0.3;
        else if (value > max) value = max + (value - max) * 0.3;
        pos.setValue(value);
      },
      onPanResponderRelease: (_, g) => {
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
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spinning, focused, index]); // eslint-disable-line react-hooks/exhaustive-deps
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

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
  const wallMonth = current?.type === "piece" ? riyadh(current.moment.createdAt).month : null;
  const wallCount = months.find((row) => row.month === wallMonth)?.count ?? 0;

  /*
    ألواحُ الجدار تمرّ أبطأ من اللوحات (ثلثُ سرعتها): عمقٌ يُحسّ بلا ثلاثة أبعاد —
    الجدارُ بعيدٌ والإطاراتُ عليه. خطوطٌ رفيعة بظلّ الجدار نفسه، لا زخرفة.
  */
  const PANEL = 132;
  const panels = Math.ceil((slots.length * STEP * 0.35 + width * 2) / PANEL) + 2;
  const wallShift = Animated.multiply(pos, 0.35);

  const piece = current?.type === "piece" ? current.moment : null;

  return (
    <View style={{ flex: 1, backgroundColor: skin.ceiling }}>
      <ScreenHeader title={`قاعة ${ar(year)}`} back="/me/archive" />
      <View style={{ height: 18, backgroundColor: skin.ceiling }} />
      <View {...pan.panHandlers} style={{ flex: 1, backgroundColor: skin.wall, overflow: "hidden" }}>
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, bottom: 0, left: -width, flexDirection: "row", transform: [{ translateX: wallShift }] }}
        >
          {Array.from({ length: panels }, (_, at) => (
            <View key={at} style={{ width: PANEL, borderLeftWidth: 1, borderLeftColor: skin.wallShade, opacity: 0.55 }} />
          ))}
        </Animated.View>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, backgroundColor: skin.wallShade }} />
        {/* الضوءُ يسقط على الحاليّة وحدها: ثابتٌ في الوسط واللوحاتُ تمرّ تحته. */}
        <Svg pointerEvents="none" width={W * 2} height={H * 1.5} style={{ position: "absolute", top: 0, left: (width - W * 2) / 2 }}>
          <Defs>
            <RadialGradient id="spot" cx="50%" cy="0%" rx="50%" ry="100%">
              <Stop offset="0" stopColor={skin.light} stopOpacity={0.9} />
              <Stop offset="1" stopColor={skin.light} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W} cy={0} rx={W} ry={H * 1.5} fill="url(#spot)" />
        </Svg>

        <View style={{ flex: 1, justifyContent: "space-evenly" }}>
          <View style={{ alignItems: "center" }}>
            {wallMonth !== null ? (
              <View style={{ backgroundColor: skin.sign.bg, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5, alignItems: "center" }}>
                <Text face="display" style={{ color: skin.sign.ink, fontSize: 15, fontWeight: "800" }}>
                  جدار {MONTHS[wallMonth]}
                </Text>
                <Text style={{ color: skin.sign.muted, fontSize: 10.5 }}>{ar(wallCount)} لحظة</Text>
              </View>
            ) : null}
          </View>

          <View style={{ height: H + 24 }}>
            {hall.isLoading ? <Spinner style={{ marginTop: H / 2 }} /> : null}
            {hall.data && slots.length === 0 ? (
              <Text style={{ color: skin.sign.muted, textAlign: "center", marginTop: H / 2 - 10 }}>ما في هالسنة لحظات بعد.</Text>
            ) : null}
            {slots.map((slot, at) => {
              if (Math.abs(at - index) > WINDOW) return null;
              const rel = Animated.subtract(pos, at * STEP);
              return (
                <Animated.View
                  key={slot.key}
                  style={{
                    position: "absolute",
                    top: 12,
                    left: (width - W) / 2,
                    width: W,
                    height: H,
                    opacity: rel.interpolate({ inputRange: [-STEP, 0, STEP], outputRange: [0.5, 1, 0.5], extrapolate: "clamp" }),
                    transform: [
                      // المنظورُ أوّلاً — React Native يطبّقه على ما بعده وحده.
                      { perspective: 900 },
                      { translateX: rel },
                      { scale: rel.interpolate({ inputRange: [-STEP, 0, STEP], outputRange: [0.8, 1, 0.8], extrapolate: "clamp" }) },
                      // الجارتان تميلان نحو الحاليّة قليلاً: جدارٌ يُرى من أمامه لا من صفحة.
                      { rotateY: rel.interpolate({ inputRange: [-STEP, 0, STEP], outputRange: ["-14deg", "0deg", "14deg"], extrapolate: "clamp" }) },
                    ],
                  }}
                >
                  <Pressable
                    onPress={() => {
                      if (at !== index) return go(at);
                      if (slot.type === "rope") router.push("/subscribe" as never);
                      else setDetail(slot.moment);
                    }}
                    style={{ flex: 1 }}
                  >
                    {slot.type === "rope" ? (
                      <Rope skin={skin} hidden={hall.data?.hidden ?? 0} w={W} h={H} />
                    ) : (
                      <Piece skin={skin} moment={slot.moment} w={W} h={H} rotate={at === index ? rotate : undefined} />
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
            {/* صدى الحاليّة يطفو منها: وجوهُ من تفاعل تصعد من إطارها وتذوب (القاعدة ٣٤٩). */}
            {piece?.echo?.faces.length && focused ? <EchoRise key={piece.id} echo={piece.echo} width={width} top={12} h={H} /> : null}
          </View>

          <View style={{ alignItems: "center", paddingHorizontal: 28, minHeight: 92 }}>
            {piece ? <Placard skin={skin} moment={piece} onEcho={() => setDetail(piece)} /> : null}
          </View>
        </View>
      </View>

      {/* الأرضيّة: شريطُ الشهور يقفز إلى أوّل لوحةٍ في كلّ شهر. */}
      <View style={{ backgroundColor: skin.floor, borderTopWidth: 3, borderTopColor: skin.floorEdge, paddingTop: 12, paddingBottom: 30 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {months.map((row) => {
            const on = row.month === wallMonth;
            return (
              <Pressable
                key={row.month}
                onPress={() => go(row.first)}
                style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: "center", backgroundColor: on ? skin.accent.bg : "rgba(255,255,255,.14)" }}
              >
                <Text style={{ color: on ? skin.accent.ink : "#FBF8F1", fontSize: 12.5, fontWeight: "700" }}>{MONTHS[row.month]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {slots.length > 1 ? (
          <Text style={{ color: "rgba(251,248,241,.75)", fontSize: 11.5, textAlign: "center", marginTop: 10 }}>
            {ar(index + 1)} / {ar(slots.length)} · اسحب لتمشي
          </Text>
        ) : null}
      </View>

      <Modal visible={Boolean(detail)} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,14,20,.92)" }}>
          <Pressable onPress={() => setDetail(null)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
          {detail ? (
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 24, paddingTop: 70 }}>
              <DetailPiece skin={skin} moment={detail} w={Math.min(290, width * 0.72)} />
              <Placard skin={skin} moment={detail} wide />
              {detail.echo && (detail.echo.faces.length || detail.echo.comments) ? <EchoWall echo={detail.echo} /> : null}
              <Pressable
                onPress={() => {
                  const id = detail.id;
                  setDetail(null);
                  router.push(`/m/${id}` as never);
                }}
                style={{ height: 42, paddingHorizontal: 22, borderRadius: 21, justifyContent: "center", backgroundColor: skin.accent.bg }}
              >
                <Text style={{ color: skin.accent.ink, fontSize: 14, fontWeight: "800" }}>افتح اللحظة</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

/**
 * بطاقةُ الشرح تحت اللوحة: التاريخُ والساعة، ثمّ ما لا تقوله اللوحةُ وحدها — نصُّ الصورة
 * وعنوانُ الأغنية — **مرّةً واحدة** (كان سطرُ الصورة يُكتب مرّتين)، ثمّ صداها: وجوهُ من تفاعل
 * متراكبةً وعددُ التفاعلات والتعليقات، والضغطُ عليه يفتح اللوحة.
 */
function Placard({ skin, moment, wide = false, onEcho }: { skin: HallSkin; moment: ArchiveMoment; wide?: boolean; onEcho?: () => void }) {
  const when = riyadh(moment.createdAt);
  const line = moment.kind === "PHOTO" ? moment.text : moment.kind === "MUSIC" ? momentLine(moment) : null;
  const echo = moment.echo;
  return (
    <View style={{ backgroundColor: skin.placard.bg, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, maxWidth: wide ? 320 : 270, alignItems: "center", gap: 4 }}>
      <Text style={{ color: skin.placard.muted, fontSize: 10.5, fontWeight: "700" }}>
        {ar(when.day)} {MONTHS[when.month]} · {timeOfDay(new Date(moment.createdAt))}
      </Text>
      {line ? (
        <Text numberOfLines={wide ? 4 : 2} style={{ color: skin.placard.ink, fontSize: 12.5, textAlign: "center", lineHeight: 19 }}>
          {line}
        </Text>
      ) : null}
      {echo && (echo.reactions || echo.comments) && !wide ? (
        <Pressable onPress={onEcho} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
          <View style={{ flexDirection: "row" }}>
            {echo.faces.slice(0, 3).map((face, at) => (
              <View key={at} style={{ marginLeft: at ? -7 : 0, borderRadius: 12, borderWidth: 1.5, borderColor: skin.placard.bg }}>
                <ReactionGlyph kind={face.kind} emoji={face.emoji} size={20} />
              </View>
            ))}
          </View>
          {echo.reactions ? <Text style={{ color: skin.placard.ink, fontSize: 11.5, fontWeight: "800" }}>{ar(echo.reactions)}</Text> : null}
          {echo.comments ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <CommentIcon size={13} color={skin.placard.muted} />
              <Text style={{ color: skin.placard.muted, fontSize: 11.5, fontWeight: "700" }}>{ar(echo.comments)}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

/** وجوهُ من تفاعل تصعد من إطار الحاليّة واحداً بعد آخر وتذوب — مرّةً لكلّ وقوفٍ عندها. */
function EchoRise({ echo, width, top, h }: { echo: HallEcho; width: number; top: number; h: number }) {
  const faces = echo.faces.slice(0, 6);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: top + h }}>
      {faces.map((face, at) => (
        <RisingFace key={at} kind={face.kind} emoji={face.emoji} delay={350 + at * 420} x={width / 2 + (at % 2 ? 1 : -1) * (30 + ((at * 37) % 70))} from={top + h * 0.75} />
      ))}
    </View>
  );
}

function RisingFace({ kind, emoji, delay, x, from }: { kind: string; emoji: string | null; delay: number; x: number; from: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(t, { toValue: 1, duration: 2600, delay, easing: Easing.out(Easing.quad), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - 16,
        top: from,
        opacity: t.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -from * 0.9] }) },
          { scale: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.1, 0.9] }) },
        ],
      }}
    >
      <ReactionGlyph kind={kind} emoji={emoji} size={32} />
    </Animated.View>
  );
}

/** صدى اللحظة في لوحتها الكبيرة: من تفاعل بوجهه وشارةِ تفاعله، وكم علّق. */
function EchoWall({ echo }: { echo: HallEcho }) {
  return (
    <View style={{ alignItems: "center", gap: 10, maxWidth: 320 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
        {echo.faces.map((face, at) => (
          <View key={at} style={{ alignItems: "center", width: 54 }}>
            <View>
              <Avatar name={face.name} size={42} mediaId={face.avatarMediaId} />
              <View style={{ position: "absolute", bottom: -4, left: -4 }}>
                <ReactionGlyph kind={face.kind} emoji={face.emoji} size={20} />
              </View>
            </View>
            <Text numberOfLines={1} style={{ color: "rgba(251,248,241,.85)", fontSize: 10.5, marginTop: 5 }}>
              {face.name.split(" ")[0]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: "rgba(251,248,241,.7)", fontSize: 12 }}>
        {[echo.reactions ? `${ar(echo.reactions)} تفاعل` : null, echo.comments ? `${ar(echo.comments)} تعليق` : null].filter(Boolean).join("، ")}
      </Text>
    </View>
  );
}

/** صورُ اللحظة متعدّدة الصور مكدّسةً في الإطار الكبير: الضغطُ يُقلّب العليا إلى آخر الكومة. */
function DetailPiece({ skin, moment, w }: { skin: HallSkin; moment: ArchiveMoment; w: number }) {
  const h = w * 1.28;
  const photos = moment.mediaId
    ? [
        { mediaId: moment.mediaId, pos: moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined },
        ...(moment.morePhotos ?? []).map((mediaId, at) => ({ mediaId, pos: moment.morePhotoPos?.[at] })),
      ]
    : [];
  const [top, setTop] = useState(0);
  const flip = useRef(new Animated.Value(0)).current;
  if (moment.kind !== "PHOTO" || photos.length < 2) {
    return (
      <View style={{ width: w, height: h }}>
        <Piece skin={skin} moment={moment} w={w} h={h} />
      </View>
    );
  }
  const shuffle = () => {
    Animated.timing(flip, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setTop((now) => (now + 1) % photos.length);
      flip.setValue(0);
    });
  };
  const order = photos.map((_, at) => photos[(top + at) % photos.length]);
  return (
    <Pressable onPress={shuffle} style={{ width: w, height: h }}>
      {order
        .slice(0, 3)
        .reverse()
        .map((photo, back) => {
          const depth = Math.min(2, order.length - 1) - back; // ٠ للعليا
          const lift = depth === 0;
          return (
            <Animated.View
              key={photo.mediaId}
              style={{
                position: "absolute",
                width: w,
                height: h,
                transform: [
                  { translateX: lift ? flip.interpolate({ inputRange: [0, 1], outputRange: [0, -w * 0.9] }) : depth * 10 },
                  { translateY: depth * -8 },
                  { rotate: lift ? flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-12deg"] }) : `${depth % 2 ? -4 : 3}deg` },
                ],
                opacity: lift ? flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1,
              }}
            >
              <PhotoFrame skin={skin} mediaId={photo.mediaId} pos={photo.pos} />
            </Animated.View>
          );
        })}
      <View style={{ position: "absolute", top: 12, right: 12, paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: "rgba(14,26,36,.6)" }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
          {ar(top + 1)}/{ar(photos.length)}
        </Text>
      </View>
    </Pressable>
  );
}

const SHADOW = { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 8 } as const;

function PhotoFrame({ skin, mediaId, pos }: { skin: HallSkin; mediaId: string; pos?: { x: number; y: number } }) {
  return (
    <View style={{ flex: 1, backgroundColor: skin.photo.frame, padding: skin.photo.width, ...SHADOW }}>
      <View style={{ flex: 1, backgroundColor: skin.photo.mat, padding: skin.photo.matWidth }}>
        <MediaImage mediaId={mediaId} style={{ flex: 1 }} position={pos} />
      </View>
    </View>
  );
}

/** اللوحةُ بحسب نوع اللحظة: صورةٌ في إطار (ومتعدّدةُ الصور كومةٌ مائلة)، وخاطرةٌ لوحةُ نصّ، ومكانٌ لوحةٌ نحاسيّة، وأغنيةٌ أسطوانة. */
function Piece({ skin, moment, w, h, rotate }: { skin: HallSkin; moment: ArchiveMoment; w: number; h: number; rotate?: Animated.AnimatedInterpolation<string> }) {
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
            <PhotoFrame skin={skin} mediaId={mediaId} pos={moment.morePhotoPos?.[at]} />
          </View>
        ))}
        <PhotoFrame
          skin={skin}
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

  // الخاطرةُ والسفرُ والنومُ والصحو: لوحةُ نصٍّ على ورقٍ كريميّ.
  const icon =
    moment.kind === "CITY" ? <PlaneIcon size={22} color={skin.plaque.ink} /> :
    moment.kind === "SLEEP" ? <MoonIcon size={22} color={skin.plaque.ink} /> :
    moment.kind === "WAKE" ? <SunIcon size={22} color={skin.plaque.ink} /> :
    moment.kind === "THOUGHT" ? <QuoteIcon size={22} color={skin.plaque.ink} /> :
    <BookIcon size={22} color={skin.plaque.ink} />;
  const body =
    moment.kind === "SLEEP" || moment.kind === "WAKE"
      ? `${momentLine(moment)} ${timeOfDay(new Date(moment.createdAt))}`
      : momentLine(moment);
  return (
    <View style={{ flex: 1, backgroundColor: skin.plaque.bg, borderWidth: 1, borderColor: skin.plaque.edge, borderRadius: 4, padding: 18, alignItems: "center", justifyContent: "center", gap: 12, ...SHADOW }}>
      {icon}
      <Text face="display" numberOfLines={7} style={{ color: skin.plaque.ink, fontSize: body.length > 90 ? 14.5 : 17, fontWeight: "700", textAlign: "center", lineHeight: body.length > 90 ? 22 : 26 }}>
        {body}
      </Text>
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
