import { prisma } from "@athar/db";
import { guard } from "../lib/moderation";
import { badRequest, notFound } from "../lib/errors";
import { visibleAuthors } from "./visibility";
import { push } from "./push";
import { clipOf, previewUrl, trackById } from "./music";
import { gifById } from "./giphy";

/**
 * النوت (القاعدة ٢٦٩) — **بقرار المالك**: فقاعةٌ فوق صورة صاحبها في شريط
 * القصص، فيها سطرٌ أو مقطعُ أغنيةٍ بعشرين ثانية، يوماً ثمّ تذهب.
 *
 * **واحدةٌ لكل حساب**: الجديدةُ تحلّ محلّ القديمة ومشاهداتها. والجمهورُ
 * الدائرةُ كلُّها أو تصنيفٌ واحد — شرطٌ في الاستعلام نفسه (`noteVisibleTo`)
 * لا تصفيةٌ بعده، كالقصص (القاعدة ٢١٩). ولا أحدَ من خارج الدائرة (القاعدة ٢).
 */

export const NOTE_TEXT_MAX = 60;
const NOTE_HOURS = 24;

/** من يرى النوت: صاحبُها، أو جمهورُها كلُّه، أو من في تصنيفها. */
export const noteVisibleTo = (viewerId: string) => ({
  OR: [
    { authorId: viewerId },
    { groupId: null },
    { group: { members: { some: { userId: viewerId } } } },
  ],
});

const AUTHOR = {
  id: true,
  name: true,
  avatarMediaId: true,
  frame: { select: { spec: true, mediaId: true, frameHole: true } },
  charm: { select: { spec: true, mediaId: true } },
} as const;

const NOTE = {
  id: true,
  authorId: true,
  text: true,
  trackId: true,
  trackTitle: true,
  trackArtist: true,
  trackCover: true,
  trackStart: true,
  trackSeconds: true,
  gifId: true,
  gifW: true,
  gifH: true,
  groupId: true,
  createdAt: true,
  expiresAt: true,
  author: { select: AUTHOR },
} as const;

/** نوتاتُ من يراهم القارئ، ونوتُه هو — لشريط القصص. */
export async function list(userId: string) {
  const authors = await visibleAuthors(userId);
  const rows = await prisma.statusNote.findMany({
    where: { authorId: { in: authors }, expiresAt: { gt: new Date() }, ...noteVisibleTo(userId) },
    orderBy: { createdAt: "desc" },
    select: {
      ...NOTE,
      group: { select: { name: true } },
      views: { where: { userId }, select: { reaction: true, seenAt: true } },
    },
  });
  return rows.map(({ views, group, ...row }) => ({
    ...row,
    // اسمُ التصنيف لصاحبها وحده — تصنيفُك لا يراه من صنّفته (القاعدة ٢٢).
    groupName: row.authorId === userId ? (group?.name ?? null) : null,
    seen: row.authorId === userId || views.length > 0,
    myReaction: views[0]?.reaction ?? null,
    seconds: row.trackId ? row.trackSeconds : null,
  }));
}

export async function post(
  userId: string,
  input: {
    text?: string;
    trackId?: string;
    trackStart?: number;
    trackSeconds?: number;
    trackFull?: boolean;
    gifId?: string;
    groupId?: string | null;
  },
) {
  const text = (input.text ?? "").trim().replace(/\s+/g, " ").slice(0, NOTE_TEXT_MAX);
  if (!text && !input.trackId && !input.gifId) throw badRequest("اكتب شيئاً أو اختر أغنية أو صورة متحركة");
  if (text) await guard(text);

  // الأغنيةُ تُقرأ من دِيزر بمعرّفها: اسمٌ وفنّانٌ يرسلهما الجهاز يُكتب فيهما أيُّ شيء.
  const track = input.trackId ? await trackById(input.trackId) : null;
  // كاملةً أو من البداية إلى النهاية كما اختارها صاحبُها (القاعدة ٣٠٣).
  // والصورةُ المتحرّكة كذلك بمعرّفها من GIPHY (القاعدة ٣١٥).
  const gif = input.gifId ? await gifById(input.gifId) : null;
  const clip = clipOf({ start: input.trackStart, seconds: input.trackSeconds, full: input.trackFull });

  let groupId: string | null = null;
  if (input.groupId) {
    const group = await prisma.friendGroup.findFirst({
      where: { id: input.groupId, ownerId: userId },
      select: { id: true },
    });
    if (!group) throw notFound("التصنيف غير موجود");
    groupId = group.id;
  }

  // الجديدةُ تحلّ محلّ القديمة ومشاهداتها معها.
  const [, note] = await prisma.$transaction([
    prisma.statusNote.deleteMany({ where: { authorId: userId } }),
    prisma.statusNote.create({
      data: {
        authorId: userId,
        text: text || null,
        trackId: track?.id ?? null,
        trackTitle: track?.title ?? null,
        trackArtist: track?.artist ?? null,
        trackCover: track?.cover ?? null,
        trackStart: track ? clip.start : 0,
        trackSeconds: clip.seconds,
        gifId: gif?.id ?? null,
        gifW: gif?.w ?? null,
        gifH: gif?.h ?? null,
        groupId,
        expiresAt: new Date(Date.now() + NOTE_HOURS * 3_600_000),
      },
      select: NOTE,
    }),
  ]);
  return { note };
}

