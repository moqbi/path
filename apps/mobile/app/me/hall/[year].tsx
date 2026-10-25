import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { Spinner } from "../../../components/spinner";
import { Text } from "../../../components/type";
import { ScreenHeader } from "../../../components/screen-header";
import { MediaImage } from "../../../components/media-image";
import { BookIcon, LockIcon, MoonIcon, PinIcon, PlaneIcon, QuoteIcon, SparkIcon, SunIcon } from "../../../components/icons";
import { api } from "../../../lib/api";
import { ar, MONTHS, timeOfDay } from "../../../lib/format";
import { FREE_DAYS, momentLine, type ArchiveMoment, type ArchivePage } from "../../../lib/archive";
import { HALL_SKIN, type HallSkin } from "../../../lib/gallery-skin";

type Hall = { moments: ArchiveMoment[]; limited: boolean; hidden: number };
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
  for (let round = 0; round < 40; round++) {
    const page = await api<ArchivePage>(`/v1/archive?limit=90${cursor ? `&cursor=${cursor}` : ""}`);
    if (round === 0) {
      limited = page.limited;
      hidden = page.hidden;
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
  return { moments: moments.reverse(), limited, hidden };
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
  const skin = HALL_SKIN;
  const { width } = useWindowDimensions();
  const W = Math.min(220, Math.round(width * 0.56));
  const H = Math.round(W * 1.28);
  const STEP = W + 34;

  const hall = useQuery({ queryKey: ["hall", year], queryFn: () => loadHall(year), enabled: Number.isInteger(year) });

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
  useFocusEffect(
    useCallback(() => {
      if (!spinning) return;
      spin.setValue(0);
      const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
      return () => loop.stop();
    }, [spinning, index]), // eslint-disable-line react-hooks/exhaustive-deps
  );
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

  return (
    <View style={{ flex: 1, backgroundColor: skin.ceiling }}>
      <ScreenHeader title={`قاعة ${ar(year)}`} back="/me/archive" />
      {/* السقف: شريطٌ داكن تتدلّى منه الإضاءة. */}
      <View style={{ height: 18, backgroundColor: skin.ceiling }} />
      <View {...pan.panHandlers} style={{ flex: 1, backgroundColor: skin.wall, overflow: "hidden" }}>
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
                    opacity: rel.interpolate({ inputRange: [-STEP, 0, STEP], outputRange: [0.55, 1, 0.55], extrapolate: "clamp" }),
                    transform: [
                      { translateX: rel },
                      { scale: rel.interpolate({ inputRange: [-STEP, 0, STEP], outputRange: [0.8, 1, 0.8], extrapolate: "clamp" }) },
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
          </View>

          <View style={{ alignItems: "center", paddingHorizontal: 28, minHeight: 74 }}>
            {current?.type === "piece" ? <Placard skin={skin} moment={current.moment} /> : null}
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
        <Pressable onPress={() => setDetail(null)} style={{ flex: 1, backgroundColor: "rgba(8,14,20,.9)", alignItems: "center", justifyContent: "center", gap: 18, padding: 24 }}>
          {detail ? (
            <>
              <View style={{ width: Math.min(300, width * 0.74), height: Math.min(300, width * 0.74) * 1.28 }}>
                <Piece skin={skin} moment={detail} w={Math.min(300, width * 0.74)} h={Math.min(300, width * 0.74) * 1.28} />
              </View>
              <Placard skin={skin} moment={detail} wide />
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
            </>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

/** بطاقةُ الشرح تحت اللوحة: التاريخُ، ثمّ سطرُها، ثمّ نوعُها وساعتُها. */
function Placard({ skin, moment, wide = false }: { skin: HallSkin; moment: ArchiveMoment; wide?: boolean }) {
  const when = riyadh(moment.createdAt);
  const line = momentLine(moment);
  return (
    <View style={{ backgroundColor: skin.placard.bg, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, maxWidth: wide ? 320 : 260, alignItems: "center", gap: 2 }}>
      <Text style={{ color: skin.placard.muted, fontSize: 10.5, fontWeight: "700" }}>
        {ar(when.day)} {MONTHS[when.month]} · {timeOfDay(new Date(moment.createdAt))}
      </Text>
      {line && moment.kind !== "THOUGHT" ? (
        <Text numberOfLines={wide ? 3 : 2} style={{ color: skin.placard.ink, fontSize: 12.5, textAlign: "center", lineHeight: 19 }}>
          {line}
        </Text>
      ) : null}
      {moment.kind === "PHOTO" && moment.text ? (
        <Text numberOfLines={wide ? 4 : 2} style={{ color: skin.placard.ink, fontSize: 12.5, textAlign: "center", lineHeight: 19 }}>
          {moment.text}
        </Text>
      ) : null}
    </View>
  );
}

/** اللوحةُ بحسب نوع اللحظة: صورةٌ في إطار، وخاطرةٌ لوحةُ نصّ، ومكانٌ لوحةٌ نحاسيّة، وأغنيةٌ أسطوانة. */
function Piece({ skin, moment, w, h, rotate }: { skin: HallSkin; moment: ArchiveMoment; w: number; h: number; rotate?: Animated.AnimatedInterpolation<string> }) {
  const shadow = { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 8 } as const;

  if (moment.kind === "PHOTO" && moment.mediaId) {
    return (
      <View style={{ flex: 1, backgroundColor: skin.photo.frame, padding: skin.photo.width, ...shadow }}>
        <View style={{ flex: 1, backgroundColor: skin.photo.mat, padding: skin.photo.matWidth }}>
          <MediaImage
            mediaId={moment.mediaId}
            style={{ flex: 1 }}
            position={moment.photoX != null ? { x: moment.photoX, y: moment.photoY ?? 50 } : undefined}
          />
        </View>
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
            ...shadow,
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
        <View style={{ backgroundColor: skin.brass.bg, borderRadius: 6, borderWidth: 3, borderColor: skin.brass.edge, paddingVertical: 22, paddingHorizontal: 14, alignItems: "center", gap: 8, ...shadow }}>
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
    <View style={{ flex: 1, backgroundColor: skin.plaque.bg, borderWidth: 1, borderColor: skin.plaque.edge, borderRadius: 4, padding: 18, alignItems: "center", justifyContent: "center", gap: 12, ...shadow }}>
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
