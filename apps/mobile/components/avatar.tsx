import { View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./type";
import { MediaImage } from "./media-image";
import { initial } from "../lib/format";
import { colors } from "../theme/tokens";

/**
 * خلفية الحرف تُشتقّ من الاسم لا تُخزَّن، فتبقى ثابتة لكل شخص بلا عمود.
 * نفس القائمة التي في `src/components/ui.tsx` حرفاً بحرف.
 */
const TINTS = ["#f3e3cd", "#e8ddd0", "#f0e0d6", "#e4e0d4", "#f2e7d9", "#e9dcd2"];

function tintFor(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0) ?? 0;
  return TINTS[sum % TINTS.length];
}

export type Charm = { spec: string; mediaId: string | null } | null | undefined;

/**
 * الإطار الملبوس كاملاً لا `spec` وحده: كان يُمرَّر نصّ التدرّج فقط،
 * فصورةُ الإطار المرفوعة تُهمَل بلا خطأٍ يظهر ويُرسم اللون مكانها.
 * نسخةُ `Frame` في `src/components/ui.tsx` حرفاً بحرف.
 */
export type Frame =
  | { spec: string; mediaId: string | null; frameHole?: number | null }
  | null
  | undefined;

/**
 * كم يُكبَّر رسمُ الإطار حول الصورة — نسخةُ `frameZoom` في الويب.
 *
 * رسمُ الإطار قد يمتدّ بعيداً عن حلقته (جناحان، سعفٌ، تاج)، فوضعُه
 * كلَّه في مربّع الوجه يصغّر الحلقةَ حتى تجلس **داخل** الصورة. فالمقياس
 * من فراغه الأوسط: يُكبَّر الرسم بمقلوبه فيطابق الفراغُ الوجه.
 */
export function frameZoom(frame: NonNullable<Frame>): number {
  const hole = frame.frameHole ?? 0;
  if (hole < 20 || hole > 99) return 1;
  return 100 / hole;
}

/**
 * إزاحةُ الوجه داخل بطاقة الإطار — للمعاينات (المتجر، إكسسواراتي):
 * الوجه يجلس في فراغ الرسم لا في مربّعه.
 */
export function frameInset(frame: { frameHole?: number | null }, box: number): number {
  const hole = frame.frameHole ?? 0;
  const ratio = hole >= 20 && hole <= 99 ? (100 - hole) / 200 : FRAME_INSET;
  return Math.round(box * ratio);
}

/**
 * صورة العرض.
 *
 * الإطار المشترى حلقةٌ حول الصورة مباشرة بلا حلقةٍ بيضاء بينهما: البيضاء
 * كانت تفصل الإطار عن الوجه فيُقرآن قرصين لا إطاراً على صورة.
 *
 * والتدرّجات هنا لونٌ واحد لا تدرّج: `linear-gradient` نصٌّ من CSS لا
 * يفهمه الموبايل. يُقرأ منه أوّل لونٍ حتى تُركَّب طبقةُ التدرّجات —
 * ولونٌ من التدرّج أقربُ إلى المقصود من رماديّ افتراضي.
 */
export function firstColor(spec: string | null | undefined, fallback: string): string {
  if (!spec) return fallback;
  const match = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/.exec(spec);
  return match ? match[0] : fallback;
}

/** كم ينحسر الوجه داخل الإطار المصوَّر — كنسخة الويب. */
const FRAME_INSET = 0.07;

/** حجمُ التميمة نسبةً من قطر الصورة: نصفُه تقريباً لا ثلثاه. */
const CHARM_RATIO = 0.5;

/**
 * أين تجلس التميمة: **ركنُ الصورة الأسفل-الأيسر** — نسخةُ الويب.
 *
 * حافّتُها اليمنى على محور الصورة الرأسيّ، وقاعُها على قاعها: جزءٌ
 * فوق الصورة والإطار وجزءٌ خارجهما، ولا تنزل تحتهما.
 */
function charmSeat(size: number, badge: number): { left: number; top: number } {
  return { left: Math.round(size / 2 - badge), top: Math.round(size - badge) };
}

export function Avatar({
  name,
  size = 40,
  frame,
  mediaId,
  charm,
  style,
}: {
  name: string;
  size?: number;
  frame?: Frame;
  mediaId?: string | null;
  charm?: Charm;
  style?: StyleProp<ViewStyle>;
}) {
  /*
    **الإطار المصوَّر يُرسم فوق الصورة لا تحتها** — كنسخة الويب حرفاً
    بحرف: كان طبقةً تحتها فلا يُرى منه إلا خيطٌ عند الحافة، وزخرفتُه
    تختفي خلف الوجه. وإطارٌ نصفُه خلف الصورة ليس إطاراً.
  */
  const painted = Boolean(frame?.mediaId);
  /*
    الوجه ينحسر تحت إطارٍ بلا قياسٍ محفوظ (حلقةٌ تملأ لوحتها)، ولا ينحسر
    تحت إطارٍ قِيس فراغُه: الفراغ صار بقَدْر الوجه تماماً.
  */
  const zoom = painted && frame ? frameZoom(frame) : 1;
  const pad = frame
    ? painted
      ? zoom > 1.02
        ? 0
        : Math.round(size * FRAME_INSET)
      : Math.max(2, Math.round(size * 0.045))
    : 0;
  const inner = size - pad * 2;
  // الرسمُ يُكبَّر بمقلوب فراغه ويُوسَّط على الوجه، فجناحاه يخرجان عنه.
  const art = Math.round(size * zoom);
  const artOff = Math.round((size - art) / 2);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: pad,
          // والتدرّج يبقى تحتها حلقةً بالحشوة: لونٌ مصمت فوق الوجه يحجبه.
          backgroundColor: frame && !painted ? firstColor(frame.spec, colors.clay) : "transparent",
        },
        style,
      ]}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: mediaId ? colors.chip : tintFor(name),
        }}
      >
        {mediaId ? (
          <MediaImage mediaId={mediaId} style={{ width: inner, height: inner }} />
        ) : (
          <Text
            style={{
              // الحرف على تدرّجٍ فاتح دائماً، فحبره ثابت لا يتبع الوضع.
              color: "#14212b",
              fontSize: Math.round(size * 0.36),
              fontWeight: "600",
            }}
          >
            {initial(name)}
          </Text>
        )}
      </View>

      {painted && frame?.mediaId ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: artOff, top: artOff, width: art, height: art }}
        >
          <MediaImage
            mediaId={frame.mediaId}
            resizeMode="contain"
            style={{ width: art, height: art }}
          />
        </View>
      ) : null}

      {charm && size >= 22 ? <CharmBadge charm={charm} size={size} /> : null}
    </View>
  );
}

/**
 * التميمة: شعارٌ يتدلّى من حافة الصورة، حرّاً بلا إطارٍ يخنقه.
 * و`contain` كي يُرى كاملاً لا مقصوصاً ليملأ مربّعاً.
 */
function CharmBadge({ charm, size }: { charm: NonNullable<Charm>; size: number }) {
  const badge = Math.round(size * CHARM_RATIO);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: badge,
        height: badge,
        // ركنُها الأسفل-الأيسر: يمينُها على المحور، وقاعُها على القاع.
        ...charmSeat(size, badge),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: charm.mediaId ? "transparent" : firstColor(charm.spec, colors.clay),
        borderRadius: charm.mediaId ? 0 : badge / 2,
      }}
    >
      {charm.mediaId ? (
        <MediaImage
          mediaId={charm.mediaId}
          resizeMode="contain"
          style={{ width: badge, height: badge }}
        />
      ) : null}
    </View>
  );
}
