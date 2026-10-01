import { useRef, useState } from "react";
import { View, Pressable, PanResponder, type GestureResponderEvent } from "react-native";
import { STORY_TEXT_BASE, STORY_TEXT_COLORS, STORY_TEXT_MAX, type StoryText } from "@athar/shared";
import { Text, TextInput } from "./type";
import { CheckIcon, CloseIcon } from "./icons";

/**
 * نصوصُ القصة — **بقرار المالك**، كسناب: تُضاف وتُحرَّر وتُسحب وتُكبَّر
 * ويُغيَّر لونُها.
 *
 * والنصُّ لا يُحرق في الصورة (القاعدة ٩٧): يُحفظ بموضعه نسبةً من اللوحة
 * ومقاسه بنقاط شاشةٍ عرضُها ٣٩٠، ويُرسم عند العرض. فيقع في المكان نفسه
 * بالمقاس نفسه على أيّ جهاز — ولوحةُ المعاينة بنسبة الشاشة نفسها لذلك.
 */

const SHADOW = { textShadowColor: "rgba(0,0,0,.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 };

function look(item: StoryText, scale: number) {
  return {
    color: item.color,
    fontSize: item.size * scale,
    lineHeight: item.size * scale * 1.35,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    ...(item.bg ? {} : SHADOW),
  };
}

function Chip({ item, scale, maxWidth }: { item: StoryText; scale: number; maxWidth: number }) {
  return (
    <View
      style={{
        maxWidth,
        paddingHorizontal: item.bg ? 10 * scale : 0,
        paddingVertical: item.bg ? 4 * scale : 0,
        borderRadius: 10 * scale,
        backgroundColor: item.bg ? (item.color === "#0E1A24" ? "rgba(255,255,255,.85)" : "rgba(14,26,36,.62)") : "transparent",
      }}
    >
      <Text style={look(item, scale)}>{item.t}</Text>
    </View>
  );
}

/** النصوص للعرض وحده — في عارض القصص فوق الصورة أو المقطع. */
export function StoryTexts({ texts, width, height }: { texts: StoryText[] | null | undefined; width: number; height: number }) {
  const [sizes, setSizes] = useState<Record<number, { w: number; h: number }>>({});
  if (!texts?.length) return null;
  const scale = width / STORY_TEXT_BASE;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      {texts.map((item, i) => {
        const box = sizes[i] ?? { w: 0, h: 0 };
        return (
          <View
            key={i}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              if (w !== box.w || h !== box.h) setSizes((old) => ({ ...old, [i]: { w, h } }));
            }}
            style={{
              position: "absolute",
              left: item.x * width - box.w / 2,
              top: item.y * height - box.h / 2,
              opacity: box.w ? 1 : 0,
            }}
          >
            <Chip item={item} scale={scale} maxWidth={width * 0.9} />
          </View>
        );
      })}
    </View>
  );
}

const distance = (event: GestureResponderEvent) => {
  const [a, b] = event.nativeEvent.touches;
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

/**
 * نصٌّ على لوحة الناشر: يُسحب بإصبع، ويُكبَّر ويُصغَّر بإصبعين، والضغطةُ
 * تفتح محرّره. والسحبُ إلى أسفل اللوحة لا يحذفه — الحذفُ زرٌّ في المحرّر،
 * فلا يضيع نصٌّ بانزلاق إصبع.
 */
function Draggable({
  item,
  width,
  height,
  onChange,
  onEdit,
  onActive,
}: {
  item: StoryText;
  width: number;
  height: number;
  onChange: (next: StoryText) => void;
  onEdit: () => void;
  onActive?: (active: boolean) => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const latest = useRef(item);
  latest.current = item;
  const change = useRef(onChange);
  change.current = onChange;
  const edit = useRef(onEdit);
  edit.current = onEdit;
  const active = useRef(onActive);
  active.current = onActive;
  const start = useRef({ x: 0, y: 0, size: 0, gap: 0, at: 0, moved: false });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        active.current?.(true);
        start.current = {
          x: latest.current.x,
          y: latest.current.y,
          size: latest.current.size,
          gap: distance(event),
          at: Date.now(),
          moved: false,
        };
      },
      onPanResponderMove: (event, gesture) => {
        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4) start.current.moved = true;
        const now = latest.current;
        if (event.nativeEvent.touches.length >= 2) {
          // إصبعان: المقاسُ يتبع المسافة بينهما من حيث بدأت.
          const gap = distance(event);
          if (!start.current.gap) {
            start.current.gap = gap;
            start.current.size = now.size;
            return;
          }
          const size = Math.max(14, Math.min(72, start.current.size * (gap / start.current.gap)));
          change.current({ ...now, size: Math.round(size) });
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

  const scale = width / STORY_TEXT_BASE;
  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{
        position: "absolute",
        left: item.x * width - box.w / 2,
        top: item.y * height - box.h / 2,
        padding: 6,
        opacity: box.w ? 1 : 0,
      }}
    >
      <Chip item={item} scale={scale} maxWidth={width * 0.9} />
    </View>
  );
}

