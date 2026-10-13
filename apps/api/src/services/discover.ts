import { prisma } from "@athar/db";
import { badRequest } from "../lib/errors";
import { blockedWith, circleIds } from "./visibility";

/**
 * أبوابُ الإضافة التي لا تمرّ بالرابط (القاعدة ٢٨٠): البحثُ بالمعرّف أو الاسم
 * الكامل، والإضافةُ وجهاً لوجه. كلاهما يُري **بطاقةً** — صورةً واسماً ورقم عضوية
 * (القاعدة ٢٠) — والإضافةُ بعدها طلبٌ يقبله صاحبُه أو يدعه: الحارسُ القبول.
 */
const CARD = {
  id: true,
  memberNo: true,
  name: true,
  handle: true,
  isOpen: true,
  isPlus: true,
  avatarMediaId: true,
  frame: { select: { id: true, name: true, kind: true, spec: true, mediaId: true, frameHole: true, priceCoins: true, plusOnly: true } },
  charm: { select: { id: true, name: true, kind: true, spec: true, mediaId: true, priceCoins: true, plusOnly: true } },
  tag: { select: { name: true, bg: true, fg: true } },
} as const;

/** «أ» و«إ» و«آ» حرفٌ واحد، والتاءُ المربوطة هاءٌ، وفراغاتٌ كثيرة فراغٌ واحد. */
function fold(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** يُرفق بكلّ بطاقةٍ علاقتَها بالسائل: صديق، أو طلبٌ منه، أو طلبٌ إليه. */
async function withRelation<T extends { id: string }>(userId: string, people: T[]) {
  if (people.length === 0) return [];
  const ids = people.map((p) => p.id);
  const [friends, pending] = await Promise.all([
    circleIds(userId),
    prisma.friendship.findMany({
      where: {
        status: "PENDING",
        OR: [
          { requesterId: userId, addresseeId: { in: ids } },
          { addresseeId: userId, requesterId: { in: ids } },
        ],
      },
      select: { requesterId: true, addresseeId: true },
    }),
  ]);
  const circle = new Set(friends);
  return people.map((person) => {
    const row = pending.find((p) => p.requesterId === person.id || p.addresseeId === person.id);
    const relation = circle.has(person.id)
      ? ("friend" as const)
      : row?.requesterId === userId
        ? ("sent" as const)
        : row
          ? ("incoming" as const)
          : ("none" as const);
    return { ...person, relation };
  });
}

/**
 * البحثُ **بالمطابقة التامّة وحدها** — بقرار المالك: المعرّفُ كاملاً (بـ@ أو بلاها)،
 * أو الاسمُ الكاملُ بكلمتين على الأقلّ. لا تضمينَ ولا «يبدأ بـ»: من كتب «محمد»
 * لا يجد قائمةً يتصفّحها (القاعدة ٢)، ومن يعرف اسمَ صاحبه كاملاً يجده.
 */
export async function findPeople(userId: string, raw: string) {
  const q = raw.trim();
  if (q.length < 2) throw badRequest("اكتب المعرّف أو الاسم كاملاً");
  const blocked = new Set(await blockedWith(userId));

  const handle = q.replace(/^@/, "").toLowerCase();
  const byHandle = /^[a-z0-9._]{2,30}$/.test(handle)
    ? await prisma.user.findMany({
        where: { handle: { equals: handle, mode: "insensitive" } },
        select: CARD,
        take: 1,
      })
    : [];

  const folded = fold(q);
  let byName: typeof byHandle = [];
  if (folded.split(" ").length >= 2) {
    // الطيُّ في Postgres يحتاج امتداداً؛ فالمرشّحون بأطول كلمةٍ بعد نزع ما تختلف
    // كتابتُه في طرفيها (همزةُ الألف أوّلاً، والتاءُ المربوطة والياءُ آخراً)، ثمّ
    // المطابقةُ التامّة بعد الطيّ هنا.
    const longest = q.split(/\s+/).sort((a, b) => b.length - a.length)[0]!;
    const core = longest.replace(/^[اأإآ]/, "").replace(/[ةهىي]$/, "");
    const rough = await prisma.user.findMany({
      where: { name: { contains: core.length >= 2 ? core : longest, mode: "insensitive" } },
      select: CARD,
      take: 500,
    });
    byName = rough.filter((person) => fold(person.name) === folded).slice(0, 10);
  }

  const seen = new Set<string>();
  const people = [...byHandle, ...byName].filter((person) => {
    if (person.id === userId || blocked.has(person.id) || seen.has(person.id)) return false;
    seen.add(person.id);
    return true;
  });
  return withRelation(userId, people);
}

// ───────────────────────────── وجهاً لوجه ─────────────────────────────

/**
 * الإضافةُ وجهاً لوجه — بقرار المالك: من فتح «من حولي» في اللحظة نفسها وعلى
 * مئةٍ وخمسين متراً يرى الآخر. **في الذاكرة لا في القاعدة**: موضعٌ يعيش
 * دقيقةً لا يستحقّ صفّاً، ولا يبقى منه شيءٌ بعد أن تُغلق الشاشة. والموضعُ لا
 * يُرسل إلى أحد — يُعرض الاسمُ والصورةُ وحدهما — ولا يرى أحدٌ أحداً لم يفتح
 * الشاشةَ هو أيضاً.
 */
const NEAR_METERS = 150;
const ALIVE_MS = 45_000;
const beacons = new Map<string, { lat: number; lng: number; at: number }>();

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export async function nearby(userId: string, spot: { lat: number; lng: number }) {
  const now = Date.now();
  for (const [id, beacon] of beacons) if (now - beacon.at > ALIVE_MS) beacons.delete(id);
  beacons.set(userId, { ...spot, at: now });

  const close = [...beacons.entries()]
    .filter(([id, beacon]) => id !== userId && meters(spot, beacon) <= NEAR_METERS)
    .map(([id]) => id);
  if (close.length === 0) return [];

  const blocked = new Set(await blockedWith(userId));
  const people = await prisma.user.findMany({
    where: { id: { in: close.filter((id) => !blocked.has(id)) } },
    select: CARD,
  });
  return withRelation(userId, people);
}

/** الخروجُ من الشاشة يُطفئ المنارة في الحال — لا تنتظر انقضاءها. */
export function leaveNearby(userId: string) {
  beacons.delete(userId);
}
