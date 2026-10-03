import "server-only";
/*
  نسخةُ `apps/api/src/services/memories.ts` للويب (القاعدة ٢٣٥) — منطقٌ واحد
  بتشغيلين كقواعد الرؤية: اختلافُهما يُري ذكرى في أحدهما دون الآخر.
  والمشاركةُ من الويب للدائرة كلّها أو تصنيف «من يرى لحظاتي» وحده.
*/
import { prisma } from "@/lib/db";
import { Prisma, type MomentKind } from "@/generated/prisma/client";
import { daysText, dayKey, dayRange, monthsBefore, riyadhDay, spanText, type Day } from "@/lib/riyadh-day";
import { blockedWith } from "@/lib/visibility";
import { circleIds } from "@/lib/circle";
import { momentsByIds } from "@/lib/feed";
import { copyMedia } from "@/lib/media";
import { recapStatus } from "@/lib/recap";

/**
 * «في مثل هذا اليوم» ومناسباتُ الصداقة — **بقرار المالك** (القاعدة ٢٣٥).
 *
 * تُشتقّ ولا تُخزَّن كالإشعارات (القاعدة ٢٥): اللحظاتُ والصداقاتُ في القاعدة،
 * والسؤالُ «أيُّها يقع اليوم؟» يُجاب كلَّ مرّةٍ من جديد — فلحظةٌ حُذفت لا
 * تعود ذكرى، وصديقٌ أُزيل لا تُحتفل صداقتُه.
 *
 * وخاصّةٌ لصاحبها: لا تُرسل لأحدٍ غيره، ولا تدخل خطَّ أحد. وزرُّ «شاركها»
 * يكتب لحظةً جديدةً باسمه لمن يختار — فالجمهورُ قرارُه هو لا جمهورُ الأصل.
 */

/**
 * الفتراتُ: شهرٌ وستّة أشهر ثمّ كلُّ سنة — **بقرار المالك**: التطبيقُ جديد،
 * فبالسنوات وحدها لا يرى أحدٌ ذكرى قبل خريف ٢٠٢٧.
 */
const YEARS_BACK = 15;
export function memoryPeriods(): number[] {
  return [1, 6, ...Array.from({ length: YEARS_BACK }, (_, index) => (index + 1) * 12)];
}

/**
 * ما يستحقّ أن يُتذكَّر: ما كتبه صاحبُه، وانضمامُه. لا النومُ والصحو (كلَّ يوم)،
 * ولا تغييرُ الصورة والمنحُ والهدايا (أخبارٌ لا لحظات)، ولا «أصبح صديق فلان»:
 * مناسبةُ الصداقة تقولها بأحسن منها.
 */
const MEMORABLE: MomentKind[] = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "CITY", "JOINED"];
/** ما يُشارك: ما له متن. «انضم» لا يُعاد نشرُه. */
const SHAREABLE: MomentKind[] = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "CITY"];

export type Memory = {
  months: number;
  /** «قبل سنة». */
  label: string;
  moments: Awaited<ReturnType<typeof momentsByIds>>;
};

/** يومُ اليوم وما يقابله في كلّ فترة — ما لا مثيل له يسقط. */
function periodDays(today: Day) {
  return memoryPeriods()
    .map((months) => ({ months, day: monthsBefore(today, months) }))
    .filter((row): row is { months: number; day: Day } => row.day !== null);
}

/** أيُّ فترةٍ تقع فيها هذه اللحظة من اليوم — أو لا شيء. */
function periodOf(createdAt: Date, rows: { months: number; day: Day }[]) {
  const key = dayKey(riyadhDay(createdAt));
  return rows.find((row) => dayKey(row.day) === key)?.months ?? null;
}

