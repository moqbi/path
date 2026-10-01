import "server-only";
import { prisma } from "@/lib/db";

/**
 * الحسابات المرتبطة (القاعدة ١٩٤): من شارك هذا الحسابَ جهازاً أو عنواناً
 * في آخر تسعين يوماً (`AccessEvent`).
 *
 * **قرينةٌ لا دليل**: الجهازُ المشترك قويّ — معرّفٌ عشوائيٌّ في المخزن الآمن
 * لا يتشاركه اثنان إلا على جهازٍ واحد (أختان على آيباد العائلة مثلاً) —
 * والعنوانُ ضعيف: بيتٌ واحد، أو مقهى، أو شبكةُ جوّالٍ تُخرج آلافاً من عنوانٍ
 * واحد. ولذلك يُترك العنوانُ الذي يجمع أكثر من `CROWDED` حساباً: قائمةٌ
 * بمئة اسمٍ من شبكة STC لا تقول شيئاً عن أحد.
 */
const DAYS = 90;
const CROWDED = 12;

export type Linked = {
  id: string;
  name: string;
  memberNo: number;
  suspendedUntil: Date | null;
  device: boolean;
  ips: number;
  lastAt: Date;
};

export type LinkedResult = {
  linked: Linked[];
  crowded: number;
  /** ما سُجّل له هو — صفرٌ يعني لا دخولَ مسجَّلاً بعد، لا «لا ارتباط». */
  seen: { ips: number; devices: number };
};

export async function linkedAccounts(userId: string): Promise<LinkedResult> {
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const mine = await prisma.accessEvent.findMany({
    where: { userId, lastAt: { gte: since } },
    select: { ip: true, device: true },
  });
  const ips = [...new Set(mine.map((row) => row.ip).filter(Boolean))];
  const devices = [...new Set(mine.map((row) => row.device).filter(Boolean))];
  const seen = { ips: ips.length, devices: devices.length };
  if (ips.length === 0 && devices.length === 0) return { linked: [], crowded: 0, seen };

  // العناوين المزدحمة تُعرف بعدد أصحابها قبل أن تُقرأ صفوفُها.
  // وتُعدّ الحساباتُ لا الصفوف: حسابٌ بجهازين على شبكةٍ واحدة صفّان لا شخصان.
  const pairs = ips.length
    ? await prisma.accessEvent.findMany({
        where: { ip: { in: ips }, lastAt: { gte: since } },
        select: { ip: true, userId: true },
        distinct: ["ip", "userId"],
      })
    : [];
  const perIp = new Map<string, number>();
  for (const row of pairs) perIp.set(row.ip, (perIp.get(row.ip) ?? 0) + 1);
  const crowdedIps = new Set([...perIp].filter(([, count]) => count > CROWDED).map(([ip]) => ip));
  const quietIps = ips.filter((ip) => !crowdedIps.has(ip));

  const others = await prisma.accessEvent.findMany({
    where: {
      userId: { not: userId },
      lastAt: { gte: since },
      OR: [
        ...(devices.length ? [{ device: { in: devices } }] : []),
        ...(quietIps.length ? [{ ip: { in: quietIps } }] : []),
      ],
    },
    select: {
      userId: true,
      ip: true,
      device: true,
      lastAt: true,
      user: { select: { name: true, memberNo: true, suspendedUntil: true } },
    },
    take: 500,
  });

  const deviceSet = new Set(devices);
  const ipSet = new Set(quietIps);
  const byUser = new Map<string, Linked & { ipSeen: Set<string> }>();
  for (const row of others) {
    const entry =
      byUser.get(row.userId) ??
      {
        id: row.userId,
        name: row.user.name,
        memberNo: row.user.memberNo,
        suspendedUntil: row.user.suspendedUntil,
        device: false,
        ips: 0,
        lastAt: row.lastAt,
        ipSeen: new Set<string>(),
      };
    if (row.device && deviceSet.has(row.device)) entry.device = true;
    if (row.ip && ipSet.has(row.ip)) entry.ipSeen.add(row.ip);
    if (row.lastAt > entry.lastAt) entry.lastAt = row.lastAt;
    byUser.set(row.userId, entry);
  }

  const linked = [...byUser.values()]
    .map(({ ipSeen, ...rest }) => ({ ...rest, ips: ipSeen.size }))
    .filter((row) => row.device || row.ips > 0)
    // الجهازُ أوّلاً ثمّ كثرةُ العناوين المشتركة ثمّ الأحدث.
    .sort(
      (a, b) =>
        Number(b.device) - Number(a.device) || b.ips - a.ips || b.lastAt.getTime() - a.lastAt.getTime(),
    );
  return { linked, crowded: crowdedIps.size, seen };
}

/**
 * الحسابات المرتبطة لصفوف قائمة الحسابات معاً — كلُّ صفٍّ يحمل قرينته في
 * مكانه (القاعدة ١١٥: ما يُفعَل بالحساب يُفعَل في صفّه) لا في صفحةٍ ثانية.
 */
export async function linkedMany(ids: string[]): Promise<Map<string, LinkedResult>> {
  const rows = await Promise.all(ids.map(async (id) => [id, await linkedAccounts(id)] as const));
  return new Map(rows);
}
