import Link from "next/link";
import { prisma } from "@/lib/db";
import { ar, riyals } from "@/lib/format";

/*
  لوحةُ التحليلات (القاعدة ٣٠٧): من يستعمل التطبيق، وكم يعود، وماذا يفعل.

  **والفترةُ تُختار في أعلاها** (القاعدة ٤٧٨): شهرٌ بعينه أو «الكل»، والأرقامُ والجداولُ والرسومُ
  كلُّها تتبعها — الشهرُ بأيّامه ويُقارن بالشهر قبله، والكلُّ بشهوره. و«الآن» وحده لا يتبعها.
  **وما مُنح من اللوحة لا يُحسب**: النقاطُ من شراء المتجر وحده (`source = STORE`)، وآثار+ لمن دفع
  أو أُهدي إليه بمال — منحُ اللوحة ليس اشتراكاً.

  «النشطون» من `lastSeenAt` للأرقام الكبيرة — آخرُ ظهورٍ صادقٌ منذ اليوم الأوّل —
  ومن `DailyActive` للخطّ الزمنيّ: `lastSeenAt` يقول آخرَ مرّة لا أيّامَ الحضور.
  والأيّامُ أيّامُ الرياض (+٣) كجرس الصباح، **والأسبوعُ يبدأ السبت**: «هذا الأسبوع»
  من منتصف ليل السبت إلى الآن، ويُقارن بالمدّة نفسها من الأسبوع الماضي — أسبوعٌ
  بدأ أمس لا يُقاس على أسبوعٍ كامل.
*/

const DAY = 86_400_000;
const OFFSET = 3 * 3_600_000;

/** منتصفُ ليل يوم الرياض بالتوقيت العالميّ — ما يُكتب في `DailyActive.day`. */
function riyadhMidnight(at: number): Date {
  const shifted = new Date(at + OFFSET);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

const keyOf = (date: Date) => date.toISOString().slice(0, 10);

/** «٢٥/١٠» من منتصف ليلٍ بالتوقيت العالميّ. */
function dayMonth(day: Date): string {
  return `${ar(day.getUTCDate())}/${ar(day.getUTCMonth() + 1)}`;
}

/** ما يكتبه الحساب بيده — لا أسطرُ النظام (الوصول، والانضمام، والهدايا…). */
const OWN_KINDS = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "SLEEP", "WAKE"] as const;

function pct(part: number, whole: number): string {
  if (!whole) return "—";
  return `${ar(Math.round((part / whole) * 100))}٪`;
}

