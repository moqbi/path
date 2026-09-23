import { randomUUID } from "node:crypto";
import { prisma } from "@athar/db";
import {
  ANIMATED_SIDE,
  LIMITS,
  MIME,
  STORY_SECONDS,
  VOICE_SECONDS,
  type PresignInput,
} from "@athar/shared";
import { cloudReady, deleteObjects, getObject, headObject, presignUrl, putObject } from "@athar/storage";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { NoProbe, measure, probeClip, processImage } from "../lib/process";

/**
 * الرفع في خطوتين: رابطٌ مؤقّت ثم اعتماد.
 *
 * الجهاز يرفع إلى الدلو مباشرةً بالرابط، فلا تمرّ الميغابايتات بخادمنا
 * مرّتين. لكنّ الرابط يقول «لهذا المفتاح ولهذه المدّة» ولا يقول «هذا
 * الملفّ بعينه»، فما وصل يُفحص بعده: الحجم من الدلو لا من كلام العميل،
 * والنوع من بايتات الملف لا من امتداده ولا من ترويسته.
 *
 * وما لم يُعتمد لا يُقدَّم ولا يُربط بلحظةٍ ولا برسالة.
 */

/** ما يُقبل لكل غرض: الصيغ والحدّ. */
type Rule = { mimes: readonly string[]; max: number };

const RULES: Record<PresignInput["purpose"], Rule> = {
  AVATAR: { mimes: [...MIME.image, ...MIME.animated], max: LIMITS.animated },
  COVER: { mimes: MIME.image, max: LIMITS.image },
  MOMENT: { mimes: MIME.image, max: LIMITS.image },
  STORY: { mimes: [...MIME.image, ...MIME.video], max: LIMITS.video },
  MESSAGE: { mimes: MIME.image, max: LIMITS.image },
  VOICE: { mimes: MIME.audio, max: LIMITS.audio },
};

/** امتدادٌ يُشتقّ من النوع — ليُقرأ المفتاح في لوحة السحابة. */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "weba",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/** `audio/webm;codecs=opus` ← `audio/webm`. */
export const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/** الرابط يعيش خمس دقائق: تكفي لرفعٍ على شبكةٍ بطيئة ولا تكفي لتسريبه. */
const LINK_SECONDS = 300;

/**
 * يُعطي رابطاً مؤقّتاً ويحجز صفّاً غير معتمد.
 *
 * الحدّ يُفحص هنا على ما *أعلنه* العميل كي يُردّ الرفع قبل أن يبدأ، ثم
 * يُفحص ثانيةً على ما وصل فعلاً — الأول أدبٌ مع المستخدم، والثاني أمن.
 */
export async function presign(userId: string, input: PresignInput) {
  if (!cloudReady()) throw badRequest("تخزين الملفات غير مضبوط");

  const rule = RULES[input.purpose];
  const mime = baseMime(input.mime);
  if (!rule.mimes.includes(mime)) throw badRequest("صيغة غير مدعومة");
  if (input.bytes > rule.max) throw badRequest("الملف كبير");

  // الصورة المتحركة ميزة اشتراك، وصورة العرض وحدها تقبلها.
  if ((MIME.animated as readonly string[]).includes(mime) && input.purpose !== "AVATAR") {
    if (mime === "image/gif") throw badRequest("يُقبل JPEG أو PNG أو WebP فقط");
  }

  const key = `${userId}/${randomUUID()}.${EXT[mime] ?? "bin"}`;
  const media = await prisma.media.create({
    data: {
      ownerId: userId,
      mime,
      key,
      width: input.width,
      height: input.height,
      ready: false,
      purpose: input.purpose,
    },
    select: { id: true },
  });

  const link = presignUrl({
    method: "PUT",
    objectKey: key,
    expiresIn: LINK_SECONDS,
    contentType: mime,
  });

  return {
    mediaId: media.id,
    url: link.url,
    headers: link.headers,
    expiresAt: link.expiresAt,
  };
}

/**
 * بصمات الصيغ.
 *
 * الامتداد يُكتب والترويسة تُرسل، وكلاهما من العميل. أول بايتات الملف
 * وحدها تقول ما هو حقاً — وبها يُردّ ملفٌّ تنفيذيّ سُمّي `.jpg`.
 */
function sniff(head: Uint8Array): string | null {
  const at = (offset: number, ...bytes: number[]) =>
    bytes.every((byte, index) => head[offset + index] === byte);
  const ascii = (offset: number, text: string) =>
    [...text].every((char, index) => head[offset + index] === char.charCodeAt(0));

  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (ascii(0, "GIF8")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp")) {
    // MP4/MOV/M4A يشتركون في الحاوية ويفترقون بالعلامة.
    const brand = String.fromCharCode(...head.subarray(8, 12));
    if (brand.startsWith("qt")) return "video/quicktime";
    if (brand.startsWith("M4A")) return "audio/mp4";
    return "video/mp4";
  }
  // Matroska/WebM حاويةٌ واحدة للصوت والفيديو: التفريق يأتي من الغرض.
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "video/webm";
  if (ascii(0, "OggS")) return "audio/ogg";
  if (at(0, 0xff, 0xfb) || at(0, 0xff, 0xf3) || ascii(0, "ID3")) return "audio/mpeg";
  return null;
}

