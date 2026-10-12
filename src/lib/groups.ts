import "server-only";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/moderation";

/**
 * المحادثةُ الجماعيّة على الويب — نسخةُ `apps/api/src/services/groups.ts`
 * (القاعدة ٢١٥) في القراءة والكتابة وحدهما: الإنشاءُ والإدارةُ من التطبيق.
 * **والعضويّةُ هي الصلاحية**: كلُّ قراءةٍ وكتابةٍ تمرّ على `seat()`، والعضوُ
 * الجديد يقرأ من يوم انضمامه (القاعدة ٢٤٢).
 */

const PERSON = {
  id: true,
  name: true,
  isPlus: true,
  tag: { select: { name: true, bg: true, fg: true } },
  avatarMediaId: true,
  frame: { select: { spec: true, mediaId: true, frameHole: true } },
  charm: { select: { spec: true, mediaId: true } },
} as const;

const MESSAGE = {
  id: true,
  body: true,
  kind: true,
  mediaId: true,
  seconds: true,
  senderId: true,
  createdAt: true,
  system: true,
  sender: { select: PERSON },
} as const;

/** «غير موجودة» لمن ليس فيها. */
export async function seat(userId: string, groupId: string) {
  const row = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { lastReadAt: true, joinedAt: true },
  });
  if (!row) throw new Error("المجموعة غير موجودة");
  return row;
}

export async function groupsFor(userId: string) {
  const seats = await prisma.chatGroupMember.findMany({
    where: { userId },
    select: {
      lastReadAt: true,
      joinedAt: true,
      group: {
        select: { id: true, name: true, photoMediaId: true, updatedAt: true, _count: { select: { members: true } } },
      },
    },
    orderBy: { group: { updatedAt: "desc" } },
  });
  return Promise.all(
    seats.map(async (row) => ({
      id: row.group.id,
      name: row.group.name,
      photoMediaId: row.group.photoMediaId,
      members: row.group._count.members,
      last: await prisma.groupMessage.findFirst({
        where: { groupId: row.group.id, createdAt: { gte: row.joinedAt } },
        select: { body: true, kind: true, seconds: true, createdAt: true, system: true, senderId: true, sender: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      unseen: await prisma.groupMessage.count({
        where: { groupId: row.group.id, senderId: { not: userId }, createdAt: { gt: row.lastReadAt } },
      }),
    })),
  );
}

export async function groupUnread(userId: string): Promise<number> {
  const seats = await prisma.chatGroupMember.findMany({
    where: { userId },
    select: { groupId: true, lastReadAt: true },
  });
  const counts = await Promise.all(
    seats.map((row) =>
      prisma.groupMessage.count({
        where: { groupId: row.groupId, senderId: { not: userId }, createdAt: { gt: row.lastReadAt } },
      }),
    ),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/** المجموعةُ بأعضائها وأحدثِ مئتي رسالةٍ منذ انضمامه — مرتّبةً من الأقدم. */
export async function groupThread(userId: string, groupId: string) {
  const { joinedAt } = await seat(userId, groupId);
  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      photoMediaId: true,
      _count: { select: { members: true } },
    },
  });
  if (!group) throw new Error("المجموعة غير موجودة");
  const rows = await prisma.groupMessage.findMany({
    where: { groupId, createdAt: { gte: joinedAt } },
    select: MESSAGE,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return { ...group, members: group._count.members, messages: rows.reverse() };
}

export async function markGroupRead(userId: string, groupId: string) {
  await seat(userId, groupId);
  await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { lastReadAt: new Date() },
  });
}

/** رسالةٌ في المجموعة — نصٌّ أو صورةٌ رفعها المرسل نفسه. */
export async function sendToGroup(
  userId: string,
  groupId: string,
  input: { kind: "TEXT"; body: string } | { kind: "PHOTO"; mediaId: string },
) {
  await seat(userId, groupId);
  let body = "";
  let mediaId: string | null = null;
  if (input.kind === "TEXT") {
    body = input.body.trim().slice(0, 2000);
    if (!body) throw new Error("اكتب شيئاً");
    await guard(body);
  } else {
    mediaId = input.mediaId;
  }
  await prisma.$transaction([
    prisma.groupMessage.create({ data: { groupId, senderId: userId, body, kind: input.kind, mediaId } }),
    prisma.chatGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } }),
    prisma.chatGroupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { lastReadAt: new Date() },
    }),
  ]);
}