/** المعرّفاتُ وحدها — للجرس الصباحيّ: يكفيه أن يعرف أفي اليوم شيء. */
async function memoryRows(userId: string, today: Day) {
  const rows = periodDays(today);
  const found = await prisma.moment.findMany({
    where: {
      authorId: userId,
      kind: { in: MEMORABLE },
      // ذكرى شاركها ثمّ مرّت سنةٌ عليها ليست ذكرى ثانية.
      memoryOf: null,
      recapYear: null,
      OR: rows.map((row) => ({ createdAt: dayRange(row.day) })),
    },
    select: { id: true, kind: true, createdAt: true, text: true, placeName: true, placeCity: true, musicTitle: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return found
    .map((moment) => ({ ...moment, months: periodOf(moment.createdAt, rows) }))
    .filter((moment): moment is typeof moment & { months: number } => moment.months !== null);
}

/** ذكرياتُ اليوم مجموعةً بفترتها، الأقدمُ أوّلاً: «قبل ٣ سنوات» أثقلُ من «قبل شهر». */
export async function memoriesFor(userId: string, today = riyadhDay()): Promise<Memory[]> {
  const rows = await memoryRows(userId, today);
  const moments = await momentsByIds(userId, rows.map((row) => row.id));
  const byId = new Map(moments.map((moment) => [moment.id, moment]));

  const groups = new Map<number, Memory>();
  for (const row of rows) {
    const moment = byId.get(row.id);
    if (!moment) continue;
    const group = groups.get(row.months) ?? { months: row.months, label: `قبل ${spanText(row.months)}`, moments: [] };
    // ثلاثٌ لكل فترة: يومٌ نشر فيه عشرين لا يُعرض جداراً.
    if (group.moments.length < 3) group.moments.push(moment);
    groups.set(row.months, group);
  }
  return [...groups.values()].sort((a, b) => b.months - a.months);
}

/** جملةُ الجرس: «قبل سنة كنت في الرياض». */
export function memorySentence(row: { kind: MomentKind; text: string | null; placeName: string | null; placeCity: string | null; musicTitle: string | null; months: number }) {
  const when = `قبل ${spanText(row.months)}`;
  switch (row.kind) {
    case "PHOTO":
      return `${when} نشرت صورة — شوفها`;
    case "PLACE":
      return `${when} كنت في ${row.placeName ?? row.placeCity ?? "مكانٍ تذكره"}`;
    case "CITY":
      return `${when} وصلت إلى ${row.text ?? row.placeCity ?? "مدينةٍ جديدة"}`;
    case "MUSIC":
      return row.musicTitle ? `${when} كنت تسمع «${row.musicTitle}»` : `${when} شاركت أغنية`;
    case "JOINED":
      return `${when} انضممت إلى آثار مومنتس`;
    default: {
      const text = (row.text ?? "").replace(/\s+/g, " ").trim();
      return text ? `${when} كتبت: «${text.length > 50 ? `${text.slice(0, 50)}…` : text}»` : `${when} كتبت لحظة`;
    }
  }
}

// ───────────────────────────── مناسبات الصداقة ─────────────────────────────

/** محطّاتُ السلسلة: يومٌ بعد يومٍ من التفاعل بلا انقطاع. */
const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365];

export type Occasion = {
  /** مفتاحٌ ثابتٌ لليوم — يُطوى به. */
  id: string;
  kind: "FRIENDVERSARY" | "STREAK" | "FIRST_TOGETHER";
  friend: { id: string; name: string; avatarMediaId: string | null };
  title: string;
  /** سطرٌ ثانٍ من الأرقام: «أطول سلسلة جمعتكما ٢٠ يوماً، أول لحظة جمعتكما قبل ٥ أشهر». */
  detail: string | null;
  /** لحظةُ «أوّل ما جمعكما» حين تكون هي المناسبة أو جزءاً منها. */
  momentId: string | null;
};

/** الأصدقاء الذين يُحتفل بهم: الدائرةُ بلا محجوبٍ ولا حسابٍ مفتوح (حسابُ الدعم ليس صداقة). */
async function celebrated(userId: string) {
  const [ids, blocked] = await Promise.all([circleIds(userId), blockedWith(userId)]);
  const hidden = new Set(blocked);
  const people = await prisma.user.findMany({
    where: { id: { in: ids.filter((id) => !hidden.has(id)) }, isOpen: false },
    select: { id: true, name: true, avatarMediaId: true },
  });
  return new Map(people.map((person) => [person.id, person]));
}

/**
 * أيّامُ التفاعل بين صاحب الحساب وكلّ صديق: تفاعلٌ أو تعليقٌ من أحدهما على
 * لحظة الآخر. يومٌ بتوقيت الرياض، والمجموعةُ لكلّ صديقٍ على حدة.
 * والرسائلُ خارجها: تُكنس بعد ثلاثين يوماً (القاعدة ٨٣)، فسلسلةٌ تعتمد عليها
 * تنقطع في سجلّها لا في الواقع.
 */
async function interactionDays(userId: string, friendId?: string, sinceDays?: number) {
  const since = sinceDays ? Prisma.sql`AND x."createdAt" > now() - make_interval(days => ${sinceDays})` : Prisma.empty;
  const pair = (actor: Prisma.Sql, author: Prisma.Sql) =>
    friendId
      ? Prisma.sql`((${actor} = ${userId} AND ${author} = ${friendId}) OR (${actor} = ${friendId} AND ${author} = ${userId}))`
      : Prisma.sql`(${actor} = ${userId} OR ${author} = ${userId}) AND ${actor} <> ${author}`;

  const rows = await prisma.$queryRaw<{ other: string; day: string }[]>`
    SELECT DISTINCT other, day FROM (
      SELECT CASE WHEN x."userId" = ${userId} THEN m."authorId" ELSE x."userId" END AS other,
             to_char(x."createdAt" + interval '3 hours', 'YYYY-MM-DD') AS day
        FROM "Reaction" x JOIN "Moment" m ON m.id = x."momentId"
       WHERE ${pair(Prisma.sql`x."userId"`, Prisma.sql`m."authorId"`)} ${since}
      UNION ALL
      SELECT CASE WHEN x."userId" = ${userId} THEN m."authorId" ELSE x."userId" END AS other,
             to_char(x."createdAt" + interval '3 hours', 'YYYY-MM-DD') AS day
        FROM "Comment" x JOIN "Moment" m ON m.id = x."momentId"
       WHERE ${pair(Prisma.sql`x."userId"`, Prisma.sql`m."authorId"`)} ${since}
    ) t`;

  const out = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = out.get(row.other) ?? new Set<string>();
    set.add(row.day);
    out.set(row.other, set);
  }
  return out;
}

const nextDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(riyadhDay(new Date(Date.UTC(y, m - 1, d + 1) - 3 * 3_600_000)));
};
const prevDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(riyadhDay(new Date(Date.UTC(y, m - 1, d - 1) - 3 * 3_600_000)));
};

