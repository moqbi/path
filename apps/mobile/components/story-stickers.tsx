import { useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Pressable, View, type GestureResponderEvent } from "react-native";
import { STORY_TEXT_BASE, STORY_TIME_STYLES, type StorySticker } from "@athar/shared";
import { Text } from "./type";
import { ClockIcon, MusicIcon, MuteIcon, PinIcon } from "./icons";
import { ar } from "../lib/format";

/**
 * ملصقاتُ القصة (القاعدة ٢٣٨) — **بقرار المالك**: الموقع والوقت والموسيقى.
 *
 * كالنصوص تماماً (القاعدة ٢٠٥): لا تُحرق في الصورة، بل موضعٌ نسبيّ ومقاسٌ
 * يُرسمان عند العرض. والوقتُ لا يُحفظ نصّاً: يُقرأ من `createdAt` كـ«صحيت»
 * (القاعدة ٥٤)، فما يُحفظ شكلُه وحده.
 */

export type TimeStyle = (typeof STORY_TIME_STYLES)[number];

export const TIME_STYLE_NAMES: Record<TimeStyle, string> = {
  digital: "رقمي",
  clock: "ساعة",
  pill: "كبسولة",
  date: "تاريخ",
};

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function clock(at: Date) {
  const h = at.getHours();
  const m = at.getMinutes();
  return { text: `${ar(h % 12 || 12)}:${ar(String(m).padStart(2, "0"))}`, half: h < 12 ? "ص" : "م", h, m };
}

const SHADOW = { textShadowColor: "rgba(0,0,0,.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 };

function TimeFace({ style, at, k }: { style: TimeStyle; at: Date; k: number }) {
  const time = clock(at);

  if (style === "clock") {
    const size = 74 * k;
    const ring = 3 * k;
    // المواضعُ داخل الحدّ: مركزُ الوجه منتصفُ ما بين الحدّين.
    const c = (size - ring * 2) / 2;
    const hand = (length: number, deg: number, width: number, color: string) => (
      <View
        style={{
          position: "absolute",
          left: c - width / 2,
          top: c - length,
          width,
          height: length * 2,
          transform: [{ rotate: `${deg}deg` }],
        }}
      >
        <View style={{ width, height: length, borderRadius: width, backgroundColor: color }} />
      </View>
    );
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#FDFCF8",
          borderWidth: ring,
          borderColor: "#0E1A24",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        {[0, 90, 180, 270].map((deg) => (
          <View
            key={deg}
            style={{
              position: "absolute",
              left: c - 1.5 * k,
              top: 4 * k,
              width: 3 * k,
              height: (c - 4 * k) * 2,
              transform: [{ rotate: `${deg}deg` }],
            }}
          >
            <View style={{ width: 3 * k, height: 6 * k, borderRadius: 2, backgroundColor: "#0E1A24" }} />
          </View>
        ))}
        {hand(c * 0.55, (time.h % 12) * 30 + time.m * 0.5, 4 * k, "#0E1A24")}
        {hand(c * 0.78, time.m * 6, 3 * k, "#FF7A5A")}
        <View
          style={{
            position: "absolute",
            left: c - 4 * k,
            top: c - 4 * k,
            width: 8 * k,
            height: 8 * k,
            borderRadius: 4 * k,
            backgroundColor: "#0E1A24",
          }}
        />
      </View>
    );
  }

  if (style === "pill") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 7 * k,
          paddingHorizontal: 14 * k,
          paddingVertical: 8 * k,
          borderRadius: 999,
          backgroundColor: "#FDFCF8",
        }}
      >
        <ClockIcon size={18 * k} color="#0E1A24" />
        <Text style={{ fontSize: 19 * k, fontWeight: "800", color: "#0E1A24" }}>
          {time.text} {time.half}
        </Text>
      </View>
    );
  }

  if (style === "date") {
    return (
      <View style={{ borderRadius: 16 * k, overflow: "hidden", minWidth: 120 * k, backgroundColor: "#FDFCF8" }}>
        <View style={{ backgroundColor: "#FF7A5A", paddingVertical: 4 * k, paddingHorizontal: 12 * k }}>
          <Text style={{ color: "#fff", fontSize: 12.5 * k, fontWeight: "800", textAlign: "center" }}>{DAYS[at.getDay()]}</Text>
        </View>
        <View style={{ paddingVertical: 6 * k, paddingHorizontal: 12 * k, alignItems: "center" }}>
          <Text style={{ color: "#0E1A24", fontSize: 24 * k, fontWeight: "800", lineHeight: 30 * k }}>
            {ar(at.getDate())} {MONTHS[at.getMonth()]}
          </Text>
          <Text style={{ color: "#4A5560", fontSize: 13 * k, fontWeight: "700" }}>
            {time.text} {time.half}
          </Text>
        </View>
      </View>
    );
  }

  // رقميّ: أرقامٌ كبيرة بظلّها على الصورة نفسها، بلا أرضية.
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 * k }}>
      <Text style={{ color: "#fff", fontSize: 44 * k, fontWeight: "800", lineHeight: 52 * k, ...SHADOW }}>{time.text}</Text>
      <Text style={{ color: "#fff", fontSize: 17 * k, fontWeight: "800", marginBottom: 7 * k, ...SHADOW }}>{time.half}</Text>
    </View>
  );
}

