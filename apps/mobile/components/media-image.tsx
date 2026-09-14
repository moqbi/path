import { useEffect, useState } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
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
      }}
      style={style}
      resizeMode={resizeMode}
      onLoad={(event) => {
        const size = event.nativeEvent.source;
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
