import { useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MediaImage } from "./media-image";
import { firstColor } from "./avatar";
import { colors } from "../theme/tokens";

/**
 * الغلاف يذوب في أرضية الصفحة.
 *
 * في الويب يجري ذلك بقناع (`mask-image`) يُخفي أسفل الصورة تدريجاً حتى
 * يصير ورق الصفحة. ولا قناع في الموبايل، فيُحاكى بتدرّجٍ فوق الصورة من
 * شفّافٍ إلى لون الورق نفسه: العين ترى الذوبان ذاته.
 *
 * والدرع تحت القناع لا فوقه — طبقةٌ داكنة خفيفة تُبقي الاسم الأبيض
 * مقروءاً على غلافٍ فاتح، ثم يذوب الاثنان معاً.
 */
export function CoverLayer({
  mediaId,
  spec,
  height,
  y = 50,
}: {
  mediaId: string | null | undefined;
  spec: string | null | undefined;
  height: number;
  /** أيّ جزءٍ من الصورة يُرى — نسبةٌ كما تُحفظ في `User.coverY`. */
  y?: number;
}) {
  return (
    <View style={{ position: "absolute", inset: 0 }}>
      {mediaId ? (
        <CoverImage mediaId={mediaId} height={height} y={y} />
      ) : (
        <View style={{ width: "100%", height, backgroundColor: firstColor(spec, colors.chip) }} />
      )}

      {/* الدرع: يُقرأ الاسم على أيّ غلاف. */}
      <LinearGradient
        colors={["rgba(14,26,36,0)", "rgba(14,26,36,0.46)"]}
        locations={[0.4, 1]}
        style={{ position: "absolute", inset: 0 }}
        pointerEvents="none"
      />

      {/* الذوبان: آخر سُدس الغلاف يصير ورقاً. */}
      <LinearGradient
        colors={["rgba(234,229,217,0)", "rgba(234,229,217,0.58)", colors.paper]}
        locations={[0.84, 0.94, 1]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(height * 0.34) }}
        pointerEvents="none"
      />
    </View>
  );
}

/**
 * صورة الغلاف بموضعها.
 *
 * في الويب `background-position: 50% y%` — ولا مقابل له في `<Image>`،
 * فيُحسب بنفس المعادلة: الصورة تُرسم بعرض الغلاف كاملاً فيصير ارتفاعها
 * `العرض × (ارتفاعها ÷ عرضها)`، وما زاد عن الغلاف يُزاح لأعلى بنسبة
 * `y` منه — وهو بالضبط ما يفعله المتصفّح.
 */
function CoverImage({ mediaId, height, y }: { mediaId: string; height: number; y: number }) {
  const [box, setBox] = useState(0);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  const drawn =
    box > 0 && natural ? Math.max(height, (box * natural.height) / natural.width) : height;
  const over = Math.max(0, drawn - height);

  return (
    <View
      style={{ width: "100%", height, overflow: "hidden" }}
      onLayout={(event) => setBox(event.nativeEvent.layout.width)}
    >
      <MediaImage
        mediaId={mediaId}
        style={{ width: "100%", height: drawn, transform: [{ translateY: -over * (y / 100) }] }}
        onSize={(width, imageHeight) => setNatural({ width, height: imageHeight })}
      />
    </View>
  );
}
