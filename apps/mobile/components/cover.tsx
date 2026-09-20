import { useState } from "react";
import { View } from "react-native";
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