function PlaceFace({ name, city, k }: { name: string; city?: string; k: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8 * k,
        maxWidth: 260 * k,
        paddingHorizontal: 13 * k,
        paddingVertical: 8 * k,
        borderRadius: 14 * k,
        backgroundColor: "#FDFCF8",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <View style={{ width: 26 * k, height: 26 * k, borderRadius: 13 * k, backgroundColor: "#FF7A5A", alignItems: "center", justifyContent: "center" }}>
        <PinIcon size={15 * k} color="#fff" />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={{ color: "#0E1A24", fontSize: 15 * k, fontWeight: "800" }}>
          {name}
        </Text>
        {city ? (
          <Text numberOfLines={1} style={{ color: "#4A5560", fontSize: 11 * k, fontWeight: "600" }}>
            {city}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** ثلاثةُ أعمدةٍ تتراقص ما دام الصوتُ يُسمع، وتقف حين يُكتم. */
function Bars({ k, playing }: { k: number; playing: boolean }) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (!playing) {
      values.forEach((value) => value.setValue(0.35));
      return;
    }
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: 260 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.3, duration: 260 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [playing, values]);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2.5 * k, height: 16 * k }}>
      {values.map((value, i) => (
        <Animated.View
          key={i}
          style={{ width: 3.5 * k, height: 16 * k, borderRadius: 2, backgroundColor: "#F6B93B", transform: [{ scaleY: value }] }}
        />
      ))}
    </View>
  );
}

function MusicFace({ label, k, playing, muted }: { label?: string; k: number; playing: boolean; muted: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8 * k,
        maxWidth: 240 * k,
        paddingHorizontal: 13 * k,
        paddingVertical: 9 * k,
        borderRadius: 999,
        backgroundColor: "rgba(14,26,36,.82)",
      }}
    >
      {muted ? <MuteIcon size={17 * k} color="#fff" /> : <MusicIcon size={17 * k} color="#fff" />}
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14 * k, fontWeight: "700", flexShrink: 1 }}>
        {label || "صوت"}
      </Text>
      <Bars k={k} playing={playing && !muted} />
    </View>
  );
}

/** وجهُ الملصق — واحدٌ في الناشر والعارض. */
export function StickerFace({
  item,
  k,
  at,
  playing = false,
  muted = false,
}: {
  item: StorySticker;
  /** مقاسُ الرسم: مقاسُ الملصق × نسبةُ الشاشة إلى ٣٩٠. */
  k: number;
  at: Date;
  playing?: boolean;
  muted?: boolean;
}) {
  if (item.kind === "time") return <TimeFace style={item.style} at={at} k={k} />;
  if (item.kind === "place") return <PlaceFace name={item.name} city={item.city} k={k} />;
  return <MusicFace label={item.label} k={k} playing={playing} muted={muted} />;
}

/** ملصقٌ في موضعه: يتوسّط نقطتَه ويختفي حتى يُقاس. */
function Seat({
  item,
  width,
  height,
  children,
  handlers,
}: {
  item: StorySticker;
  width: number;
  height: number;
  children: React.ReactNode;
  handlers?: object;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      {...handlers}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w !== box.w || h !== box.h) setBox({ w, h });
      }}
      style={{
        position: "absolute",
        left: item.x * width - box.w / 2,
        top: item.y * height - box.h / 2,
        opacity: box.w ? 1 : 0,
        padding: 4,
      }}
    >
      {children}
    </View>
  );
}

/**
 * الملصقات للعرض — في عارض القصص. الموقعُ يُضغط فيفتح الخرائط، والموسيقى
 * تُضغط فتكتم الصوت أو تعيده. والطبقةُ `box-none`: ما بين الملصقات يبقى
 * لنصفَي التنقّل تحتها.
 */
