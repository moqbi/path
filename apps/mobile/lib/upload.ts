import { File, UploadType } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api, baseUrl, currentAccess, renewAccess } from "./api";

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
 * الرسالةُ الصوتيّة إلى الخادم مباشرةً (القاعدة ٤٢٣): رحلةٌ واحدة بدل رابطٍ ورفعٍ إلى الدلو
 * واعتمادٍ يُنزّلها منه. وخادمٌ قديمٌ بلا البابِ (٤٠٤) يرجع إلى الطريق القديم.
 */
export async function uploadVoice(uri: string, mime: string): Promise<string> {
  if (!uri.startsWith("file://")) return uploadFile(uri, mime, "VOICE");
  const file = new File(uri);
  const attempt = () =>
    file.upload(`${baseUrl}/v1/media/voice`, {
      httpMethod: "POST",
      uploadType: UploadType.BINARY_CONTENT,
      headers: {
        "content-type": mime,
        ...(currentAccess() ? { authorization: `Bearer ${currentAccess()}` } : {}),
      },
    });
  let done = await attempt().catch(() => null);
  if (done?.status === 401 && (await renewAccess())) done = await attempt().catch(() => null);
  if (!done) throw new Error("تعذّر رفع الملف");
  if (done.status === 404 || done.status === 405) return uploadFile(uri, mime, "VOICE");
  const data = (() => {
    try {
      return JSON.parse(done.body) as { id?: string; error?: string };
    } catch {
      return {} as { id?: string; error?: string };
    }
  })();
  if (done.status < 200 || done.status >= 300 || !data.id) throw new Error(data.error ?? "تعذّر رفع الملف");
  return data.id;
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

/**
 * مقطعُ القصّة (القاعدة ٢٤٩): يُرفع كما صُوِّر بلا تصغير، ومعه `start` — من أين
 * تبدأ ثلاثون ثانيته — فيقصّه الخادمُ ويضغطه، ويردّ مدّتَه بعد القصّ.
 */
export async function uploadStoryVideo(
  uri: string,
  mime: string,
  start: number,
  size: { width: number; height: number },
  /** فلترُ المقطع يُطبع فيه على الخادم (القاعدة ٤٠٧). */
  look?: { matrix: number[]; vignette?: number },
  /** طولُ ما اختير بالمقبضين (القاعدة ٤٠٨) — بلاه يقصّ الخادمُ حدَّه كاملاً. */
  length?: number,
): Promise<{ mediaId: string; seconds: number }> {
  const done = await send(uri, mime, "STORY", size, { start, ...(look ? { look } : {}), ...(length ? { length } : {}) });
  return { mediaId: done.mediaId, seconds: done.commit.seconds ?? 0 };
}

async function send(
  uri: string,
  mime: string,
  purpose: Purpose,
  size: { width: number; height: number },
  extra?: { start: number; length?: number; look?: { matrix: number[]; vignette?: number } },
): Promise<{ mediaId: string; commit: { seconds?: number; peaks?: number[] } }> {

  /*
    الملفُّ على الجهاز يُقرأ ويُرفع بـ`expo-file-system` (القاعدة ٤٠١) لا بـ`fetch(file://).blob()`:
    منذ React Native 0.88 صار الرفعُ بالأخيرة يُرسل ما لا يُقرأ — فكانت الرسالةُ الصوتيّة تُسمع في
    المعاينة ويردّها الخادمُ «تعذّرت قراءة المقطع». والرفعُ الأصليّ يدفق الملفَّ كما هو.
  */
  const local = uri.startsWith("file://") ? new File(uri) : null;
  const blob = local ? null : await (await fetch(uri)).blob();
  const bytes = local ? local.size : blob!.size;

  const ticket = await api<{ mediaId: string; url: string; headers: Record<string, string> }>(
    "/v1/media/presign",
    {
      method: "POST",
      body: JSON.stringify({
        mime,
        bytes,
        width: Math.round(size.width),
        height: Math.round(size.height),
        purpose,
      }),
    },
  );

  const headers = { ...ticket.headers, "content-type": mime };
  const ok = local
    ? await local
        .upload(ticket.url, { httpMethod: "PUT", uploadType: UploadType.BINARY_CONTENT, headers })
        .then((done) => done.status >= 200 && done.status < 300)
        .catch(() => false)
    : (await fetch(ticket.url, { method: "PUT", headers, body: blob })).ok;
  if (!ok) throw new Error("تعذّر رفع الملف");

  // الاعتماد يفحص البايتات: ما لم يُعتمد لا يُربط بلحظةٍ ولا يُقدَّم.
  const commit = await api<{ seconds?: number; peaks?: number[] }>(`/v1/media/${ticket.mediaId}/commit`, {
    method: "POST",
    ...(extra ? { body: JSON.stringify(extra) } : {}),
  });
  return { mediaId: ticket.mediaId, commit };
}