function Tile({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-card px-4 py-3.5">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className="text-[26px] font-bold leading-tight">{value}</p>
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

/**
 * أعمدةٌ يوميّة بلونٍ واحد: سلسلةٌ واحدة لا تحتاج مفتاحاً، والعنوانُ يسمّيها.
 * والزمنُ يجري من اليسار إلى اليمين كما يُقرأ كلُّ خطٍّ زمنيّ، والأحدثُ أغمق.
 * والمرورُ على العمود يقول يومَه وعدده (`title`) — والرقمُ مكتوبٌ فوق أعلاها وآخرِها.
 */
function Bars({
  title,
  rows,
  unit,
  every = 5,
  peak: peakName = "يوم",
}: {
  title: string;
  rows: { label: string; value: number; tip: string }[];
  unit: string;
  /** كلُّ كم عموداً يُكتب تاريخُه — والأخيرُ دائماً. */
  every?: number;
  /** ما يُسمّى به العمود في «أعلى …». */
  peak?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const peak = rows.reduce((best, row, i) => (row.value > rows[best]!.value ? i : best), 0);
  const last = rows.length - 1;
  return (
    <figure className="rounded-2xl border border-line bg-card px-4 pb-3 pt-3.5">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold">{title}</span>
        <span className="text-[11px] text-muted">
          أعلى {peakName} {ar(rows[peak]?.value ?? 0)} {unit}
        </span>
      </figcaption>
      <div dir="ltr" className="flex h-36 items-end gap-[2px]">
        {rows.map((row, i) => (
          <div
            key={row.tip}
            title={`${row.tip}: ${ar(row.value)} ${unit}`}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            {i === peak || i === last ? (
              <span className="mb-0.5 text-center text-[10px] font-semibold text-ink-2">
                {ar(row.value)}
              </span>
            ) : null}
            <div
              className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-70"
              style={{
                height: `${Math.max(row.value ? 3 : 0, (row.value / max) * 100)}%`,
                background: i === last ? "var(--color-clay-ink)" : "var(--color-clay)",
              }}
            />
          </div>
        ))}
      </div>
      <div dir="ltr" className="mt-1.5 flex gap-[2px] border-t border-line pt-1">
        {rows.map((row, i) => (
          <span key={row.tip} className="min-w-0 flex-1 text-center text-[9.5px] text-muted">
            {(last - i) % every === 0 ? row.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

type Span = { gte: Date; lt: Date };
type Period = {
  key: string;
  label: string;
  span: Span;
  /** المدّةُ نفسها من الشهر قبله — لا مقارنةَ لـ«الكل». */
  prev: Span | null;
  /** أوّلُ يومٍ وآخرُه بتوقيت الرياض كما في `DailyActive.day`. */
  firstDay: Date;
  lastDay: Date;
  /** الرسومُ بالأيّام للشهر وبالشهور للكل. */
  monthly: boolean;
};

/** بدايةُ شهر الرياض بالتوقيت العالميّ. */
const monthStartOf = (y: number, m: number) => new Date(Date.UTC(y, m, 1) - OFFSET);

/** «٢٠٢٦-١١» → الفترة، وما سواه «الكل». */
function periodOf(key: string | undefined, first: Date, now: number): Period {
  const match = key?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const from = monthStartOf(y, m);
    const end = monthStartOf(y, m + 1);
    if (from.getTime() <= now) {
      const to = new Date(Math.min(end.getTime(), now));
      const prevFrom = monthStartOf(y, m - 1);
      return {
        key: key!,
        label: `${MONTHS[m]} ${ar(y)}`,
        span: { gte: from, lt: to },
        prev: { gte: prevFrom, lt: new Date(Math.min(prevFrom.getTime() + (to.getTime() - from.getTime()), from.getTime())) },
        firstDay: new Date(Date.UTC(y, m, 1)),
        lastDay: riyadhMidnight(to.getTime() - 1),
        monthly: false,
      };
    }
  }
  return {
    key: "all",
    label: "الكل",
    span: { gte: first, lt: new Date(now) },
    prev: null,
    firstDay: riyadhMidnight(first.getTime()),
    lastDay: riyadhMidnight(now),
    monthly: true,
  };
}

/** الشهورُ من أوّل حسابٍ إلى هذا الشهر، الأحدثُ أوّلاً. */
function monthsSince(first: Date, now: number): { key: string; label: string }[] {
  const a = new Date(first.getTime() + OFFSET);
  const b = new Date(now + OFFSET);
  const out: { key: string; label: string }[] = [];
  for (let y = b.getUTCFullYear(), m = b.getUTCMonth(); y > a.getUTCFullYear() || (y === a.getUTCFullYear() && m >= a.getUTCMonth()); ) {
    out.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MONTHS[m]} ${ar(y)}` });
    if (--m < 0) {
      m = 11;
      y -= 1;
    }
    if (out.length > 120) break;
  }
  return out;
}

function Change({ now, before }: { now: number; before: number | null }) {
  if (before === null) return null;
  if (!before) return <span className="text-[11px] text-muted">لا مقارنة</span>;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  return (
    <span className="text-[11px] font-semibold" style={{ color: up ? "#2f7d4f" : "#b4443a" }}>
      {up ? "▲" : "▼"} {ar(Math.abs(change))}٪
      <span className="font-normal text-muted"> عن المدّة نفسها من الشهر قبله</span>
    </span>
  );
}

/*
  من يُعدّ مشتركاً: من له حدثُ فوترةٍ من المتجر، أو أُهدي إليه آثار+ بمال (القاعدة ٢٣٤). ومن جاءه
  من اللوحة وحدها خارجُه — المنحُ لا يُحسب في الإحصاءات.
*/

export async function AnalyticsSection({ month }: { month?: string }) {
  const now = Date.now();
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const first = firstUser?.createdAt ?? new Date(now);
  // بلا اختيارٍ فالشهرُ الجاري.
  const nowR = new Date(now + OFFSET);
  const current = `${nowR.getUTCFullYear()}-${String(nowR.getUTCMonth() + 1).padStart(2, "0")}`;
  const period = periodOf(month ?? current, first, now);
  const months = monthsSince(first, now);
  const { span, prev } = period;
  const ago = (days: number) => new Date(now - days * DAY);
  // الحقيقيُّ وحده (القاعدة ٤٩١): الاختبارُ لا يُعدّ، وما قبل التمييز لا يُخمَّن.
  const bought = (when: Span) => ({ source: "STORE", sandbox: false, createdAt: when });

  const distinctActive = (from: Date, to: Date) =>
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(DISTINCT "userId")::int AS n FROM "DailyActive"
      WHERE "day" >= ${from}::date AND "day" <= ${to}::date`.then((rows) => rows[0]?.n ?? 0);
  const prevDays = prev ? [riyadhMidnight(prev.gte.getTime()), riyadhMidnight(prev.lt.getTime() - 1)] : null;

  const [
    totalAtEnd, newUsers, newBefore, active, activeBefore, dailyAvg, cohort, cohortBack, sources, platforms,
    dau, mau, payingNow, liveStories, liveNotes,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { lt: span.lt } } }),
    prisma.user.count({ where: { createdAt: span } }),
    prev ? prisma.user.count({ where: { createdAt: prev } }) : Promise.resolve(null),
    distinctActive(period.firstDay, period.lastDay),
    prevDays ? distinctActive(prevDays[0]!, prevDays[1]!) : Promise.resolve(null),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COALESCE(AVG(c), 0)::float AS n FROM (
        SELECT COUNT(*) AS c FROM "DailyActive"
        WHERE "day" >= ${period.firstDay}::date AND "day" <= ${period.lastDay}::date GROUP BY "day"
      ) t`.then((rows) => rows[0]?.n ?? 0),
    prisma.user.count({ where: { createdAt: span } }),
    // العودة: من سجّل في الفترة وظهر بعد أسبوعٍ من تسجيله.
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "User" u
      WHERE u."createdAt" >= ${span.gte} AND u."createdAt" < ${span.lt}
        AND EXISTS (SELECT 1 FROM "DailyActive" d WHERE d."userId" = u."id"
                    AND d."day" >= ((u."createdAt" + interval '3 hours')::date + 7))`.then((rows) => rows[0]?.n ?? 0),
    prisma.$queryRaw<{ source: string; n: number }[]>`
      SELECT "source", COUNT(DISTINCT "userId")::int AS n FROM "DailyActive"
      WHERE "day" >= ${period.firstDay}::date AND "day" <= ${period.lastDay}::date GROUP BY 1`,
    prisma.$queryRaw<{ platform: string; n: number }[]>`
      SELECT "platform", COUNT(DISTINCT "userId")::int AS n FROM "DeviceToken" GROUP BY 1`,
    prisma.user.count({ where: { lastSeenAt: { gte: ago(1) } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: ago(30) } } }),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "User" u
      WHERE u."isPlus" AND u."plusUntil" > ${new Date(now)} AND (EXISTS (SELECT 1 FROM "BillingEvent" b WHERE b."appUserId" = u."id" AND b."type" <> 'NON_RENEWING_PURCHASE' AND b."sandbox" = false)
        OR EXISTS (SELECT 1 FROM "PlusGift" g WHERE g."recipientId" = u."id" AND g."status" = 'DONE'
          AND EXISTS (SELECT 1 FROM "BillingEvent" e WHERE e."id" = g."eventId" AND e."sandbox" = false)))`.then((rows) => rows[0]?.n ?? 0),
    prisma.story.count({ where: { expiresAt: { gt: new Date(now) } } }),
    prisma.statusNote.count({ where: { expiresAt: { gt: new Date(now) } } }),
  ]);

  const subscribers = (type: string, at: Span) =>
    prisma.billingEvent
      .findMany({ where: { type, at, sandbox: false }, distinct: ["appUserId"], select: { appUserId: true } })
      .then((rows) => rows.length);
  const gifted = (doneAt: Span) =>
    prisma.plusGift
      .findMany({ where: { status: "DONE", doneAt }, distinct: ["recipientId"], select: { recipientId: true, eventId: true } })
      .then(async (rows) => {
        const ids = rows.map((row) => row.eventId).filter((id): id is string => Boolean(id));
        const real = new Set(
          (await prisma.billingEvent.findMany({ where: { id: { in: ids }, sandbox: false }, select: { id: true } })).map((row) => row.id),
        );
        return rows.filter((row) => row.eventId && real.has(row.eventId)).length;
      });
  const ended = (at: Span) =>
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "User" u
      WHERE u."plusEndedAt" >= ${at.gte} AND u."plusEndedAt" < ${at.lt} AND (EXISTS (SELECT 1 FROM "BillingEvent" b WHERE b."appUserId" = u."id" AND b."type" <> 'NON_RENEWING_PURCHASE' AND b."sandbox" = false)
        OR EXISTS (SELECT 1 FROM "PlusGift" g WHERE g."recipientId" = u."id" AND g."status" = 'DONE'
          AND EXISTS (SELECT 1 FROM "BillingEvent" e WHERE e."id" = g."eventId" AND e."sandbox" = false)))`.then((rows) => rows[0]?.n ?? 0);
  const activityOf = (when: Span) =>
    Promise.all([
      prisma.moment.count({ where: { createdAt: when, kind: { in: [...OWN_KINDS] } } }),
      prisma.reaction.count({ where: { createdAt: when } }),
      prisma.comment.count({ where: { createdAt: when } }),
      prisma.message.count({ where: { createdAt: when } }),
      prisma.story.count({ where: { createdAt: when } }),
      prisma.purchase.count({ where: { createdAt: when } }),
      prisma.friendship.count({ where: { acceptedAt: when, follow: false } }),
    ]);
  const ACTIVITY = ["لحظات", "تفاعلات", "تعليقات", "رسائل", "قصص", "مشتريات المتجر", "صداقات جديدة"];

  const [subsNow, subsBefore, giftsNow, giftsBefore, renewals, endedNow, endedBefore, actNow, actBefore, packs, coinsNow, coinsBefore, buyers] =
    await Promise.all([
      subscribers("INITIAL_PURCHASE", span),
      prev ? subscribers("INITIAL_PURCHASE", prev) : Promise.resolve(null),
      gifted(span),
      prev ? gifted(prev) : Promise.resolve(null),
      subscribers("RENEWAL", span),
      ended(span),
      prev ? ended(prev) : Promise.resolve(null),
      activityOf(span),
      prev ? activityOf(prev) : Promise.resolve(null),
      /*
        شراءُ النقاط: ما أودعه حدثُ المتجر وحده (`source = STORE`) — لا منحُ اللوحة ولا
        رصيدُ آثار+. والمبلغُ ما دفعه المشتري قبل حصّة آبل، بعملة شرائه.
      */
      prisma.coinPack.findMany({
        orderBy: [{ sortOrder: "asc" }, { coins: "asc" }],
        select: { id: true, name: true, coins: true, hidden: true },
      }),
      prisma.coinTopUp.groupBy({ by: ["packId"], where: bought(span), _count: { _all: true }, _sum: { coins: true, paidHalalas: true } }),
      prev
        ? prisma.coinTopUp.groupBy({ by: ["packId"], where: bought(prev), _count: { _all: true }, _sum: { coins: true, paidHalalas: true } })
        : Promise.resolve([]),
      prisma.coinTopUp.findMany({ where: bought(span), distinct: ["userId"], select: { userId: true } }),
    ]);

  // ما قبل التمييز (القاعدة ٤٩١): يُقال عددُه ولا يُعدّ.
  const [unknownTopUps, unknownEvents, recent] = await Promise.all([
    prisma.coinTopUp.count({ where: { source: "STORE", sandbox: null, createdAt: span } }),
    prisma.billingEvent.count({ where: { sandbox: null, at: span, type: { not: "NON_RENEWING_PURCHASE" } } }),
    recentSales(),
  ]);

  // الرسوم: أيّامُ الشهر، أو شهورُ الكل.
  const fmt = period.monthly ? "YYYY-MM" : "YYYY-MM-DD";
  const [daily, signups, coinSeries] = await Promise.all([
    period.monthly
      ? prisma.$queryRaw<{ k: string; n: number }[]>`
          SELECT to_char("day", 'YYYY-MM') AS k, COUNT(DISTINCT "userId")::int AS n
          FROM "DailyActive" WHERE "day" >= ${period.firstDay}::date AND "day" <= ${period.lastDay}::date GROUP BY 1`
      : prisma.$queryRaw<{ k: string; n: number }[]>`
          SELECT to_char("day", 'YYYY-MM-DD') AS k, COUNT(*)::int AS n
          FROM "DailyActive" WHERE "day" >= ${period.firstDay}::date AND "day" <= ${period.lastDay}::date GROUP BY 1`,
    prisma.$queryRaw<{ k: string; n: number }[]>`
      SELECT to_char(("createdAt" + interval '3 hours'), ${fmt}) AS k, COUNT(*)::int AS n
      FROM "User" WHERE "createdAt" >= ${span.gte} AND "createdAt" < ${span.lt} GROUP BY 1`,
    prisma.$queryRaw<{ k: string; n: number }[]>`
      SELECT to_char(("createdAt" + interval '3 hours'), ${fmt}) AS k, COALESCE(SUM("coins"), 0)::int AS n
      FROM "CoinTopUp" WHERE "source" = 'STORE' AND "sandbox" = false AND "createdAt" >= ${span.gte} AND "createdAt" < ${span.lt} GROUP BY 1`,
  ]);
  const slots: { k: string; label: string; tip: string }[] = period.monthly
    ? [...months].reverse().map((one) => ({ k: one.key, label: one.label.split(" ")[0]!.slice(0, 3), tip: one.label }))
    : Array.from(
        { length: Math.round((period.lastDay.getTime() - period.firstDay.getTime()) / DAY) + 1 },
        (_, i) => {
          const day = new Date(period.firstDay.getTime() + i * DAY);
          return { k: keyOf(day), label: ar(day.getUTCDate()), tip: dayMonth(day) };
        },
      );
  const seriesOf = (rows: { k: string; n: number }[]) => {
    const byKey = new Map(rows.map((row) => [row.k, row.n]));
    return slots.map((slot) => ({ label: slot.label, tip: slot.tip, value: byKey.get(slot.k) ?? 0 }));
  };
  const unitName = period.monthly ? "شهر" : "يوم";

  const source = (name: string) => sources.find((row) => row.source === name)?.n ?? 0;
  const platform = (name: string) => platforms.find((row) => row.platform === name)?.n ?? 0;

  type Sale = { count: number; coins: number; paid: number };
  const tally = (rows: typeof coinsNow) => {
    const byPack = new Map<string | null, Sale>(
      rows.map((row) => [row.packId, { count: row._count._all, coins: row._sum.coins ?? 0, paid: row._sum.paidHalalas ?? 0 }]),
    );
    const sum = [...byPack.values()].reduce(
      (all, one) => ({ count: all.count + one.count, coins: all.coins + one.coins, paid: all.paid + one.paid }),
      { count: 0, coins: 0, paid: 0 },
    );
    return { byPack, sum };
  };
  const salesNow = tally(coinsNow);
  const salesBefore = tally(coinsBefore);
  const EMPTY: Sale = { count: 0, coins: 0, paid: 0 };
  const packRows = [
    ...packs
      .filter((pack) => !pack.hidden || salesNow.byPack.has(pack.id) || salesBefore.byPack.has(pack.id))
      .map((pack) => ({
        key: pack.id,
        name: pack.name,
        coins: pack.coins,
        now: salesNow.byPack.get(pack.id) ?? EMPTY,
        before: salesBefore.byPack.get(pack.id) ?? EMPTY,
      })),
    ...(salesNow.byPack.has(null) || salesBefore.byPack.has(null)
      ? [{ key: "gone", name: "باقة محذوفة", coins: 0, now: salesNow.byPack.get(null) ?? EMPTY, before: salesBefore.byPack.get(null) ?? EMPTY }]
      : []),
  ];
  const inPeriod = period.key === "all" ? "منذ البداية" : `في ${period.label}`;

  return (
    <div className="flex flex-col gap-5">
      {/* الفترة: كلُّ ما تحتها يتبعها (القاعدة ٤٧٨). */}
      <nav aria-label="الفترة" className="no-bar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {[{ key: "all", label: "الكل" }, ...months].map((one) => {
          const on = one.key === period.key;
          return (
            <Link
              key={one.key}
              href={`/admin?s=analytics&m=${one.key}`}
              aria-current={on ? "page" : undefined}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
              style={{
                background: on ? "var(--color-chrome)" : "var(--color-card)",
                color: on ? "#fff" : "var(--color-ink-2)",
                border: `1px solid ${on ? "var(--color-chrome)" : "var(--color-line)"}`,
              }}
            >
              {one.label}
            </Link>
          );
        })}
      </nav>

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">الآن</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="نشطون آخر ٢٤ ساعة" value={ar(dau)} />
          <Tile label="نشطون آخر ٣٠ يوماً" value={ar(mau)} hint={`الالتصاق ${pct(dau, mau)} (يومي ÷ شهري)`} />
          <Tile label="مشتركون يدفعون الآن" value={ar(payingNow)} hint="من المتجر أو بهدية — بلا منح اللوحة" />
          <Tile label="قصص ونوت حيّة" value={`${ar(liveStories)} · ${ar(liveNotes)}`} hint="قصة · نوت" />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">المستخدمون {inPeriod}</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label={period.key === "all" ? "كل المستخدمين" : "المستخدمون في آخر الفترة"} value={ar(totalAtEnd)} />
          <Tile label="مستخدمون جدد" value={ar(newUsers)}>
            <Change now={newUsers} before={newBefore} />
          </Tile>
          <Tile label="نشطون" value={ar(active)} hint={`${pct(active, totalAtEnd)} من المستخدمين`}>
            <Change now={active} before={activeBefore} />
          </Tile>
          <Tile label="متوسّط النشطين يومياً" value={ar(Math.round(dailyAvg))} hint={`${pct(Math.round(dailyAvg), active)} من نشطي الفترة كلَّ يوم`} />
          <Tile label="العودة بعد أسبوع" value={pct(cohortBack, cohort)} hint={`${ar(cohortBack)} من ${ar(cohort)} سجّلوا وظهروا بعد أسبوعٍ من تسجيلهم`} />
          <Tile
            label="من أين نشطوا"
            value={`${ar(source("app"))} تطبيق`}
            hint={`${ar(source("web"))} ويب · أجهزة: ${ar(platform("ios"))} آيفون، ${ar(platform("android"))} أندرويد، ${ar(platform("huawei"))} هواوي`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">آثار+ {inPeriod}</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="مشتركون جدد" value={ar(subsNow + giftsNow)} hint={`${ar(subsNow)} من المتجر و${ar(giftsNow)} هدية من صديق — كلُّ حسابٍ مرّة`}>
            <Change now={subsNow + giftsNow} before={subsBefore === null ? null : subsBefore + (giftsBefore ?? 0)} />
          </Tile>
          <Tile label="تجديدات" value={ar(renewals)} hint="تجديدٌ تلقائيّ — كلُّ حسابٍ مرّة" />
          <Tile label="انتهى اشتراكهم" value={ar(endedNow)}>
            <Change now={endedNow} before={endedBefore} />
          </Tile>
          <Tile label="مشتركون يدفعون الآن" value={ar(payingNow)} hint="منحُ اللوحة لا يُحسب" />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">شراء النقاط {inPeriod}</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="عمليات الشراء" value={ar(salesNow.sum.count)}>
            <Change now={salesNow.sum.count} before={prev ? salesBefore.sum.count : null} />
          </Tile>
          <Tile label="المشترون" value={ar(buyers.length)} hint="كلُّ حسابٍ مرّةً مهما اشترى" />
          <Tile label="النقاط المُشتراة" value={ar(salesNow.sum.coins)} hint="منحُ اللوحة ورصيدُ آثار+ لا يُحسبان" />
          <Tile label="المدفوع" value={riyals(salesNow.sum.paid)} hint="قبل حصّة المتجر">
            <Change now={salesNow.sum.paid} before={prev ? salesBefore.sum.paid : null} />
          </Tile>
        </div>
        <figure className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card px-4 py-3.5">
          <figcaption className="mb-2 text-[13px] font-bold">حسب الباقة</figcaption>
          <table className="w-full min-w-[420px] text-[12.5px]">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="py-1 text-start font-normal">الباقة</th>
                <th className="py-1 text-start font-normal">العمليات</th>
                <th className="py-1 text-start font-normal">النقاط</th>
                <th className="py-1 text-start font-normal">المدفوع</th>
                {prev ? <th className="py-1 text-start font-normal">الشهر قبله</th> : null}
              </tr>
            </thead>
            <tbody>
              {packRows.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  <td className="py-1.5">
                    {row.name}
                    {row.coins && !row.name.includes(ar(row.coins)) && !row.name.includes(String(row.coins)) ? (
                      <span className="text-muted"> · {ar(row.coins)} نقطة</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 font-bold">{ar(row.now.count)}</td>
                  <td className="py-1.5">{ar(row.now.coins)}</td>
                  <td className="py-1.5">{riyals(row.now.paid)}</td>
                  {prev ? <td className="py-1.5 text-muted">{ar(row.before.count)}</td> : null}
                </tr>
              ))}
              {packRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-2 text-muted">لا باقات بعد.</td>
                </tr>
              ) : null}
              <tr className="border-t border-line font-bold">
                <td className="py-1.5">المجموع</td>
                <td className="py-1.5">{ar(salesNow.sum.count)}</td>
                <td className="py-1.5">{ar(salesNow.sum.coins)}</td>
                <td className="py-1.5">{riyals(salesNow.sum.paid)}</td>
                {prev ? <td className="py-1.5 font-normal text-muted">{ar(salesBefore.sum.count)}</td> : null}
              </tr>
            </tbody>
          </table>
        </figure>
      </section>

      <RecentSales rows={recent} />

      <section className="grid gap-3 lg:grid-cols-2">
        <Bars
          title={period.monthly ? "النشطون شهرياً" : `النشطون يومياً — ${period.label}`}
          rows={seriesOf(daily)}
          unit="مستخدم"
          every={period.monthly ? 1 : 3}
          peak={unitName}
        />
        <Bars
          title={period.monthly ? "التسجيلات شهرياً" : `التسجيلات يومياً — ${period.label}`}
          rows={seriesOf(signups)}
          unit="تسجيل"
          every={period.monthly ? 1 : 3}
          peak={unitName}
        />
        <Bars
          title={period.monthly ? "النقاط المُشتراة شهرياً" : `النقاط المُشتراة يومياً — ${period.label}`}
          rows={seriesOf(coinSeries)}
          unit="نقطة"
          every={period.monthly ? 1 : 3}
          peak={unitName}
        />
        <figure className="rounded-2xl border border-line bg-card px-4 py-3.5">
          <figcaption className="mb-2 text-[13px] font-bold">النشاط {inPeriod}</figcaption>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="py-1 text-start font-normal">الفعل</th>
                <th className="py-1 text-start font-normal">{period.key === "all" ? "الكل" : "الشهر"}</th>
                {actBefore ? (
                  <>
                    <th className="py-1 text-start font-normal">قبله</th>
                    <th className="py-1 text-start font-normal">التغيّر</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {ACTIVITY.map((label, i) => {
                const a = actNow[i] ?? 0;
                const b = actBefore ? (actBefore[i] ?? 0) : null;
                return (
                  <tr key={label} className="border-t border-line">
                    <td className="py-1.5">{label}</td>
                    <td className="py-1.5 font-bold">{ar(a)}</td>
                    {b !== null ? (
                      <>
                        <td className="py-1.5 text-muted">{ar(b)}</td>
                        <td className="py-1.5">
                          {b ? (
                            <span style={{ color: a >= b ? "#2f7d4f" : "#b4443a" }}>
                              {a >= b ? "▲" : "▼"} {ar(Math.abs(Math.round(((a - b) / b) * 100)))}٪
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </figure>
      </section>

      <p className="text-[11px] leading-relaxed text-muted">
        «نشط» من فتح التطبيق أو الموقع وهو داخلٌ بحسابه. الأيّامُ والشهورُ بتوقيت الرياض، والشهرُ الجاري
        يُقارن بالمدّة نفسها من الشهر قبله. منحُ اللوحة لا يُحسب: لا النقاطُ الممنوحة ولا آثار+ الممنوح.
        وما قبل بدء سجلّ الأيّام تقريبٌ، فأعمدتُه قد تكون أقصر من الحقيقة. والمدفوعُ بعملة الشراء قبل حصّة
        المتجر. ومشترياتُ الاختبار (Sandbox) لا تُعدّ، وما سبق تمييزَها لا يُعرف أحقيقيٌّ هو أم
        اختبار فلا يُعدّ أيضاً{unknownTopUps + unknownEvents > 0
          ? ` — ${ar(unknownTopUps)} شراءَ نقاطٍ و${ar(unknownEvents)} حدثَ اشتراكٍ ${inPeriod} خارجَ العدّ لهذا السبب`
          : ""}.
      </p>
    </div>
  );
}


// ─────────────── آخرُ عشر عمليات شراءٍ واشتراك (القاعدة ٤٩١) ───────────────

type SaleRow = {
  key: string;
  at: Date;
  user: { id: string; name: string; memberNo: number } | null;
  what: string;
  detail: string;
  /** `null` = قبل التمييز: لا يُعرف أحقيقيٌّ هو أم اختبار. */
  sandbox: boolean | null;
};

const SUB_TYPES: Record<string, string> = {
  INITIAL_PURCHASE: "اشتراك آثار+",
  RENEWAL: "تجديد آثار+",
  PRODUCT_CHANGE: "تغيير باقة آثار+",
  UNCANCELLATION: "أعاد تفعيل التجديد",
};

/** شراءُ النقاط، والاشتراكُ وتجديدُه، وهديّةُ آثار+ — الحقيقيُّ وما قبل التمييز، بلا الاختبار. */
async function recentSales(): Promise<SaleRow[]> {
  const notTest = { OR: [{ sandbox: false }, { sandbox: null }] };
  const userSelect = { id: true, name: true, memberNo: true } as const;
  const [coins, events, gifts] = await Promise.all([
    prisma.coinTopUp.findMany({
      where: { source: "STORE", ...notTest },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, coins: true, paidHalalas: true, createdAt: true, sandbox: true,
        user: { select: userSelect }, pack: { select: { name: true } },
      },
    }),
    prisma.billingEvent.findMany({
      where: { type: { in: Object.keys(SUB_TYPES) }, ...notTest },
      orderBy: { at: "desc" },
      take: 10,
      select: { id: true, type: true, at: true, appUserId: true, sandbox: true, productId: true },
    }),
    prisma.plusGift.findMany({
      where: { status: "DONE" },
      orderBy: { doneAt: "desc" },
      take: 10,
      select: {
        id: true, plan: true, doneAt: true, eventId: true,
        giver: { select: userSelect }, recipient: { select: { name: true } },
      },
    }),
  ]);

  const people = new Map(
    (await prisma.user.findMany({ where: { id: { in: events.map((row) => row.appUserId) } }, select: userSelect })).map(
      (one) => [one.id, one],
    ),
  );
  const giftEvents = new Map(
    (
      await prisma.billingEvent.findMany({
        where: { id: { in: gifts.map((row) => row.eventId).filter((id): id is string => Boolean(id)) } },
        select: { id: true, sandbox: true },
      })
    ).map((row) => [row.id, row.sandbox]),
  );

  const rows: SaleRow[] = [
    ...coins.map((row) => ({
      key: `c-${row.id}`,
      at: row.createdAt,
      user: row.user,
      what: "شراء نقاط",
      detail: `${row.pack?.name ?? "باقة محذوفة"} · ${ar(row.coins)} نقطة · ${riyals(row.paidHalalas)}`,
      sandbox: row.sandbox,
    })),
    ...events.map((row) => ({
      key: `e-${row.id}`,
      at: row.at,
      user: people.get(row.appUserId) ?? null,
      what: SUB_TYPES[row.type] ?? row.type,
      detail: row.productId ? planName(row.productId) : "",
      sandbox: row.sandbox,
    })),
    ...gifts
      .map((row) => ({
        key: `g-${row.id}`,
        at: row.doneAt ?? new Date(0),
        user: row.giver,
        what: "إهداء آثار+",
        detail: `${row.plan === "year" ? "سنة" : "شهر"} لـ${row.recipient.name}`,
        sandbox: row.eventId ? (giftEvents.get(row.eventId) ?? null) : null,
      }))
      .filter((row) => row.sandbox !== true),
  ];
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 10);
}

/** معرّفُ المنتج كما يُقرأ: شهريٌّ أو سنويّ، وإلّا المعرّفُ نفسُه. */
function planName(sku: string): string {
  if (/year|annual/i.test(sku)) return "سنوي";
  if (/month/i.test(sku)) return "شهري";
  return sku;
}

function RecentSales({ rows }: { rows: SaleRow[] }) {
  const stamp = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", {
    timeZone: "Asia/Riyadh",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <section>
      <h2 className="mb-2.5 text-[15px] font-bold">آخر عمليات الشراء والاشتراك</h2>
      <figure className="overflow-x-auto rounded-2xl border border-line bg-card px-4 py-3.5">
        <table className="w-full min-w-[520px] text-[12.5px]">
          <thead>
            <tr className="text-[11px] text-muted">
              <th className="py-1 text-start font-normal">الوقت</th>
              <th className="py-1 text-start font-normal">الحساب</th>
              <th className="py-1 text-start font-normal">العملية</th>
              <th className="py-1 text-start font-normal">التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line">
                <td className="whitespace-nowrap py-1.5 text-muted">{stamp.format(row.at)}</td>
                <td className="py-1.5">
                  {row.user ? (
                    <Link href={`/admin/u/${row.user.id}`} className="font-semibold hover:underline" dir="auto">
                      {row.user.name}
                      <span className="font-normal text-muted"> · {ar(row.user.memberNo)}</span>
                    </Link>
                  ) : (
                    <span className="text-muted">حساب غير معروف</span>
                  )}
                </td>
                <td className="py-1.5 font-bold">
                  {row.what}
                  {row.sandbox === null ? (
                    <span className="ms-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}>
                      قبل التمييز
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 text-ink-2">{row.detail}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-2 text-muted">لا عمليات حقيقيّة بعد.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </figure>
    </section>
  );
}
