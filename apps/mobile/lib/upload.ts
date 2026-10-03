import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api } from "./api";

/**
 * رفعُ ملفٍ في خطوتين — كما يشترطه الخادم.
 *
 * رابطٌ مؤقّت إلى الدلو، ثم رفعٌ مباشرٌ إليه، ثم اعتماد. والبايتات لا
 * تمرّ بخادمنا: ميغاباياتٌ لا تُنقل مرّتين، وجوّالٌ على شبكةٍ ضعيفة لا
 * ينتظر وسيطاً.
 */
export type Purpose = "AVATAR" | "COVER" | "MOMENT" | "STORY" | "MESSAGE" | "VOICE" | "SOUND";

/** أطولُ ضلعٍ يُرفع — وهو حدُّ الخادم نفسه (`MAX_SIDE` في `lib/process.ts`). */
const MAX_SIDE = 1600;

/**
 * الصورة تُصغَّر وتُضغط على الجهاز قبل أن تخرج.
 *
 * صورةُ آيفون حديث ٤٨ ميغابكسل وأربعةُ ميغابايت وأكثر، وحدُّ الصورة على
 * الخادم دون ذلك — فكان إرسالُ صورةٍ في المحادثة يُردّ بـ«الملف كبير»
 * وهي صورةٌ عاديّة من ألبومه. والخادم يصغّرها إلى ١٦٠٠ على كلّ حال،
 * فرفعُ ما فوق ذلك ميغاباياتٌ تُدفع من باقة صاحبها لتُرمى.
 *
 * **والمتحرّكة تُرفع كما هي**: التصغيرُ يرسم الإطار الأوّل وحده فيقتلها
 * (القاعدة ٨٢)، وحدُّها ٣٢٠×٣٢٠ أصلاً فلا تحتاجه.
 */
export async function shrink(
  uri: string,
  mime: string,
  size: { width: number; height: number },
): Promise<{ uri: string; mime: string; width: number; height: number }> {
  if (!mime.startsWith("image/") || mime === "image/gif" || mime === "image/webp") {
    return { uri, mime, ...size };
  }

  const context = ImageManipulator.manipulate(uri);
  const side = Math.max(size.width, size.height);
  // الأبعادُ مجهولةٌ (صفر) لا تُصغَّر: تحجيمٌ أعمى يكبّر الصغيرة. تُضغط وحدها.
  if (side > MAX_SIDE) {
    if (size.height > size.width) context.resize({ height: MAX_SIDE });
    else context.resize({ width: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const out = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return { uri: out.uri, mime: "image/jpeg", width: out.width, height: out.height };
}

export async function uploadFile(
  uri: string,
  mime: string,
  purpose: Purpose,
  size: { width: number; height: number } = { width: 0, height: 0 },
): Promise<string> {
  const ready = await shrink(uri, mime, size).catch(() => ({ uri, mime, ...size }));
  return (await send(ready.uri, ready.mime, purpose, { width: ready.width, height: ready.height })).mediaId;
}

/**
 * مصدرُ صوت القصّة (القاعدة ٢٣٨): مقطعٌ من الاستديو يُرفع فيسحب الخادمُ صوتَه
 * ويرمي صورتَه، ويردّ مدّتَه وموجتَه لشريط القصّ.
 */
export async function uploadSound(
  uri: string,
  mime: string,
): Promise<{ mediaId: string; seconds: number; peaks: number[] }> {
  const done = await send(uri, mime, "SOUND", { width: 0, height: 0 });
  return { mediaId: done.mediaId, seconds: done.commit.seconds ?? 0, peaks: done.commit.peaks ?? [] };
}

async function send(
  uri: string,
  mime: string,
  purpose: Purpose,
  size: { width: number; height: number },
): Promise<{ mediaId: string; commit: { seconds?: number; peaks?: number[] } }> {

  const blob = await (await fetch(uri)).blob();

  const ticket = await api<{ mediaId: string; url: string; headers: Record<string, string> }>(
    "/v1/media/presign",
    {
      method: "POST",
      body: JSON.stringify({
        mime,
        bytes: blob.size,
        width: Math.round(size.width),
        height: Math.round(size.height),
        purpose,
      }),
    },
  );

  const put = await fetch(ticket.url, {
    method: "PUT",
    headers: { ...ticket.headers, "content-type": mime },
    body: blob,
  });
  if (!put.ok) throw new Error("تعذّر رفع الملف");

  // الاعتماد يفحص البايتات: ما لم يُعتمد لا يُربط بلحظةٍ ولا يُقدَّم.
  const commit = await api<{ seconds?: number; peaks?: number[] }>(`/v1/media/${ticket.mediaId}/commit`, {
    method: "POST",
  });
  return { mediaId: ticket.mediaId, commit };
}
