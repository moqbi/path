import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * الدعوةُ بالرابط وحده على الويب (القاعدة ٢٤٣): `/app/i/<رقم العضوية>`
 * يكتب كوكي، والتسجيلُ — بالبريد أو بمزوّد — يقرؤها. لا حقلَ يُكتب فيه
 * رقمُ الداعي، فمن يُنشئ حساباتٍ وهميّة لا يكتب فيها رقمَ حسابه.
 */
export const REF_COOKIE = "athr_ref";

/** رقمُ الداعي من الكوكي — أو لا شيء. */
export async function cookieInviter(): Promise<number | undefined> {
  const raw = (await cookies()).get(REF_COOKIE)?.value ?? "";
  const no = Number(raw);
  return /^\d{1,9}$/.test(raw) && no > 0 ? no : undefined;
}

/** يربط حساباً وُلد للتوّ بداعيه — مرّةً، ولا يُسقط شيئاً إن فشل. */
export async function linkInviter(userId: string, inviterNo: number | null | undefined): Promise<void> {
  if (!inviterNo) return;
  const inviter = await prisma.user
    .findUnique({ where: { memberNo: inviterNo }, select: { id: true } })
    .catch(() => null);
  if (!inviter || inviter.id === userId) return;
  await prisma.user
    .updateMany({ where: { id: userId, invitedById: null }, data: { invitedById: inviter.id } })
    .catch(() => {});
}