export async function removeMine(userId: string) {
  await prisma.statusNote.deleteMany({ where: { authorId: userId } });
  return { ok: true };
}

/** النوتُ لمن يراها وحده — وإلّا «غير موجودة» (القاعدة ٢٣ب). */
async function visible(userId: string, noteId: string) {
  const note = await prisma.statusNote.findFirst({
    where: { id: noteId, expiresAt: { gt: new Date() }, ...noteVisibleTo(userId) },
    select: { id: true, authorId: true, trackId: true, trackStart: true, trackSeconds: true },
  });
  if (!note) throw notFound("النوت غير موجودة");
  if (note.authorId !== userId && !(await visibleAuthors(userId)).includes(note.authorId)) {
    throw notFound("النوت غير موجودة");
  }
  return note;
}

/** رأى النوت — أو سمع أغنيتها. ولا يُكتب لصاحبها. */
export async function see(userId: string, noteId: string, listened: boolean) {
  const note = await visible(userId, noteId);
  if (note.authorId === userId) return { ok: true };
  await prisma.noteView.upsert({
    where: { noteId_userId: { noteId, userId } },
    create: { noteId, userId, ...(listened ? { listenedAt: new Date() } : {}) },
    update: listened ? { listenedAt: new Date() } : {},
  });
  return { ok: true };
}

/** رابطُ المقطع طازجاً، وبدايتُه وطولُه. */
export async function audio(userId: string, noteId: string) {
  const note = await visible(userId, noteId);
  if (!note.trackId) throw notFound("لا أغنية في هذه النوت");
  return { url: await previewUrl(note.trackId), start: note.trackStart, seconds: note.trackSeconds };
}

/**
 * التفاعلُ بأحد الوجوه الخمسة (القاعدة ٣)، و`null` يرفعه. والجرسُ مرّةً لكل
 * متفاعل — `reactedAt` لا يُمسح، كتفاعل القصّة (القاعدة ٢٥٨).
 */
export async function react(userId: string, noteId: string, kind: "SMILE" | "LAUGH" | "GASP" | "SAD" | "LOVE" | null) {
  const note = await visible(userId, noteId);
  if (note.authorId === userId) throw notFound("النوت غير موجودة");
  const before = await prisma.noteView.findUnique({
    where: { noteId_userId: { noteId, userId } },
    select: { reactedAt: true },
  });
  const data = kind ? { reaction: kind, reactedAt: new Date() } : { reaction: null };
  await prisma.noteView.upsert({
    where: { noteId_userId: { noteId, userId } },
    create: { noteId, userId, ...data },
    update: data,
  });
  if (kind && !before?.reactedAt) {
    const who = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    void push({
      userId: note.authorId,
      kind: "REACTION",
      title: "تفاعل جديد على نوتك",
      body: `${who?.name ?? "صديق"} تفاعل مع نوتك`,
      path: "/circle",
    });
  }
  return { reaction: kind };
}

/** من رأى نوتي ومن سمع ومن تفاعل — لصاحبها وحده، والمتفاعلُ أوّلاً. */
export async function viewers(userId: string, noteId: string) {
  const note = await prisma.statusNote.findFirst({
    where: { id: noteId, authorId: userId },
    select: { id: true },
  });
  if (!note) throw notFound("النوت غير موجودة");
  const rows = await prisma.noteView.findMany({
    where: { noteId },
    orderBy: { seenAt: "desc" },
    select: {
      seenAt: true,
      listenedAt: true,
      reaction: true,
      user: { select: AUTHOR },
    },
  });
  return rows.sort((a, b) => Number(Boolean(b.reaction)) - Number(Boolean(a.reaction)));
}

/** كنسُ المنتهية — ومشاهداتُها معها بالتتالي. */
export async function sweep(): Promise<number> {
  const gone = await prisma.statusNote.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return gone.count;
}