/** نصوصُ اللوحة قابلةً للتحرير — في ناشر القصة. */
export function EditableTexts({
  texts,
  width,
  height,
  onChange,
  onEdit,
  onActive,
}: {
  texts: StoryText[];
  width: number;
  height: number;
  onChange: (index: number, next: StoryText) => void;
  onEdit: (index: number) => void;
  /**
   * نصٌّ يُسحب الآن: الناشرُ يوقف تمريره — تمريرُ آبل الأصليّ يأخذ السحبة
   * قبل أن تُسأل اللوحة (القاعدة ١٤٠)، فتتحرّك الصفحة لا النصّ.
   */
  onActive?: (active: boolean) => void;
}) {
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      {texts.map((item, i) => (
        <Draggable
          key={i}
          item={item}
          width={width}
          height={height}
          onChange={(next) => onChange(i, next)}
          onEdit={() => onEdit(i)}
          onActive={onActive}
        />
      ))}
    </View>
  );
}

/**
 * محرّرُ النصّ: طبقةٌ داكنة فوق الشاشة لا `Modal` (القاعدة ١٢٦ — الناشرُ
 * فيه نافذةُ المصدر). في أعلاها «تمّ» والحذف والشريط والمقاس، وتحتها
 * الألوان، ثمّ الحقلُ بلونه ومقاسه كما سيُرى — فوق الكيبورد لا تحته.
 */
export function TextEditor({
  initial,
  onDone,
  onDelete,
}: {
  initial: StoryText;
  onDone: (next: StoryText | null) => void;
  onDelete?: () => void;
}) {
  const [item, setItem] = useState(initial);
  const scale = 1;
  const round = (on: boolean) => ({
    height: 38,
    minWidth: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: on ? "#fff" : "rgba(255,255,255,.16)",
  });

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(8,13,18,.78)", paddingTop: 54, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityLabel="تمّ"
          onPress={() => onDone(item.t.trim() ? { ...item, t: item.t.trim() } : null)}
          style={[round(true), { flexDirection: "row", gap: 6, paddingHorizontal: 14 }]}
        >
          <CheckIcon size={16} color="#0E1A24" />
          <Text style={{ color: "#0E1A24", fontSize: 13, fontWeight: "700" }}>تمّ</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable accessibilityLabel="أصغر" onPress={() => setItem((v) => ({ ...v, size: Math.max(14, v.size - 4) }))} style={round(false)}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>A−</Text>
        </Pressable>
        <Pressable accessibilityLabel="أكبر" onPress={() => setItem((v) => ({ ...v, size: Math.min(72, v.size + 4) }))} style={round(false)}>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>A+</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="شريط خلف النص"
          accessibilityState={{ selected: Boolean(item.bg) }}
          onPress={() => setItem((v) => ({ ...v, bg: !v.bg }))}
          style={round(Boolean(item.bg))}
        >
          <Text style={{ color: item.bg ? "#0E1A24" : "#fff", fontSize: 14, fontWeight: "700" }}>Aa</Text>
        </Pressable>
        {onDelete ? (
          <Pressable accessibilityLabel="احذف النص" onPress={onDelete} style={round(false)}>
            <CloseIcon size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, justifyContent: "center" }}>
        {STORY_TEXT_COLORS.map((color) => (
          <Pressable
            key={color}
            accessibilityLabel={`لون ${color}`}
            onPress={() => setItem((v) => ({ ...v, color }))}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: color,
              borderWidth: item.color === color ? 3 : 1.5,
              borderColor: item.color === color ? "#fff" : "rgba(255,255,255,.5)",
            }}
          />
        ))}
      </View>

      <View style={{ marginTop: 28, alignItems: "center" }}>
        <View
          style={{
            maxWidth: "100%",
            paddingHorizontal: item.bg ? 10 : 0,
            paddingVertical: item.bg ? 4 : 0,
            borderRadius: 10,
            backgroundColor: item.bg ? (item.color === "#0E1A24" ? "rgba(255,255,255,.85)" : "rgba(14,26,36,.62)") : "transparent",
          }}
        >
          <TextInput
            value={item.t}
            onChangeText={(t) => setItem((v) => ({ ...v, t }))}
            autoFocus
            multiline
            maxLength={STORY_TEXT_MAX}
            placeholder="اكتب…"
            placeholderTextColor="rgba(255,255,255,.5)"
            style={[look(item, scale), { minWidth: 120, padding: 0 }]}
          />
        </View>
      </View>
    </View>
  );
}

/** نصٌّ جديد: أبيض في وسط اللوحة بمقاسٍ يُقرأ. */
export const freshText = (): StoryText => ({ t: "", x: 0.5, y: 0.42, size: 28, color: "#FFFFFF" });
