import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@athar/db";
import { cloudReady, getObject, putObject } from "@athar/storage";
import { dropMedia } from "./media";
import { baseMime, isAnimated } from "./upload";

/**
 * انتهاءُ آثار+ — كلُّ ما يخصّه ينتهي معه.
 *
 * كان الانتهاءُ يُطفئ `isPlus` وحده، فيبقى ما لبسه صاحبُه من أصناف
 * المشتركين عليه، وتبقى صورتُه المتحرّكة تتحرّك — والحركةُ ميزةٌ مدفوعة
 * (القاعدة ٨٢). فهنا يُنهى كلُّ شيءٍ في مكانٍ واحد:
 *
 * - الصورةُ المتحرّكة تصير **صورةً ثابتة JPEG** من إطارها الأوّل —
 *   بقرار المالك — لا تُحذف: وجهُ صاحبها يبقى، وتقف حركتُه.
 * - ما لبسه من أصنافٍ لمشتركي آثار+ وحدهم يُنزع، ويبقى في إكسسواراته
 *   يلبسه إن عاد (ما دُفع ثمنه لا يُسحب).
 * - وختمُ الرصيد يُنسى فيبدأ عند عودته دورةً جديدة (القاعدة ٧٣ب).
 * - و`plusEndedAt` يُكتب: منه تعرض الشاشة «انتهى اشتراكك» ومعها التجديد.
 *
 * ويُنادى من كلّ بابٍ ينتهي منه الاشتراك: حدثُ RevenueCat، والنقلُ إلى
 * حسابٍ آخر، والإيقافُ من اللوحة، والكنسُ الدوريّ لمن تجاوز `plusUntil`
 * — ومن `profile()` نفسها، فيرى صاحبُه ذلك أوّل ما يفتح التطبيق لا بعد
 * الكنس التالي. وتكرارُه لا يضرّ.
 */
export async function endPlus(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatarMediaId: true,
      frame: { select: { plusOnly: true } },
      charm: { select: { plusOnly: true } },
      background: { select: { plusOnly: true } },
    },
  });
  if (!user) return;

  // الفشلُ في تثبيت الصورة لا يُبقي الاشتراك قائماً: يُكتب السطر ويمضي.
  const still = user.avatarMediaId
    ? await freeze(userId, user.avatarMediaId).catch((error) => {
        console.error("✗ تثبيت الصورة المتحرّكة", error);
        return null;
      })
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPlus: false,
      plusCreditAt: null,
      plusEndedAt: new Date(),
      ...(user.frame?.plusOnly ? { frameId: null } : null),
      ...(user.charm?.plusOnly ? { charmId: null } : null),
      ...(user.background?.plusOnly ? { backgroundId: null } : null),
      ...(still ? { avatarMediaId: still } : null),
    },
  });

  if (still && user.avatarMediaId) await dropMedia([user.avatarMediaId]);
}

/**
 * الإطارُ الأوّل من صورةٍ متحرّكة، JPEG — أو `null` إن لم تكن متحرّكة.
 *
 * `sharp` بلا `animated` يقرأ الصفحة الأولى وحدها، فلا حاجة إلى ffmpeg.
 * والخلفيةُ الشفّافة تُسطَّح على أبيض: JPEG لا يحمل شفافية، وبلا تسطيحٍ
 * تخرج سوداء.
 */
async function freeze(ownerId: string, mediaId: string): Promise<string | null> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { mime: true, key: true, bytes: true },
  });
  if (!media) return null;
  const mime = baseMime(media.mime);
  if (mime !== "image/gif" && mime !== "image/webp") return null;

  let bytes: Uint8Array | null = null;
  if (media.key) {
    if (!cloudReady()) return null;
    const answer = await getObject(media.key);
    if (!answer.ok) return null;
    bytes = new Uint8Array(await answer.arrayBuffer());
  } else if (media.bytes) {
    bytes = new Uint8Array(media.bytes);
  }
  if (!bytes || !isAnimated(mime, bytes)) return null;

  const out = await sharp(Buffer.from(bytes))
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
  const data = new Uint8Array(out.data);

  if (cloudReady()) {
    const key = `${ownerId}/${randomUUID()}.jpg`;
    await putObject(key, data, "image/jpeg");
    const row = await prisma.media.create({
      data: { ownerId, mime: "image/jpeg", key, width: out.info.width, height: out.info.height, purpose: "AVATAR" },
      select: { id: true },
    });
    return row.id;
  }

  const row = await prisma.media.create({
    data: { ownerId, mime: "image/jpeg", bytes: data, width: out.info.width, height: out.info.height, purpose: "AVATAR" },
    select: { id: true },
  });
  return row.id;
}

/** الكنس: من تجاوز `plusUntil` ولم يُنهَ بعد — منحُ اللوحة لا يصله حدثٌ ينهيه. */
export async function expirePlus(limit = 100): Promise<number> {
  const rows = await prisma.user.findMany({
    where: { isPlus: true, plusUntil: { lt: new Date() } },
    select: { id: true },
    take: limit,
  });
  for (const row of rows) await endPlus(row.id);
  if (rows.length > 0) console.log(`↓ انتهى آثار+ لـ${rows.length}`);
  return rows.length;
}
