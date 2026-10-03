import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
  Canvas, ColorMatrix, Image as SkiaImage, RadialGradient, Rect, Skia, vec, type SkImage,
} from "@shopify/react-native-skia";
import { Text } from "./type";
import { baseUrl, currentAccess } from "../lib/api";
import { FILTERS, filterOf } from "../lib/filters";
import { MediaImage } from "./media-image";
import { colors } from "../theme/tokens";

/**
 * صورةٌ من الخادم كما يقرؤها Skia.
 *
 * `useImage` يأخذ عنواناً ولا يأخذ ترويسة، وملفاتُنا خلف التوكن. فتُجلب
 * البايتات بالباب المعتاد — وهو الذي يجدّد التوكن عند انتهائه — ثم
 * تُفكّ هنا.
 */
/*
  صورٌ مفكوكةٌ سلفاً: القصّةُ تُجلب قبل أن تُفتح (`lib/story-prefetch.ts`)، فإذا
  فُتحت وجدت صورتها هنا. قليلةٌ وتُفرَّغ بالأقدم — صورةُ شاشةٍ كاملة في الذاكرة.
*/
const warm = new Map<string, Promise<SkImage | null>>();
const WARM_MAX = 6;

async function loadRemote(mediaId: string): Promise<SkImage | null> {
  const token = currentAccess();
  const response = await fetch(`${baseUrl}/v1/media/${mediaId}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
}

export function warmSkia(mediaId: string): Promise<SkImage | null> {
  const known = warm.get(mediaId);
  if (known) return known;
  const loading = loadRemote(mediaId).catch(() => null);
  warm.set(mediaId, loading);
  // فشلٌ لا يُحفظ: الفتحُ يحاول من جديد.
  void loading.then((image) => {
    if (!image) warm.delete(mediaId);
  });
  if (warm.size > WARM_MAX) warm.delete(warm.keys().next().value!);
  return loading;
}

function useAuthedImage(mediaId: string | null, local = false): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(null);

  useEffect(() => {
    if (!mediaId) return;
    let alive = true;

    (async () => {
      /*
        الملفّ على الجهاز يُقرأ بـ`Data.fromURI` لا بـ`fetch`: عنوان
        `file://` ليس طلبَ شبكةٍ، و`fetch` عليه يردّ فارغاً في آبل —
        فتبقى اللوحة بلا صورة ويُقرأ ذلك «الفلتر لا يعمل».
      */
      if (local) {
        const data = await Skia.Data.fromURI(mediaId);
        const made = Skia.Image.MakeImageFromEncoded(data);
        if (alive) setImage(made);
        return;
      }

      const made = await warmSkia(mediaId);
      if (alive && made) setImage(made);
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
        {/*
          والمصفوفة **ابنةُ الصورة مباشرةً** لا داخل `<Paint>`: الأخيرة
          طبقةُ رسمٍ ثانية تُضاف إلى الأولى، فتُرسم الصورة مرّتين —
          مفلترةً وغيرَ مفلترة فوقها — فلا يُرى أثرُ الفلتر أصلاً.
        */}
        {image ? (
          <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="contain">
            <ColorMatrix matrix={filterOf(filter).matrix} />
          </SkiaImage>
        ) : null}
        {image ? <Vignette amount={filterOf(filter).vignette} width={width} height={height} /> : null}
      </Canvas>
    </View>
  );
}

/** إعتامُ الأطراف — تدرّجٌ دائريٌّ فوق الصورة، كالذي في الويب. */
function Vignette({ amount, width, height }: { amount?: number; width: number; height: number }) {
  if (!amount) return null;
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <RadialGradient
        c={vec(width / 2, height / 2)}
        r={Math.hypot(width, height) / 2}
        colors={["rgba(0,0,0,0)", `rgba(0,0,0,${amount})`]}
        positions={[0.5, 1]}
      />
    </Rect>
  );
}

/**
 * شريطُ الفلاتر بمعاينتها — **الصورةُ نفسها في كلّ قرص** لا أسماءٌ تُخمَّن
 * (القاعدة ٩٦). تُفكّ مرّةً وتُرسم صغيرةً بكلّ فلتر.
 */
export function FilterStrip({
  uri,
  value,
  onChange,
}: {
  uri: string;
  value: string;
  onChange: (key: string) => void;
}) {
  const image = useAuthedImage(uri, true);
  const W = 62;
  const H = 82;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
      {FILTERS.map((item) => {
        const on = value === item.key;
        return (
          <Pressable key={item.key || "none"} accessibilityLabel={`فلتر ${item.name}`} onPress={() => onChange(item.key)} style={{ alignItems: "center", gap: 5 }}>
            <View
              style={{
                width: W + 6,
                height: H + 6,
                borderRadius: 14,
                padding: 3,
                borderWidth: 2,
                borderColor: on ? colors.clay : "transparent",
              }}
            >
              <View style={{ width: W, height: H, borderRadius: 10, overflow: "hidden", backgroundColor: "#0b1219" }}>
                {image ? (
                  <Canvas style={{ width: W, height: H }}>
                    <SkiaImage image={image} x={0} y={0} width={W} height={H} fit="cover">
                      <ColorMatrix matrix={item.matrix} />
                    </SkiaImage>
                    <Vignette amount={item.vignette} width={W} height={H} />
                  </Canvas>
                ) : null}
              </View>
            </View>
            <Text style={{ fontSize: 11.5, fontWeight: on ? "800" : "500", color: on ? colors.clayInk : colors.muted }}>{item.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
