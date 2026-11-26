import { createHmac, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@athar/db";
import { getObject } from "@athar/storage";

/**
 * صورةُ التنبيه (القاعدة ٣٨٨): ما يُرى حين يُضغط التنبيهُ مطوّلاً أو يُسحب — صورةُ اللحظة أو
 * الرسالة أو الملصق. آبل وقوقل تجلبانها بلا جلسة، و`/v1/media` يشترط جلسةً ومن يرى (القاعدة
 * ٢٣ب)، فالرابطُ **موقَّعٌ بيدنا** لملفٍّ واحدٍ يومين: لا يُصنع لغير ما أرسلناه، ولا يُفتح بعد
 * مدّته. والصورةُ بمقاسها كما في اللحظة (١٢٨٠ على الأطول، القاعدة ٤١٣): التنبيهُ الموسَّع بعرض
 * الشاشة — نحو ١١٧٠ بكسلاً في آيفون — و٧٢٠ كانت تُمطّ فيه فتُرى مغبّشة.
 */
const PUSH_SIDE = 1280;
const TTL_SECONDS = 2 * 24 * 3600;

// السرُّ يُقرأ ساعةَ التوقيع لا عند التحميل: `env.ts` يتحقّق من البيئة كلّها ويُنهي العمليّة،
// و`push.ts` يستورد هذا الملفّ — فاستيرادُه كان يُسقط اختبارات الوضع الهادئ.
function sign(id: string, exp: number): string {
  return createHmac("sha256", process.env.JWT_ACCESS_SECRET ?? "").update(`push:${id}:${exp}`).digest("base64url").slice(0, 32);
}

/** الرابطُ العامّ الموقَّع — وبلا نطاقٍ مضبوط لا صورة (القاعدة ١٠٥). */
export function pushImageUrl(mediaId: string | null | undefined): string | null {
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!mediaId || !site || !process.env.JWT_ACCESS_SECRET) return null;
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `${site.replace(/\/$/, "")}/v1/push-media/${mediaId}?e=${exp}&s=${sign(mediaId, exp)}`;
}

export function pushImageValid(id: string, exp: number, signature: string): boolean {
  if (!process.env.JWT_ACCESS_SECRET || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const want = Buffer.from(sign(id, exp));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * بايتاتُ الصورة مصغّرةً ونوعُها — والمقطعُ والصوتُ لا صورةَ لهما.
 *
 * والشفّافةُ PNG بشفافيّتها — **بقرار المالك**: رسمُ إطارٍ أو تشارمٍ بلا صورة إعلان كان يُسطَّح
 * JPEG على أبيض فيصل التنبيهُ بمربّعٍ أبيض حول الرسم. وما لا شفافيّةَ فيه JPEG كما كان.
 */
export async function pushImageBytes(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const media = await prisma.media.findUnique({ where: { id }, select: { mime: true, key: true, bytes: true } });
  if (!media || !media.mime.startsWith("image/")) return null;
  let input: Uint8Array | null = null;
  if (media.key) {
    const answer = await getObject(media.key);
    if (!answer.ok) return null;
    input = new Uint8Array(await answer.arrayBuffer());
  } else if (media.bytes) input = media.bytes;
  if (!input) return null;
  const image = sharp(Buffer.from(input), { animated: false, limitInputPixels: 60_000_000 })
    .rotate()
    .resize(PUSH_SIDE, PUSH_SIDE, { fit: "inside", withoutEnlargement: true });
  const opaque = (await image.clone().stats()).isOpaque;
  if (!opaque) return { bytes: await image.png({ compressionLevel: 9 }).toBuffer(), mime: "image/png" };
  return {
    bytes: await image.flatten({ background: "#ffffff" }).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer(),
    mime: "image/jpeg",
  };
}
