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
}: {
  mediaId: string | null | undefined;
  spec: string | null | undefined;
  height: number;
}) {
  return (
    <View style={{ position: "absolute", inset: 0 }}>
      {mediaId ? (
        <MediaImage mediaId={mediaId} style={{ width: "100%", height }} />
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
