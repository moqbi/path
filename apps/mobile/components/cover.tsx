import { useRef, useState } from "react";
import { Animated, View } from "react-native";
import { MediaImage } from "./media-image";
import { firstColor } from "./avatar";
import { colors } from "../theme/tokens";

/**
 * طبقة الغلاف: صورته وحدها.
 *
 * كان فوقها درعٌ داكن يعمّ ارتفاعها وذوبانٌ إلى لون الورق — والاثنان
 * يُقرآن على غلافٍ فاتح لطخةً رماديةً أسفل الصورة، لا ذوباناً. أُلغيا
 * بطلب المالك، فالغلاف ينتهي بحافّةٍ نظيفة. ونسخةُ الويب مثلُها.
 *
 * وما يُكتب فوقه يحمل ظلّه بنفسه (`textShadow*` في رأس الخط الزمني):
 * إعتامُ الغلاف كلّه ليُقرأ سطران فوقه ثمنٌ تدفعه الصورة كلّها.
 * وذوبانُ الورق كان يكتب لونَه بيده فلا يتبع ثيماً تحته أصلاً.
 */
/**
 * ارتفاعُ الغلاف في «اللحظات» و«أنا» — ومحرّرُه بالمقاس نفسه.
 *
 * كان المحرّر ١٣٢ والغلافُ ١٧٦، فيضبط صاحبه إطاراً أقصر ممّا يُرى ثمّ
 * يجد غير ما ضبط. رقمٌ واحد يُستورد في الثلاثة لا ثلاثةُ أرقام.
 */
export const COVER_HEIGHT = 176;

export function CoverLayer({
  mediaId,
  spec,
  height,
  y = 50,
  x = 50,
  zoom = 100,
  onNatural,
}: {
  mediaId: string | null | undefined;
  spec: string | null | undefined;
  height: number;
  /** أيّ جزءٍ من الصورة يُرى — نسبٌ كما تُحفظ في `User.coverX/Y`. */
  y?: number;
  x?: number;
  /** القُرب: ١٠٠ ملءُ الإطار، و٣٠٠ ثلاثةُ أضعافه — `User.coverZoom`. */
  zoom?: number;
  /** مقاسُ الصورة الأصليّ — يحتاجه المحرّر ليتبع السحبُ الإصبعَ بالبكسل. */
  onNatural?: (width: number, height: number) => void;
}) {
  return (
    <View style={{ position: "absolute", inset: 0 }}>
      {mediaId ? (
        <CoverImage mediaId={mediaId} height={height} x={x} y={y} zoom={zoom} onNatural={onNatural} />
      ) : (
        <View style={{ width: "100%", height, backgroundColor: firstColor(spec, colors.chip) }} />
      )}
    </View>
  );
}

/**
 * موضعُ الصورة في إطارها — المعادلة نفسها في الويب (`coverStyle`).
 *
 * الصورة تملأ الإطار أوّلاً (`cover`)، وما زاد عنه يُزاح بنسبة الموضع:
 * `x` صفرٌ حافّتُها اليسرى، ومئةٌ اليمنى — وهذا ما يفعله
 * `background-position` في المتصفّح بالحرف. ثمّ تُكبَّر حول **النقطة
 * نفسها** (`transformOrigin`)، فيبقى صفرٌ صفراً ومئةٌ مئةً عند أيّ قُرب،
 * والسحبُ يمرّ على الصورة كلّها من حافّةٍ إلى حافّة.
 */
export function coverFrame(
  box: { width: number; height: number },
  natural: { width: number; height: number },
  x: number,
  y: number,
) {
  const scale = Math.max(box.width / natural.width, box.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    width,
    height,
    left: -(width - box.width) * (x / 100),
    top: -(height - box.height) * (y / 100),
  };
}

function CoverImage({
  mediaId,
  height,
  x,
  y,
  zoom,
  onNatural,
}: {
  mediaId: string;
  height: number;
  x: number;
  y: number;
  zoom: number;
  onNatural?: (width: number, height: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  const frame =
    width > 0 && natural
      ? coverFrame({ width, height }, natural, x, y)
      : { width: width || 0, height, left: 0, top: 0 };

  return (
    <View
      style={{ width: "100%", height, overflow: "hidden" }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View
        style={{
          width: "100%",
          height,
          transform: [{ scale: zoom / 100 }],
          transformOrigin: `${x}% ${y}%`,
        }}
      >
        <MediaImage
          mediaId={mediaId}
          style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.width || "100%", height: frame.height }}
          onSize={(w, h) => {
            setNatural({ width: w, height: h });
            onNatural?.(w, h);
          }}
        />
      </View>
    </View>
  );
}

/** أقصى ما يُحسب من السحب — ما بعده لا يزيد الغلافَ طولاً. */
const STRETCH_MAX = 320;

/**
 * موضعُ التمرير لشاشةٍ غلافُها داخل القائمة («أنا» وملف الصديق).
 *
 * `onScroll` على الخيط الأصليّ، فالغلافُ يتبع الإصبع بلا تأخّر.
 */
export function useStretch() {
  const y = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
    useNativeDriver: true,
  });
  return { y, onScroll };
}

/**
 * غلافٌ يطول بالسحب ولا يترك فراغاً فوقه — كغلاف «اللحظات».
 *
 * كان السحبُ من أعلى في «أنا» وملف الصديق يُنزل القائمة كلّها فيظهر فوق
 * الغلاف شريطٌ بلون الورق. هنا يُحسب ما تجاوزته القائمةُ فوق أعلاها (`d`)
 * ويُمدّ الغلافُ بقدره: يكبر حول وسطه بنسبة `(H + d) / H` ويرتفع `d / 2`،
 * فتبقى حافّتُه العليا على أعلى الشاشة وحافّتُه السفلى في مكانها.
 * والحاويةُ لا تقصّ (`overflow` مرئيّ) — وإلّا قُصّ ما طال.
 */
export function StretchCover({
  y,
  height,
  children,
}: {
  y: Animated.Value;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ height, zIndex: 0 }}>
      <Animated.View
        style={{
          height,
          overflow: "hidden",
          transform: [
            {
              translateY: y.interpolate({
                inputRange: [-STRETCH_MAX, 0, 1],
                outputRange: [-STRETCH_MAX / 2, 0, 0],
                extrapolate: "clamp",
              }),
            },
            {
              scale: y.interpolate({
                inputRange: [-STRETCH_MAX, 0, 1],
                outputRange: [(height + STRETCH_MAX) / height, 1, 1],
                extrapolate: "clamp",
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
