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
 * الإضافةُ وجهاً لوجه — بقرار المالك: من فتح «من حولك» في اللحظة نفسها وعلى
 * مئةٍ وخمسين متراً يرى الآخر. **في الذاكرة لا في القاعدة**: موضعٌ يعيش
 * دقيقةً لا يستحقّ صفّاً، ولا يبقى منه شيءٌ بعد أن تُغلق الشاشة. والموضعُ لا
 * يُرسل إلى أحد — يُعرض الاسمُ والصورةُ وحدهما — ولا يرى أحدٌ أحداً لم يفتح
 * الشاشةَ هو أيضاً. والأقربُ أوّلاً.
 *
 * **والفتحُ ينبّه من حولك ممّن فعّل «من حولك» في تنبيهاته** (القاعدة ٢٨٢) — بقرار
 * المالك، صديقاً كان أو غريباً: التنبيهُ بلا اسمٍ ولا مكان، وضغطُه يفتح الرادار
 * فيرى كلٌّ صاحبَه. ومن نبّه أحداً يبقى ظاهراً عشر دقائق (`STICKY_MS`) — من فتح
 * التنبيهَ بعد دقيقةٍ يجده وإن أغلق الشاشة.
 */
const NEAR_METERS = 150;
const ALIVE_MS = 45_000;
const STICKY_MS = 10 * 60_000;
const beacons = new Map<string, { lat: number; lng: number; at: number; until: number }>();

/**
 * آخرُ موضعٍ معروف لمن فعّل التنبيه — من فتح التطبيق (`/v1/places/check-in`)
 * ومن الرادار. ساعةٌ ثمّ يُنسى، وفي الذاكرة وحدها: من لم يفعّله لا يُحفظ له
 * موضعٌ أصلاً.
 */
const SPOT_MS = 60 * 60_000;
const spots = new Map<string, { lat: number; lng: number; at: number }>();
/** تنبيهٌ واحدٌ في الساعة لكلّ مستلم، وإرسالٌ واحدٌ كل نصف ساعة لكلّ فاتح. */
const RECEIVE_MS = 60 * 60_000;
const SEND_MS = 30 * 60_000;
const received = new Map<string, number>();
const sent = new Map<string, number>();

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function sweep(now: number) {
  for (const [id, b] of beacons) if (now - b.at > ALIVE_MS && now > b.until) beacons.delete(id);
  for (const [id, s] of spots) if (now - s.at > SPOT_MS) spots.delete(id);
  for (const [id, at] of received) if (now - at > RECEIVE_MS) received.delete(id);
  for (const [id, at] of sent) if (now - at > SEND_MS) sent.delete(id);
}

/** يحفظ موضعَ من فعّل التنبيه، ويمحوه لمن أطفأه. والفشلُ يُبتلع: خبرٌ زائد. */
export async function rememberSpot(userId: string, spot: { lat: number; lng: number }) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { notifyNearby: true } });
    if (user?.notifyNearby) spots.set(userId, { ...spot, at: Date.now() });
    else spots.delete(userId);
  } catch {
    // الموضعُ زينةٌ للتنبيه لا شرطٌ لفتح التطبيق.
  }
}

/** من فعّل التنبيه وقريبٌ الآن ولم يُنبَّه في الساعة — ثمّ يُنبَّهون. */
async function ringAround(userId: string, spot: { lat: number; lng: number }, blocked: Set<string>) {
  const now = Date.now();
  if (now - (sent.get(userId) ?? 0) < SEND_MS) return 0;
  const near = [...spots.entries()]
    .filter(
      ([id, s]) =>
        id !== userId &&
        !blocked.has(id) &&
        !beacons.has(id) &&
        now - (received.get(id) ?? 0) >= RECEIVE_MS &&
        meters(spot, s) <= NEAR_METERS,
    )
    .map(([id]) => id);
  if (near.length === 0) return 0;

  // الحقلُ يُقرأ من الصفّ ساعةَ الإرسال: من أطفأه بعد آخر فتحٍ لا يُنبَّه.
  const still = await prisma.user.findMany({
    where: {
      id: { in: near },
      notifyNearby: true,
      OR: [{ suspendedUntil: null }, { suspendedUntil: { lt: new Date(now) } }],
    },
    select: { id: true },
  });
  if (still.length === 0) return 0;

  sent.set(userId, now);
  const { push } = await import("./push");
  for (const { id } of still) {
    received.set(id, now);
    void push({
      userId: id,
      kind: "NEARBY",
      title: "فيه أحد قريب منك",
      body: "فاتح «من حولك» الحين — افتحها وشوف مين",
      path: "/nearby",
    });
  }
  return still.length;
}

export async function nearby(userId: string, spot: { lat: number; lng: number }) {
  const now = Date.now();
  sweep(now);
  const kept = beacons.get(userId)?.until ?? 0;
  beacons.set(userId, { ...spot, at: now, until: kept });
  void rememberSpot(userId, spot);

  const blocked = new Set(await blockedWith(userId));
  const rang = await ringAround(userId, spot, blocked);
  if (rang > 0) beacons.set(userId, { ...spot, at: now, until: now + STICKY_MS });

  const distance = new Map<string, number>();
  for (const [id, beacon] of beacons) {
    if (id === userId || blocked.has(id)) continue;
    const d = meters(spot, beacon);
    if (d <= NEAR_METERS) distance.set(id, d);
  }
  if (distance.size === 0) return { people: [], rang };

  const people = await prisma.user.findMany({
    where: { id: { in: [...distance.keys()] } },
    select: CARD,
  });
  // الأقربُ أوّلاً: من يجلس معك على الطاولة قبل من في آخر المقهى.
  people.sort((a, b) => (distance.get(a.id) ?? 0) - (distance.get(b.id) ?? 0));
  return { people: await withRelation(userId, people), rang };
}

/**
 * الخروجُ من الشاشة يُطفئ المنارة في الحال — لا تنتظر انقضاءها — إلا لمن نبّه
 * أحداً: يبقى ظاهراً حتى تنقضي دقائقُه العشر.
 */
export function leaveNearby(userId: string) {
  const beacon = beacons.get(userId);
  if (beacon && beacon.until > Date.now()) return;
  beacons.delete(userId);
}
