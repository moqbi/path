import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
  Canvas, ColorMatrix, Group, Image as SkiaImage, RadialGradient, Rect, Skia, useVideo, vec, type SkImage,
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
  cover = false,
}: {
  mediaId: string;
  filter: string | null | undefined;
  width: number;
  height: number;
  /** معاينةُ ملفٍّ على الجهاز قبل رفعه — لا معرّف له بعد. */
  local?: boolean;
  /** يملأ اللوحة ويقصّ ما زاد — القصّةُ بملء الشاشة (القاعدة ٢٩٦). */
  cover?: boolean;
}) {
  const image = useAuthedImage(filter ? mediaId : null, local);

  if (!filter) {
    return <MediaImage mediaId={mediaId} resizeMode={cover ? "cover" : "contain"} style={{ width, height }} />;
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
          <SkiaImage image={image} x={0} y={0} width={width} height={height} fit={cover ? "cover" : "contain"}>
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
 * مقطعٌ بفلتر — معاينةُ المحرّر قبل النشر (القاعدة ٤٠٧).
 *
 * مشغّلُ النظام لا يمرّ بـSkia، فالمقطعُ هنا يُفكّ بـ`useVideo` ويُرسم إطاراً إطاراً بمصفوفة
 * الفلتر نفسها، وصوتُه معه. والخادمُ يطبع الفلترَ نفسه في المقطع عند الضغط، فما يُرى هنا ما
 * يراه المشاهدون. ومقطعُ الآيفون الطوليّ تُكتب إطاراتُه عرضيّةً بزاويةٍ في الملفّ — فتُدار.
 */
export function FilteredVideo({
  uri,
  filter,
  width,
  height,
  muted = false,
  paused = false,
}: {
  uri: string;
  filter: string;
  width: number;
  height: number;
  muted?: boolean;
  paused?: boolean;
}) {
  const { currentFrame, rotation } = useVideo(uri, { looping: true, paused, volume: muted ? 0 : 1 });
  const look = filterOf(filter);
  const turned = rotation === 90 || rotation === 270;
  const w = turned ? height : width;
  const h = turned ? width : height;
  return (
    <View pointerEvents="none" style={{ width, height }}>
      <Canvas style={{ width, height }}>
        <Group
          transform={[
            { translateX: width / 2 },
            { translateY: height / 2 },
            { rotate: (rotation * Math.PI) / 180 },
            { translateX: -w / 2 },
            { translateY: -h / 2 },
          ]}
        >
          <SkiaImage image={currentFrame} x={0} y={0} width={w} height={h} fit="cover">
            <ColorMatrix matrix={look.matrix} />
          </SkiaImage>
        </Group>
        <Vignette amount={look.vignette} width={width} height={height} />
      </Canvas>
    </View>
  );
}

/**
 * إطارٌ من المقطع لأقراص شريط الفلاتر: يُشغَّل صامتاً حتى يصل إطار، ثمّ يُنسخ ويُترك المقطع.
 * والزاويةُ معه — إطارُ المقطع الطوليّ عرضيٌّ في ملفّه.
 */
export function useVideoStill(uri: string | null): { image: SkImage; rotation: number } | null {
  const [still, setStill] = useState<{ image: SkImage; rotation: number } | null>(null);
  useEffect(() => {
    if (!uri) return;
    let alive = true;
    (async () => {
      const video = await Skia.Video(uri);
      try {
        video.setVolume(0);
        video.seek(Math.min(500, Math.max(0, video.duration() / 2)));
        video.play();
        for (let i = 0; i < 40 && alive; i++) {
          const frame = video.nextImage();
          if (frame) {
            const copy = frame.makeNonTextureImage() ?? frame;
            if (alive) setStill({ image: copy, rotation: video.rotation() });
            return;
          }
          await new Promise((done) => setTimeout(done, 60));
        }
      } finally {
        video.pause();
        video.dispose?.();
      }
    })().catch(() => {
      /* بلا إطارٍ تبقى الأقراصُ داكنة والفلاترُ تُختار بأسمائها */
    });
    return () => {
      alive = false;
    };
  }, [uri]);
  return still;
}

/**
 * شريطُ الفلاتر بمعاينتها — **الصورةُ نفسها في كلّ قرص** لا أسماءٌ تُخمَّن
 * (القاعدة ٩٦). تُفكّ مرّةً وتُرسم صغيرةً بكلّ فلتر.
 */
export function FilterStrip({
  uri,
  value,
  onChange,
  video = false,
}: {
  uri: string;
  value: string;
  onChange: (key: string) => void;
  /** المقطعُ يُرسم من إطارٍ فيه لا من ملفّه (القاعدة ٤٠٧). */
  video?: boolean;
}) {
  const photo = useAuthedImage(video ? null : uri, true);
  const still = useVideoStill(video ? uri : null);
  const image = video ? (still?.image ?? null) : photo;
  const turn = video ? (still?.rotation ?? 0) : 0;
  const W = 62;
  const H = 82;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
      {FILTERS.map((item) => {
        const on = value === item.key;
        return (
          <Pressable key={item.key || "none"} accessibilityLabel={`فلتر ${item.name}`} onPress={() => onChange(item.key)} style={{ alignItems: "center", gap: 5 }}>
            {/*
              اللوحةُ لا تأخذ اللمسة: لوحةُ Skia على آبل تبتلعها، فلا يصل الضغطُ إلى
              الزرّ تحتها — وكانت الفلاترُ تُرى ولا تُختار.
            */}
            <View
              pointerEvents="none"
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
                    <Group
                      transform={[
                        { translateX: W / 2 },
                        { translateY: H / 2 },
                        { rotate: (turn * Math.PI) / 180 },
                        { translateX: -(turn % 180 ? H : W) / 2 },
                        { translateY: -(turn % 180 ? W : H) / 2 },
                      ]}
                    >
                      <SkiaImage image={image} x={0} y={0} width={turn % 180 ? H : W} height={turn % 180 ? W : H} fit="cover">
                        <ColorMatrix matrix={item.matrix} />
                      </SkiaImage>
                    </Group>
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
