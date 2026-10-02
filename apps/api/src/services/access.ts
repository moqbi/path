import { createHash } from "node:crypto";
import type { Context } from "hono";
import { prisma } from "@athar/db";

/**
 * من أين دخل الحساب — لكشف الحسابات المرتبطة في اللوحة (القاعدة ١٩٤).
 *
 * العنوانُ من `CF-Connecting-IP` ثمّ أوّل `X-Forwarded-For` (Caddy يكتبه)،
 * والجهازُ من `x-device-id` — معرّفٌ عشوائيّ يولّده تطبيقُنا مرّةً ويحفظه في
 * المخزن الآمن (`athr.device`)، لا معرّفُ العتاد ولا الإعلان، فلا يتتبّع صاحبه
 * خارج تطبيقنا. ويُجزَّأ قبل أن يُحفظ: يكفي أن يُطابَق، ولا حاجة إلى قراءته.
 *
 * ويُكتب مرّةً كل عشر دقائق لكل ثلاثيّة لا مع كل طلب: الخطُّ الزمنيّ
 * يُمرَّر عشرات المرّات في الدقيقة، والكشفُ لا يحتاج أدقّ من ذلك.
 */
const EVERY_MS = 10 * 60_000;
const seen = new Map<string, number>();

export function clientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip")?.trim() ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  ).slice(0, 64);
}

function deviceOf(c: Context): string {
  const raw = c.req.header("x-device-id")?.trim();
  if (!raw || raw.length > 200) return "";
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function recordAccess(c: Context, userId: string): void {
  const ip = clientIp(c);
  const device = deviceOf(c);
  if (!ip && !device) return;

  const key = `${userId}|${ip}|${device}`;
  const now = Date.now();
  const last = seen.get(key);
  if (last && now - last < EVERY_MS) return;
  seen.set(key, now);
  if (seen.size > 20_000) seen.clear();

  // الفشلُ يُبتلع: كشفٌ ناقص لا يُسقط طلبَ صاحبه.
  void prisma.accessEvent
    .upsert({
      where: { userId_ip_device: { userId, ip, device } },
      create: { userId, ip, device },
      update: { lastAt: new Date(), hits: { increment: 1 } },
    })
    .catch(() => undefined);
}

/** ما مضى عليه تسعون يوماً يُكنس: الكشفُ عن الحاضر لا أرشيفٌ لتنقّلات الناس. */
export async function sweepAccess(): Promise<void> {
  await prisma.accessEvent.deleteMany({
    where: { lastAt: { lt: new Date(Date.now() - 90 * 86_400_000) } },
  });
}