/** السلسلةُ القائمة المنتهية **أمس**: اليومُ لم يكتمل بعد. */
function currentStreak(days: Set<string>, today: Day) {
  let count = 0;
  for (let key = prevDay(dayKey(today)); days.has(key); key = prevDay(key)) count += 1;
  return count;
}

/** أطولُ سلسلةٍ في السجلّ كلّه. */
export function longestStreak(days: Set<string>) {
  let best = 0;
  for (const key of days) {
    if (days.has(prevDay(key))) continue; // ليس أوّلَ سلسلة
    let length = 1;
    for (let next = nextDay(key); days.has(next); next = nextDay(next)) length += 1;
    best = Math.max(best, length);
  }
  return best;
}

/** أوّلُ لحظةٍ جمعتهما بالإشارة («مع فلان») — لكلّ صديق، من أنواع «آثارنا» وحدها (القاعدة ١٥٩). */
async function firstTogether(userId: string, friendId?: string) {
  const only = friendId
    ? Prisma.sql`AND ((m."authorId" = ${userId} AND t."userId" = ${friendId}) OR (m."authorId" = ${friendId} AND t."userId" = ${userId}))`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<{ other: string; id: string; at: Date }[]>`
    SELECT DISTINCT ON (other) other, id, at FROM (
      SELECT CASE WHEN m."authorId" = ${userId} THEN t."userId" ELSE m."authorId" END AS other,
             m.id, m."createdAt" AS at
        FROM "Moment" m JOIN "MomentTag" t ON t."momentId" = m.id
       WHERE (m."authorId" = ${userId} OR t."userId" = ${userId}) ${only}
         AND m.kind::text IN ('PHOTO', 'PLACE', 'MUSIC', 'THOUGHT')
    ) f ORDER BY other, at ASC`;
  return new Map(rows.map((row) => [row.other, { id: row.id, at: row.at }]));
}

/** «قبل ٥ أشهر» من تاريخ — بالأشهر الكاملة، وما دون الشهر «هذا الشهر». */
function agoText(at: Date, today: Day) {
  const then = riyadhDay(at);
  let months = (today.y - then.y) * 12 + (today.m - then.m);
  if (today.d < then.d) months -= 1;
  if (months < 1) return "هذا الشهر";
  return `قبل ${spanText(months)}`;
}

