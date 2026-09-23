import { useEffect, useState } from "react";
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
  onSize,
}: {
  mediaId: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain";
  /** أبعاد الملف كما وصلت — يحتاجها من يحسب موضع الغلاف بنفسه. */
  onSize?: (width: number, height: number) => void;
}) {
  const [token, setToken] = useState(currentAccess);
  const [tries, setTries] = useState(0);

  useEffect(() => watchAccess(() => setToken(currentAccess())), []);

  if (!mediaId || !token) return null;

  return (
    <Image
      // المفتاح يحمل التوكن: تغيّرُه يُجبر إعادة الطلب بترويسةٍ جديدة.
      key={`${mediaId}:${tries}`}
      source={{
        uri: `${baseUrl}/v1/media/${mediaId}`,
        headers: { authorization: `Bearer ${token}` },
        // الخبيئة بالمعرّف: العنوان ثابت لكنّ الترويسة تتجدّد، والصورة هي هي.
        cacheKey: mediaId,
      }}
      style={style}
      contentFit={resizeMode}
      transition={120}
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