/**
 * أمتحرّكةٌ هي؟ يُقرأ من الملف لا من امتداده.
 *
 * GIF متحرّكة إن سبقت أكثرَ من إطارٍ كتلةُ «التحكّم بالرسم»، وWebP
 * متحرّكة إن حملت كتلة `ANIM`. والفحص على الخادم لأن الميزة مدفوعة.
 */
export function isAnimated(mime: string, bytes: Uint8Array): boolean {
  if (mime === "image/gif") {
    let frames = 0;
    for (let i = 0; i < bytes.length - 2 && frames < 2; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) frames++;
    }
    return frames >= 2;
  }
  if (mime === "image/webp") return Buffer.from(bytes.subarray(0, 64)).includes("ANIM");
  return false;
}

/**
 * يُسقط الصفّ وكائنه معاً حين يُرفض ما رُفع، ويردّ الخطأ ليُرمى.
 *
 * يردّ ولا يرمي كي يُكتب `throw await reject(…)`: الرمي داخل دالةٍ
 * غير متزامنة لا يُخبر المدقّق أنّ ما بعده لا يُبلَغ.
 */
async function reject(mediaId: string, key: string | null, message: string) {
  await prisma.media.deleteMany({ where: { id: mediaId } });
  if (key) await deleteObjects([key]);
  return badRequest(message);
}

/**
 * يعتمد ما رُفع بعد فحصه.
 *
 * الحجم من الدلو، والنوع من البايتات، والحركة من الإطارات. وما يُرفض
 * يذهب هو وكائنه في اللحظة نفسها: ملفٌّ مرفوضٌ يبقى في الدلو هو ملفٌّ
 * لا يعرف أحدٌ أنّه هناك.
 */
export async function commit(userId: string, mediaId: string) {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, ownerId: true, key: true, mime: true, purpose: true, ready: true },
  });
  if (!media || media.ownerId !== userId) throw notFound("الملف غير موجود");
  if (media.ready) return { id: media.id, mime: media.mime };
  if (!media.key) throw badRequest("هذا الملف لا يُعتمد");

  const purpose = (media.purpose ?? "MOMENT") as PresignInput["purpose"];
  const rule = RULES[purpose];

  const head = await headObject(media.key);
  if (!head) throw badRequest("لم يصل الملف");
  if (head.bytes === 0) throw await reject(media.id, media.key, "الملف فارغ");
  if (head.bytes > rule.max) throw await reject(media.id, media.key, "الملف كبير");

  // يُنزَّل كاملاً: البصمة من أوّله، والمعالجة والمدّة من كلّه. والحدّ
  // فُحص قبل التنزيل، فلا يُجرّ إلى الذاكرة ما يتجاوزه.
  const response = await getObject(media.key);
  if (!response.ok) throw await reject(media.id, media.key, "لم يصل الملف");
  const bytes = new Uint8Array(await response.arrayBuffer());

  const real = sniff(bytes);
  if (!real) throw await reject(media.id, media.key, "صيغة غير مدعومة");

  /*
    حاوياتٌ تحمل الصوت والفيديو معاً فلا تقول بصمتُها أيّهما فيها:
    WebM، وMP4 — فأندرويد يكتب تسجيله `.m4a` بعلامة `isom` لا `M4A `،
    فيُقرأ فيديو ويُردّ «صيغة غير مدعومة» وهو صوتٌ سليم. والغرض يفصل
    بينهما: بابُ الصوت لا يُرفع إليه إلا صوت.
  */
  const container = real === "video/webm" || real === "video/mp4";
  const actual =
    container && purpose === "VOICE"
      ? real === "video/webm"
        ? "audio/webm"
        : "audio/mp4"
      : real === "video/webm" && rule.mimes.includes("audio/webm")
        ? media.mime
        : (real as string);
  if (!rule.mimes.includes(actual)) throw await reject(media.id, media.key, "صيغة غير مدعومة");

  const moving = isAnimated(actual, bytes);
  if (moving) {
    if (purpose !== "AVATAR") throw await reject(media.id, media.key, "الصورة المتحركة لصورة العرض فقط");
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlus: true },
    });
    if (!owner?.isPlus) {
      await prisma.media.deleteMany({ where: { id: media.id } });
      await deleteObjects([media.key]);
      throw forbidden("الصورة المتحركة لمشتركي آثار+");
    }
  } else if (actual === "image/gif") {
    throw await reject(media.id, media.key, "يُقبل JPEG أو PNG أو WebP فقط");
  }

  const shaped = await shape(media.id, media.key, actual, purpose, moving, bytes);

  const ready = await prisma.media.update({
    where: { id: media.id },
    data: { ready: true, mime: shaped.mime, width: shaped.width, height: shaped.height },
    select: { id: true, mime: true, width: true, height: true },
  });
  return { ...ready, seconds: shaped.seconds };
}