/** «مرّ شهر»، «مرّت ٦ أشهر»، «مرّت سنة»، «مرّت سنتان». */
function passedText(months: number) {
  if (months === 1) return "مرّ شهر";
  if (months === 24) return "مرّت سنتان";
  return `مرّت ${spanText(months)}`;
}

/** إحصاءُ صداقةٍ بعينها: يُكتب تحت مناسبتها. */
async function pairDetail(userId: string, friendId: string, today: Day) {
  const [days, first] = await Promise.all([interactionDays(userId, friendId), firstTogether(userId, friendId)]);
  const longest = longestStreak(days.get(friendId) ?? new Set());
  const together = first.get(friendId) ?? null;
  const parts: string[] = [];
  if (longest >= 2) parts.push(`أطول سلسلة تفاعل جمعتكما ${daysText(longest)}`);
  if (together) parts.push(`أول لحظة جمعتكما ${agoText(together.at, today)}`);
  return { detail: parts.length ? parts.join("، ") : null, momentId: together?.id ?? null };
}

export async function occasionsFor(userId: string, today = riyadhDay()): Promise<Occasion[]> {
  const people = await celebrated(userId);
  if (people.size === 0) return [];
  const friendIds = [...people.keys()];
  const rows = periodDays(today);
  const out: Occasion[] = [];

  // ١. مرورُ شهرٍ وستّة أشهر وكلِّ سنةٍ على الصداقة — من يوم قبولها.
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userId, addresseeId: { in: friendIds } },
        { addresseeId: userId, requesterId: { in: friendIds } },
      ],
      AND: [
        {
          OR: rows.flatMap((row) => [
            { acceptedAt: dayRange(row.day) },
            { acceptedAt: null, createdAt: dayRange(row.day) },
          ]),
        },
      ],
    },
    select: { requesterId: true, addresseeId: true, acceptedAt: true, createdAt: true },
  });
  for (const friendship of friendships) {
    const friendId = friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId;
    const friend = people.get(friendId);
    const months = periodOf(friendship.acceptedAt ?? friendship.createdAt, rows);
    if (!friend || !months) continue;
    const { detail, momentId } = await pairDetail(userId, friendId, today);
    out.push({
      id: `f-${friendId}-${dayKey(today)}`,
      kind: "FRIENDVERSARY",
      friend,
      title: `${passedText(months)} على صداقتك مع ${friend.name}`,
      detail,
      momentId,
    });
  }

  // ٢. سلسلةٌ بلغت محطّةً أمس: «١٤ يوماً وأنتما تتفاعلان كلَّ يوم».
  const recent = await interactionDays(userId, undefined, 400);
  for (const [friendId, days] of recent) {
    const friend = people.get(friendId);
    if (!friend) continue;
    const streak = currentStreak(days, today);
    if (!STREAK_MILESTONES.includes(streak)) continue;
    out.push({
      id: `s-${friendId}-${dayKey(today)}`,
      kind: "STREAK",
      friend,
      title: `${daysText(streak)} وأنت و${friend.name} تتفاعلان كل يوم`,
      detail: "لا تكسرا السلسلة اليوم",
      momentId: null,
    });
  }

  // ٣. ذكرى أوّل لحظةٍ جمعتكما — بالسنوات وحدها: «قبل شهر» تكرارٌ لما في الذكريات.
  const firsts = await firstTogether(userId);
  for (const [friendId, first] of firsts) {
    const friend = people.get(friendId);
    const months = friend ? periodOf(first.at, rows) : null;
    if (!friend || !months || months < 12) continue;
    // ذكرى الصداقة في اليوم نفسه تحمل هذه اللحظة أصلاً: لا بطاقتان لصديقٍ واحد.
    if (out.some((one) => one.kind === "FRIENDVERSARY" && one.friend.id === friendId)) continue;
    out.push({
      id: `t-${friendId}-${dayKey(today)}`,
      kind: "FIRST_TOGETHER",
      friend,
      title: `أول لحظة جمعتك بـ${friend.name} كانت قبل ${spanText(months)}`,
      detail: null,
      momentId: first.id,
    });
  }

  return out;
}

/** جملةُ الجرس لمناسبة. */
export const occasionSentence = (occasion: Occasion) => occasion.title;

// ───────────────────────────── البطاقة ─────────────────────────────

