import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { ClipOp, PaintStyle, Skia } from "@shopify/react-native-skia";
import { baseUrl, currentAccess } from "./api";
import { colors } from "../theme/tokens";

/**
 * صورةُ العرض في تبويب «أنا» على شريط آبل (القاعدة ٢٦١).
 *
 * الشريطُ الأصليّ لا يأخذ مكوّناً بل صورةً يحمّلها هو، فلا ترويسة توكن يحملها
 * طلبُه ولا قصَّ دائرة. فتُجلب البايتاتُ بالتوكن هنا، وتُقصّ دائرةً بـSkia،
 * وتُعطى للشريط `data:` جاهزة — والمفتوحةُ بحلقةٍ بلون الثيم حولها.
 * و`original` يقول للشريط (برقعةٍ في `patches/expo-router`) أن يرسمها بألوانها
 * لا قالباً بلونٍ واحد كبقيّة الأيقونات.
 */
const SIDE = 28;
const SCALE = 3;

type Src = { uri: string; width: number; height: number; scale: number; original: true };
export type TabAvatar = { default: Src; selected: Src } | null;

const cache = new Map<string, TabAvatar>();

async function build(mediaId: string): Promise<TabAvatar> {
  const token = currentAccess();
  const response = await fetch(`${baseUrl}/v1/media/${mediaId}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) return null;

  const px = SIDE * SCALE;
  const draw = (ring: boolean): Src | null => {
    const surface = Skia.Surface.MakeOffscreen(px, px);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    const ringWidth = ring ? 2.2 * SCALE : 0;
    const inset = ring ? ringWidth + 1.2 * SCALE : 0;
    const face = Skia.XYWHRect(inset, inset, px - inset * 2, px - inset * 2);

    // الوجهُ يملأ دائرتَه من وسطه (cover).
    const w = image.width();
    const h = image.height();
    const side = Math.min(w, h);
    const src = Skia.XYWHRect((w - side) / 2, (h - side) / 2, side, side);
    canvas.save();
    canvas.clipRRect(Skia.RRectXY(face, face.width / 2, face.height / 2), ClipOp.Intersect, true);
    canvas.drawImageRect(image, src, face, Skia.Paint());
    canvas.restore();

    if (ring) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(ringWidth);
      paint.setColor(Skia.Color(colors.clay));
      canvas.drawCircle(px / 2, px / 2, px / 2 - ringWidth / 2, paint);
    }
    surface.flush();
    const base64 = surface.makeImageSnapshot().encodeToBase64();
    return { uri: `data:image/png;base64,${base64}`, width: SIDE, height: SIDE, scale: SCALE, original: true };
  };

  const plain = draw(false);
  const ringed = draw(true);
  return plain && ringed ? { default: plain, selected: ringed } : null;
}

export function useTabAvatar(mediaId: string | null | undefined): TabAvatar {
  const key = mediaId ? `${mediaId}:${colors.clay}` : "";
  const [value, setValue] = useState<TabAvatar>(() => (key ? (cache.get(key) ?? null) : null));

  useEffect(() => {
    if (Platform.OS !== "ios" || !mediaId) {
      setValue(null);
      return;
    }
    const known = cache.get(key);
    if (known) {
      setValue(known);
      return;
    }
    let alive = true;
    build(mediaId)
      .then((made) => {
        if (made) cache.set(key, made);
        if (alive) setValue(made);
      })
      // صورةٌ لم تُرسم تُبقي الأيقونة الافتراضيّة، ولا تُسقط الشريط.
      .catch(() => alive && setValue(null));
    return () => {
      alive = false;
    };
  }, [key, mediaId]);

  return value;
}