/**
 * يعالج ما وصل ويكتب الناتج مكان الأصل.
 *
 * الصورة الثابتة تُعاد كتابتها منزوعةَ البيانات الوصفية — وهذا هو
 * المقصود: إحداثيات الالتقاط لا تخرج مع صورةٍ نشرها من أطفأ موقعه.
 * والمتحركة تُترك كما هي ويُقرأ مقاسها وحده. والمقطع يُقاس زمنه.
 */
async function shape(
  mediaId: string,
  key: string,
  mime: string,
  purpose: PresignInput["purpose"],
  moving: boolean,
  bytes: Uint8Array,
): Promise<{ mime: string; width: number; height: number; seconds?: number }> {
  const isImage = mime.startsWith("image/");

  if (isImage && !moving) {
    try {
      const out = await processImage(bytes, mime);
      // المفتاح يحمل امتداد الأصل؛ والنوع يُقدَّم من الصفّ لا من الامتداد.
      await putObject(key, out.bytes, out.mime);
      return { mime: out.mime, width: out.width, height: out.height };
    } catch {
      throw await reject(mediaId, key, "تعذّرت قراءة الصورة");
    }
  }

  if (isImage) {
    let size: { width: number; height: number };
    try {
      size = await measure(bytes);
    } catch {
      throw await reject(mediaId, key, "تعذّرت قراءة الصورة");
    }

    /*
      والمقاس يُفحص هنا لا في الشاشة وحدها: المتحركة تُرفع بملفها بلا
      تصغير، فما يُقبل هو ما يُفكّ في ذاكرة كلّ جهازٍ يعرضه. ولم يكن
      على الخادم فحصٌ أصلاً — الشاشة وحدها كانت تمنع.
    */
    const side = Math.max(size.width, size.height);
    if (side > ANIMATED_SIDE.max) {
      throw await reject(mediaId, key, `مقاس الصورة المتحركة أكبر من ٣٢٠×٣٢٠`);
    }
    if (Math.min(size.width, size.height) < ANIMATED_SIDE.min) {
      throw await reject(mediaId, key, `مقاس الصورة المتحركة أقلّ من ١٢٠×١٢٠`);
    }

    return { mime, ...size };
  }

  /*
    وخادمٌ بلا ffprobe لا يردّ تسجيلاً سليماً: المقطع الصوتيّ يُقبل
    بحدّ بايتاته (`LIMITS.audio`)، ومدّتُه تُفحص مرّةً أخرى عند
    الإرسال (`VOICE_SECONDS`). أمّا الفيديو فلا مخرج له: مدّتُه شرطٌ
    لا يقوم مقامه حجم.
  */
  const clip = await probeClip(bytes, EXT[mime] ?? "bin").catch((problem: unknown) => {
    if (problem instanceof NoProbe) {
      console.error("[media] ffprobe مفقود — المقطع يمرّ بحدّ حجمه وحده");
      return mime.startsWith("audio/") ? ({ seconds: 0, width: 0, height: 0 } as const) : null;
    }
    return null;
  });
  if (!clip) throw await reject(mediaId, key, "تعذّرت قراءة المقطع");
  if (clip.seconds <= 0 && !mime.startsWith("audio/")) {
    throw await reject(mediaId, key, "تعذّرت قراءة المقطع");
  }

  // القصّة عشرون ثانية، والرسالة الصوتية عشرون — ومئةٌ وعشرون لمشتركي
  // آثار+. الحدّ الأعلى هنا، والتمييز بينهما عند الإرسال حيث يُعرف المشترك.
  const cap = purpose === "STORY" ? STORY_SECONDS : VOICE_SECONDS.plus;
  if (clip.seconds > cap) {
    throw await reject(mediaId, key, purpose === "STORY" ? "المقطع أطول من ٢٠ ثانية" : "التسجيل طويل");
  }

  return { mime, width: clip.width, height: clip.height, seconds: clip.seconds };
}

/**
 * يكنس ما لم يُعتمد.
 *
 * كل رابطٍ يُعطى ولا يُستعمل يترك صفّاً معلّقاً. بعد ساعةٍ لا أمل في
 * رفعٍ بدأ برابطٍ عمره خمس دقائق.
 */
export async function sweepPending(): Promise<number> {
  const stale = await prisma.media.findMany({
    where: { ready: false, createdAt: { lt: new Date(Date.now() - 3600_000) } },
    select: { id: true, key: true },
    take: 200,
  });
  if (stale.length === 0) return 0;

  await prisma.media.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  await deleteObjects(stale.map((row) => row.key).filter((key): key is string => !!key));
  return stale.length;
}