/**
 * ما تعرضه البطاقةُ أعلى اللحظات اليوم: الذكرياتُ والمناسباتُ ولحظاتُها.
 * وتُطوى لليوم كلّه بـ`dismiss`، وتعود غداً بما يقع فيه.
 */
export async function today(userId: string) {
  const day = riyadhDay();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { memoriesDismissedOn: true } });
  // «آثرك جاهز» في نافذته (٢٥ ديسمبر – آخر يناير) — بابُه في البطاقة نفسها.
  const { year: recapYear } = await recapStatus(userId);
  if (user?.memoriesDismissedOn === dayKey(day)) {
    return { day: dayKey(day), recapYear, memories: [], occasions: [], moments: [] };
  }

  const [memories, occasions] = await Promise.all([memoriesFor(userId, day), occasionsFor(userId, day)]);
  const moments = await momentsByIds(
    userId,
    occasions.map((occasion) => occasion.momentId).filter((id): id is string => Boolean(id)),
  );
  // مناسبةٌ لحظتُها لا يراها صاحبُ الحساب (خاصّةٌ لم تُوجَّه إليه) تبقى بلا لحظة.
  const seen = new Set(moments.map((moment) => moment.id));
  return {
    day: dayKey(day),
    recapYear,
    memories,
    occasions: occasions
      .map((occasion) => (occasion.momentId && !seen.has(occasion.momentId) ? { ...occasion, momentId: null } : occasion))
      .filter((occasion) => occasion.kind !== "FIRST_TOGETHER" || occasion.momentId),
    moments,
  };
}

export async function dismiss(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { memoriesDismissedOn: dayKey(riyadhDay()) } });
  return { ok: true };
}

// ───────────────────────────── المشاركة ─────────────────────────────

/**
 * «شاركها»: لحظةٌ جديدةٌ باسم صاحبها **نسخةٌ لا إشارة** — فجمهورُها ما يختاره
 * الآن لا جمهورُ الأصل: لحظةٌ خاصّةٌ قديمة لا تصير عامّةً بإشارةٍ إليها، ولا
 * تُخفى المشاركةُ إن حُذف الأصل. والصورةُ نسخةٌ كذلك (`copyMedia`): `mediaId`
 * فريدٌ على اللحظة. و`memoryOf` يحمل تاريخ الأصل فتُقرأ «ذكرى من …».
 */
export async function shareMemory(
  userId: string,
  momentId: string,
) {
  const source = await prisma.moment.findFirst({
    where: { id: momentId, authorId: userId },
    select: {
      kind: true,
      text: true,
      createdAt: true,
      mediaId: true,
      photoX: true,
      photoY: true,
      imageSpec: true,
      placeName: true,
      placeCity: true,
      lat: true,
      lng: true,
      musicUrl: true,
      musicTitle: true,
      musicArtist: true,
      musicThumb: true,
      memoryOf: true,
    },
  });
  if (!source) throw new Error("اللحظة غير موجودة");
  if (!SHAREABLE.includes(source.kind)) throw new Error("هذه الذكرى لا تُشارك");

  const seen = await circleAudience(userId);
  const media = source.mediaId ? await copyMedia(source.mediaId, userId) : null;
  if (source.kind === "PHOTO" && source.mediaId && !media) throw new Error("تعذّر نسخ الصورة — حاول بعد قليل");

  const created = await prisma.moment.create({
    data: {
      authorId: userId,
      kind: source.kind,
      text: source.text,
      mediaId: media?.id ?? null,
      photoX: source.photoX,
      photoY: source.photoY,
      imageSpec: source.imageSpec,
      placeName: source.placeName,
      placeCity: source.placeCity,
      lat: source.lat,
      lng: source.lng,
      musicUrl: source.musicUrl,
      musicTitle: source.musicTitle,
      musicArtist: source.musicArtist,
      musicThumb: source.musicThumb,
      memoryOf: source.memoryOf ?? source.createdAt,
      audience: seen.audience,
      audienceGroupId: seen.audienceGroupId,
    },
    select: { id: true },
  });
  return { id: created.id };
}

/** جمهورُ «دائرتي» كما يقرؤه النشر: تصنيفُ «من يرى لحظاتي» إن ضُبط. */
export async function circleAudience(userId: string) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { viewGroupId: true } });
  return row?.viewGroupId
    ? { audience: "GROUP" as const, audienceGroupId: row.viewGroupId }
    : { audience: "CIRCLE" as const, audienceGroupId: null };
}

