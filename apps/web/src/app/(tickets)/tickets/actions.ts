"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, currentUser, destroySession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clear, clientIp, hit, TOO_MANY } from "@/lib/rate-limit";
import { canComment } from "@/lib/tickets";
import { tellSupport } from "@/lib/support-mail";

type Result = { ok?: string; error?: string } | null;

const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(128)}`;

/**
 * دخولُ نظام التذاكر بالبريد وكلمة المرور — بحدود دخول الموقع (القاعدة ١٨١) وبوقتٍ
 * واحد وُجد الحسابُ أو لم يوجد. ومن لا كلمةَ له (آبل، قوقل، سناب…) يدخله من التطبيق.
 */
export async function ticketSignIn(_prev: Result, formData: FormData): Promise<Result> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "اكتب بريدك وكلمة المرور" };

  const ip = await clientIp();
  const byMail = `tickets:mail:${email}`;
  if (!hit(`tickets:ip:${ip}`, 10, 15 * 60_000) || !hit(byMail, 5, 15 * 60_000)) return { error: TOO_MANY };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !ok) return { error: "البريد أو كلمة المرور غير صحيحة" };

  clear(byMail);
  await createSession(user.id, user.passwordHash);
  redirect("/tickets");
}

export async function ticketSignOut(): Promise<void> {
  await destroySession();
  redirect("/tickets");
}

/** تعليقُ صاحب الطلب بعد ردّ الموظّف — ويُعيد فتح المغلقة (القاعدة ٤٨٠). */
export async function commentTicket(ticketId: string, _prev: Result, formData: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { error: "سجّل دخولك أوّلاً" };
  const body = String(formData.get("body") ?? "").trim().slice(0, 1200);
  if (body.length < 2) return { error: "اكتب تعليقك" };

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId: user.id },
    select: {
      id: true,
      number: true,
      closed: true,
      lockedAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { fromStaff: true } },
    },
  });
  if (!ticket) return { error: "غير موجودة" };
  const can = canComment(ticket.lockedAt, ticket.closed, ticket.messages[0]?.fromStaff ?? null);
  if (!can.ok) return { error: can.why };

  const now = new Date();
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId, fromStaff: false, body } }),
    prisma.supportTicket.update({ where: { id: ticketId }, data: { closed: false, lastAt: now } }),
  ]);
  void tellSupport({
    from: `${user.name} (#${user.memberNo})`,
    body,
    replyTo: user.email,
    ticket: { id: ticket.id, number: ticket.number, comment: true },
  });
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { ok: ticket.closed ? "أُعيد فتح طلبك — نردّ عليك قريباً" : "أُرسل تعليقك" };
}