export function StoryStickers({
  stickers,
  width,
  height,
  at,
  playing,
  muted,
  onPlace,
  onMusic,
}: {
  stickers: StorySticker[] | null | undefined;
  width: number;
  height: number;
  at: Date;
  playing: boolean;
  muted: boolean;
  onPlace: (item: Extract<StorySticker, { kind: "place" }>) => void;
  onMusic: () => void;
}) {
  if (!stickers?.length) return null;
  const base = width / STORY_TEXT_BASE;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      {stickers.map((item, i) => (
        <Seat key={i} item={item} width={width} height={height}>
          {item.kind === "time" ? (
            <View pointerEvents="none">
              <StickerFace item={item} k={item.scale * base} at={at} />
            </View>
          ) : (
            <Pressable
              accessibilityLabel={item.kind === "place" ? `افتح ${item.name} في الخرائط` : muted ? "شغّل الصوت" : "اكتم الصوت"}
              onPress={() => (item.kind === "place" ? onPlace(item) : onMusic())}
            >
              <StickerFace item={item} k={item.scale * base} at={at} playing={playing} muted={muted} />
            </Pressable>
          )}
        </Seat>
      ))}
    </View>
  );
}

const distance = (event: GestureResponderEvent) => {
  const [a, b] = event.nativeEvent.touches;
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

/** ملصقٌ على لوحة الناشر: يُسحب بإصبع ويُكبَّر بإصبعين، والضغطةُ تفتح خياراته. */
function Draggable({
  item,
  width,
  height,
  at,
  onChange,
  onEdit,
  onActive,
}: {
  item: StorySticker;
  width: number;
  height: number;
  at: Date;
  onChange: (next: StorySticker) => void;
  onEdit: () => void;
  onActive?: (active: boolean) => void;
}) {
  const latest = useRef(item);
  latest.current = item;
  const change = useRef(onChange);
  change.current = onChange;
  const edit = useRef(onEdit);
  edit.current = onEdit;
  const active = useRef(onActive);
  active.current = onActive;
  const start = useRef({ x: 0, y: 0, scale: 1, gap: 0, at: 0, moved: false });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        active.current?.(true);
        start.current = { x: latest.current.x, y: latest.current.y, scale: latest.current.scale, gap: distance(event), at: Date.now(), moved: false };
      },
      onPanResponderMove: (event, gesture) => {
        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4) start.current.moved = true;
        const now = latest.current;
        if (event.nativeEvent.touches.length >= 2) {
          const gap = distance(event);
          if (!start.current.gap) {
            start.current.gap = gap;
            start.current.scale = now.scale;
            return;
          }
          const scale = Math.max(0.5, Math.min(2.5, start.current.scale * (gap / start.current.gap)));
          change.current({ ...now, scale: Math.round(scale * 100) / 100 });
          return;
        }
        start.current.gap = 0;
        change.current({
          ...now,
          x: Math.max(0.04, Math.min(0.96, start.current.x + gesture.dx / width)),
          y: Math.max(0.04, Math.min(0.96, start.current.y + gesture.dy / height)),
        });
      },
      onPanResponderTerminate: () => active.current?.(false),
      onPanResponderRelease: () => {
        active.current?.(false);
        if (!start.current.moved && Date.now() - start.current.at < 300) edit.current();
      },
    }),
  ).current;

  return (
    <Seat item={item} width={width} height={height} handlers={pan.panHandlers}>
      <StickerFace item={item} k={item.scale * (width / STORY_TEXT_BASE)} at={at} playing />
    </Seat>
  );
}

/** الملصقاتُ قابلةً للتحرير — في ناشر القصة. */
export function EditableStickers({
  stickers,
  width,
  height,
  onChange,
  onEdit,
  onActive,
}: {
  stickers: StorySticker[];
  width: number;
  height: number;
  onChange: (index: number, next: StorySticker) => void;
  onEdit: (index: number) => void;
  onActive?: (active: boolean) => void;
}) {
  // الوقتُ في المعاينة وقتُ الآن — وعند النشر وقتُ نشرها.
  const [at] = useState(() => new Date());
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      {stickers.map((item, i) => (
        <Draggable
          key={i}
          item={item}
          width={width}
          height={height}
          at={at}
          onChange={(next) => onChange(i, next)}
          onEdit={() => onEdit(i)}
          onActive={onActive}
        />
      ))}
    </View>
  );
}
