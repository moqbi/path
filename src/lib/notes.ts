import "server-only";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/moderation";
import { visibleAuthors } from "@/lib/visibility";
import { clipOf, previewUrl, trackById } from "@/lib/music";

/**
 * النوت على الويب — نسخةُ `apps/api/src/services/notes.ts` (القاعدة ٢٦٩) حرفاً
 * بحرف في الرؤية: واحدةٌ لكل حساب، يوماً ثمّ تذهب، والجمهورُ الدائرةُ كلُّها أو
 * تصنيفٌ — شرطٌ في الاستعلام نفسه لا تصفيةٌ بعده (`noteVisibleTo`).
 */

export const NOTE_TEXT_MAX = 60;
const NOTE_HOURS = 24;

export const noteVisibleTo = (viewerId: string) => ({
  OR: [
    { authorId: viewerId },
    { groupId: null },
    { group: { members: { some: { userId: viewerId } } } },
  ],
});

export const NOTE_FACES = ["SMILE", "LAUGH", "GASP", "SAD", "LOVE"] as const;
export type NoteFace = (typeof NOTE_FACES)[number];

const AUTHOR = {
  id: true,
  name: true,
  avatarMediaId: true,
  frame: { select: { spec: true, mediaId: true, frameHole: true } },
  charm: { select: { spec: true, mediaId: true } },
} as const;

export type NoteView = {
  id: string;
  authorId: string;
  text: string | null;
  trackId: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  trackCover: string | null;
  createdAt: Date;
  groupName: string | null;
  seen: boolean;
  myReaction: string | null;
  author: { id: string; name: string; avatarMediaId: string | null };
};

/** نوتاتُ من يراهم القارئ، ونوتُه هو — لشريط القصص. */
export async function listNotes(userId: string): Promise<NoteView[]> {
  const authors = await visibleAuthors(userId);
  const rows = await prisma.statusNote.findMany({
    where: { authorId: { in: authors }, expiresAt: { gt: new Date() }, ...noteVisibleTo(userId) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      authorId: true,
      text: true,
      trackId: true,
      trackTitle: true,
      trackArtist: true,
      trackCover: true,
      createdAt: true,
      author: { select: { id: true, name: true, avatarMediaId: true } },
      group: { select: { name: true } },
      views: { where: { userId }, select: { reaction: true } },
    },
  });
  return rows.map(({ views, group, ...row }) => ({
    ...row,
    // اسمُ التصنيف لصاحبها وحده (القاعدة ٢٢).
    groupName: row.authorId === userId ? (group?.name ?? null) : null,
    seen: row.authorId === userId || views.length > 0,
    myReaction: views[0]?.reaction ?? null,
  }));
}

export async function postNote(
  userId: string,
  input: { text?: string; trackId?: string | null; trackStart?: number; trackSeconds?: number; trackFull?: boolean; groupId?: string | null },
) {
  const text = (input.text ?? "").trim().replace(/\s+/g, " ").slice(0, NOTE_TEXT_MAX);
  if (!text && !input.trackId) throw new Error("اكتب شيئاً أو اختر أغنية");
  if (text) await guard(text);

  const track = input.trackId ? await trackById(input.trackId) : null;
  // كاملةً أو من البداية إلى النهاية كما اختارها صاحبُها (القاعدة ٣٠٣).
  const clip = clipOf({ start: input.trackStart, seconds: input.trackSeconds, full: input.trackFull });

  let groupId: string | null = null;
  if (input.groupId) {
    const group = await prisma.friendGroup.findFirst({
      where: { id: input.groupId, ownerId: userId },
      select: { id: true },
    });
    if (!group) throw new Error("التصنيف غير موجود");
    groupId = group.id;
  }

  await prisma.$transaction([
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
        groupId,
        expiresAt: new Date(Date.now() + NOTE_HOURS * 3_600_000),
      },
    }),
  ]);
}

export async function removeMyNote(userId: string) {
  await prisma.statusNote.deleteMany({ where: { authorId: userId } });
}

/** النوتُ لمن يراها وحده — وإلّا «غير موجودة» (القاعدة ٢٣ب). */
async function visible(userId: string, noteId: string) {
  const note = await prisma.statusNote.findFirst({
    where: { id: noteId, expiresAt: { gt: new Date() }, ...noteVisibleTo(userId) },
    select: { id: true, authorId: true, trackId: true, trackStart: true, trackSeconds: true },
  });
  if (!note) throw new Error("النوت غير موجودة");
  if (note.authorId !== userId && !(await visibleAuthors(userId)).includes(note.authorId)) {
    throw new Error("النوت غير موجودة");
  }
  return note;
}

export async function seeNote(userId: string, noteId: string, listened: boolean) {
  const note = await visible(userId, noteId);
  if (note.authorId === userId) return;
  await prisma.noteView.upsert({
    where: { noteId_userId: { noteId, userId } },
    create: { noteId, userId, ...(listened ? { listenedAt: new Date() } : {}) },
    update: listened ? { listenedAt: new Date() } : {},
  });
}

export async function noteAudio(userId: string, noteId: string) {
  const note = await visible(userId, noteId);
  if (!note.trackId) throw new Error("لا أغنية في هذه النوت");
  return { url: await previewUrl(note.trackId), start: note.trackStart, seconds: note.trackSeconds };
}

export async function reactNote(userId: string, noteId: string, kind: NoteFace | null) {
  const note = await visible(userId, noteId);
  if (note.authorId === userId) throw new Error("النوت غير موجودة");
  const data = kind ? { reaction: kind, reactedAt: new Date() } : { reaction: null };
  await prisma.noteView.upsert({
    where: { noteId_userId: { noteId, userId } },
    create: { noteId, userId, ...data },
    update: data,
  });
}

/** من رأى نوتي ومن سمع ومن تفاعل — لصاحبها وحده، والمتفاعلُ أوّلاً. */
export async function noteViewers(userId: string, noteId: string) {
  const note = await prisma.statusNote.findFirst({ where: { id: noteId, authorId: userId }, select: { id: true } });
  if (!note) throw new Error("النوت غير موجودة");
  const rows = await prisma.noteView.findMany({
    where: { noteId },
    orderBy: { seenAt: "desc" },
    select: { seenAt: true, listenedAt: true, reaction: true, user: { select: AUTHOR } },
  });
  return rows.sort((a, b) => Number(Boolean(b.reaction)) - Number(Boolean(a.reaction)));
}
