import { useEffect, useMemo, useState } from "react";
import { type ImageStyle, type StyleProp } from "react-native";
import { Image } from "expo-image";
import { baseUrl, currentAccess, renewAccess, watchAccess } from "../lib/api";

/**
 * صورةٌ من الخادم.
 *
 * الملفات خلف التوكن — الدلو مغلق ولا رابط مباشر يخرج منه — فكل صورةٍ
 * تحمل ترويستها. والتوكن في الترويسة لا في العنوان: عناوين الصور تُسجّل
 * في الوسطاء والذاكرة الخبيئة، والترويسة لا تُسجَّل.
 *
 * وتوكن الوصول يعيش خمس عشرة دقيقة: صورةٌ تُطلب بعد انتهائه تُردّ
 * بـ401 و`<Image>` لا يعيد المحاولة وحده. فالخطأ يُقرأ هنا انتهاءً،
 * ويُجدَّد مرّةً واحدة، ثم يُعاد التركيب بمفتاحٍ جديد.
 *
 * **و`expo-image` لا `<Image>` من React Native**: الأخير يفكّ الصورة
 * المتحرّكة (صورُ عرض آثار+، القاعدة ٨٢) إطاراً إطاراً على خيطٍ خلفيّ
 * — فإذا أُعيد رسمُ القائمة (تحديثٌ، أو توكنٌ تجدّد فتغيّر المفتاح)
 * وهو في منتصف إطار، قرأ من صورةٍ حُرّرت فمات التطبيق بـ`SIGTRAP` في
 * `RCTAnimatedImage animatedImageFrameAtIndex`. وهو ما وقع فعلاً «بعد
 * أن يعمل التطبيق فترة». و`expo-image` يفكّها بـSDWebImage، وتلك تملك
 * الإطار حتى تفرغ منه — وخبيئتُه على القرص تُغني عن إعادة التنزيل.
 */
export function MediaImage({
  mediaId,
  style,
  resizeMode = "cover",
  position,
  onSize,
  blurRadius,
  fade = true,
}: {
  mediaId: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  /** `fill` يمدّ الصورةَ على صندوقها — إطارُ قاعة المعرض المرسوم (القاعدة ٣٥٠). */
  resizeMode?: "cover" | "contain" | "fill";
  /** موضعُ القصّ بالمئة — صورةُ اللحظة كما ضبطها صاحبُها في إطار البطاقة. */
  position?: { x: number; y: number };
  /** أبعاد الملف كما وصلت — يحتاجها من يحسب موضع الغلاف بنفسه. */
  onSize?: (width: number, height: number) => void;
  /** تغبيشٌ — لنسخةٍ تملأ ما حول الصورة الكاملة (`FilledImage`). */
  blurRadius?: number;
  /** تلاشي الظهور — يُطفأ في قاعة المعرض: لوحةٌ تُركَّب وهي تمرّ تومض بتلاشيها (القاعدة ٣٥٥). */
  fade?: boolean;
}) {
  const [token, setToken] = useState(currentAccess);
  const [tries, setTries] = useState(0);

  useEffect(() => watchAccess(() => setToken(currentAccess())), []);

  /*
    المصدرُ كائنٌ ثابتٌ ما لم يتغيّر المعرّفُ أو التوكن: كائنٌ جديدٌ مع كل رسمٍ
    يُقرأ صورةً جديدة — وشريطُ القصّة يرسم كل ستّين مللي، فكانت الصورةُ تُطلب
    من الخادم مع كل نبضةٍ منه.
  */
  const source = useMemo(
    () =>
      mediaId && token
        ? {
            uri: `${baseUrl}/v1/media/${mediaId}`,
            headers: { authorization: `Bearer ${token}` },
            // الخبيئة بالمعرّف: العنوان ثابت لكنّ الترويسة تتجدّد، والصورة هي هي.
            cacheKey: mediaId,
          }
        : null,
    [mediaId, token],
  );

  // موضعُ القصّ كائنٌ ثابتٌ ما لم تتغيّر أرقامُه: كائنٌ جديدٌ مع كلّ رسمةٍ يُعيد ضبطَ الصورة فترمش.
  const px = position?.x;
  const py = position?.y;
  const contentPosition = useMemo(
    () => (px != null && py != null ? { left: `${px}%`, top: `${py}%` } : ("center" as const)),
    [px, py],
  );

  if (!source) return null;

  return (
    <Image
      // المفتاح يحمل التوكن: تغيّرُه يُجبر إعادة الطلب بترويسةٍ جديدة.
      key={`${mediaId}:${tries}`}
      source={source}
      style={style}
      contentFit={resizeMode}
      contentPosition={contentPosition}
      transition={fade ? 120 : 0}
      blurRadius={blurRadius}
      onLoad={(event) => {
        const size = event.source;
        if (size?.width && size.height) onSize?.(size.width, size.height);
      }}
      onError={() => {
        if (tries > 0) return;
        setTries(1);
        void renewAccess();
      }}
    />
  );
}
