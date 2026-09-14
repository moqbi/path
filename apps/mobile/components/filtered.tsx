import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Canvas, ColorMatrix, Image as SkiaImage, Paint, Skia, type SkImage,
} from "@shopify/react-native-skia";
import { baseUrl, currentAccess } from "../lib/api";
import { filterMatrix } from "../lib/filters";
import { MediaImage } from "./media-image";

/**
 * صورةٌ من الخادم كما يقرؤها Skia.
 *
 * `useImage` يأخذ عنواناً ولا يأخذ ترويسة، وملفاتُنا خلف التوكن. فتُجلب
 * البايتات بالباب المعتاد — وهو الذي يجدّد التوكن عند انتهائه — ثم
 * تُفكّ هنا.
 */
function useAuthedImage(mediaId: string | null, local = false): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(null);

  useEffect(() => {
    if (!mediaId) return;
    let alive = true;

    (async () => {
      // الملفّ المحليّ (معاينةٌ قبل الرفع) يُقرأ بعنوانه كما هو.
      const token = currentAccess();
      const response = local
        ? await fetch(mediaId)
        : await fetch(`${baseUrl}/v1/media/${mediaId}`, {
            headers: token ? { authorization: `Bearer ${token}` } : {},
          });
      if (!response.ok || !alive) return;

      const bytes = new Uint8Array(await response.arrayBuffer());
      const data = Skia.Data.fromBytes(bytes);
      const made = Skia.Image.MakeImageFromEncoded(data);
      if (alive) setImage(made);
    })().catch(() => {
      /* تبقى الصورة فارغةً ويُعرض البديل */
    });

    return () => {
      alive = false;
    };
  }, [mediaId, local]);

  return image;
}

/**
 * صورةٌ بفلتر.
 *
 * Skia يرسمها ويمرّر عليها مصفوفةَ الألوان — ترجمةُ سلسلة CSS التي
 * يطبّقها الويب، مفحوصةً على المتصفّح نفسه. وبلا فلترٍ لا يُستدعى Skia:
 * لوحةٌ لكل صورةٍ حملٌ بلا فائدة.
 */
export function Filtered({
  mediaId,
  filter,
  width,
  height,
  local = false,
}: {
  mediaId: string;
  filter: string | null | undefined;
  width: number;
  height: number;
  /** معاينةُ ملفٍّ على الجهاز قبل رفعه — لا معرّف له بعد. */
  local?: boolean;
}) {
  const image = useAuthedImage(filter ? mediaId : null, local);

  if (!filter) {
    return <MediaImage mediaId={mediaId} resizeMode="contain" style={{ width, height }} />;
  }

  return (
    <View style={{ width, height }}>
      <Canvas style={{ width, height }}>
        {image ? (
          <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="contain">
            <Paint>
              <ColorMatrix matrix={filterMatrix(filter)} />
            </Paint>
          </SkiaImage>
        ) : null}
      </Canvas>
    </View>
  );
}
