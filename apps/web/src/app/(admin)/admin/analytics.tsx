import { prisma } from "@/lib/db";
import { ar, riyals } from "@/lib/format";

/*
  لوحةُ التحليلات (القاعدة ٣٠٧): من يستعمل التطبيق، وكم يعود، وماذا يفعل.

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

/** الفرقُ عن الأسبوع الماضي: سهمٌ ونسبة، والرمادي حين لا أساسَ يُقاس عليه. */
function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-[11px] text-muted">لا مقارنة</span>;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  return (
    <span className="text-[11px] font-semibold" style={{ color: up ? "#2f7d4f" : "#b4443a" }}>
      {up ? "▲" : "▼"} {ar(Math.abs(change))}٪
      <span className="font-normal text-muted"> عن الفترة نفسها من الأسبوع الماضي</span>
    </span>
  );
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

export async function AnalyticsSection() {
  const now = Date.now();
  const today = riyadhMidnight(now);
  const since30 = new Date(today.getTime() - 29 * DAY);
  const ago = (days: number) => new Date(now - days * DAY);
  // السبتُ الأخير بتوقيت الرياض: `getUTCDay` على الوقت المُزاح يومُ الرياض (السبت ٦).
  const sinceSaturday = (new Date(now + OFFSET).getUTCDay() + 1) % 7;
  const weekDay = new Date(today.getTime() - sinceSaturday * DAY);
  const weekStart = new Date(weekDay.getTime() - OFFSET);
  const week = { gte: weekStart };
  // المدّةُ نفسها من الأسبوع الماضي: من سبته إلى مثل هذه الساعة.
  const lastWeek = { gte: new Date(weekStart.getTime() - 7 * DAY), lt: ago(7) };
  const lastWeekFull = { gte: new Date(weekStart.getTime() - 7 * DAY), lt: weekStart };
  const lastWeekDay = new Date(weekDay.getTime() - 7 * DAY);
  const yesterdayLastWeek = new Date(today.getTime() - 7 * DAY);
  const bought = (when: object) => ({ source: "STORE", createdAt: when });

  const [
    total, newWeek, newLastWeek, dau, wau, wauBefore, mau, plus,
    cohort, cohortBack, daily, signups, weekly, sources, platforms, liveStories, liveNotes,
    activity, packs, coinsNow, coinsBefore, buyers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: week } }),
    prisma.user.count({ where: { createdAt: lastWeek } }),
    prisma.user.count({ where: { lastSeenAt: { gte: ago(1) } } }),
    prisma.user.count({ where: { lastSeenAt: week } }),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(DISTINCT "userId")::int AS n FROM "DailyActive"
      WHERE "day" >= ${lastWeekDay}::date AND "day" <= ${yesterdayLastWeek}::date`,
    prisma.user.count({ where: { lastSeenAt: { gte: ago(30) } } }),
    prisma.user.count({ where: { isPlus: true, plusUntil: { gt: new Date(now) } } }),
    // العودة: من سجّل الأسبوعَ الماضي (السبت إلى الجمعة)، كم منهم ظهر هذا الأسبوع.
    prisma.user.count({ where: { createdAt: lastWeekFull } }),
    prisma.user.count({ where: { createdAt: lastWeekFull, lastSeenAt: week } }),
    prisma.$queryRaw<{ day: Date; n: number }[]>`
      SELECT "day", COUNT(*)::int AS n FROM "DailyActive"
      WHERE "day" >= ${since30}::date GROUP BY "day"`,
    prisma.$queryRaw<{ day: Date; n: number }[]>`
      SELECT (("createdAt" + interval '3 hours')::date) AS day, COUNT(*)::int AS n FROM "User"
      WHERE "createdAt" >= ${new Date(since30.getTime() - OFFSET)} GROUP BY 1`,
    // النشطون في كل أسبوعٍ من الثمانية الأخيرة — من السبت، وكلُّ حسابٍ مرّةً في أسبوعه.
    prisma.$queryRaw<{ w: number; n: number }[]>`
      SELECT ((${weekDay}::date + 6 - "day") / 7)::int AS w, COUNT(DISTINCT "userId")::int AS n
      FROM "DailyActive" WHERE "day" >= ${weekDay}::date - 49 GROUP BY 1`,
    prisma.$queryRaw<{ source: string; n: number }[]>`
      SELECT "source", COUNT(DISTINCT "userId")::int AS n FROM "DailyActive"
      WHERE "day" >= ${weekDay}::date GROUP BY 1`,
    prisma.$queryRaw<{ platform: string; n: number }[]>`
      SELECT "platform", COUNT(DISTINCT "userId")::int AS n FROM "DeviceToken" GROUP BY 1`,
    prisma.story.count({ where: { expiresAt: { gt: new Date(now) } } }),
    prisma.statusNote.count({ where: { expiresAt: { gt: new Date(now) } } }),
    Promise.all(
      (
        [
          ["لحظات", (when: object) => prisma.moment.count({ where: { createdAt: when, kind: { in: [...OWN_KINDS] } } })],
          ["تفاعلات", (when: object) => prisma.reaction.count({ where: { createdAt: when } })],
          ["تعليقات", (when: object) => prisma.comment.count({ where: { createdAt: when } })],
          ["رسائل", (when: object) => prisma.message.count({ where: { createdAt: when } })],
          ["مشتريات المتجر", (when: object) => prisma.purchase.count({ where: { createdAt: when } })],
          ["صداقات جديدة", (when: object) => prisma.friendship.count({ where: { acceptedAt: when, follow: false } })],
        ] as const
      ).map(async ([label, count]) => ({
        label,
        now: await count(week),
        before: await count(lastWeek),
      })),
    ),
    /*
      شراءُ النقاط: ما أودعه حدثُ المتجر وحده (`source = STORE`) — لا منحُ اللوحة ولا
      رصيدُ آثار+. والمبلغُ ما دفعه المشتري قبل حصّة آبل، بعملة شرائه.
    */
    prisma.coinPack.findMany({
      orderBy: [{ sortOrder: "asc" }, { coins: "asc" }],
      select: { id: true, name: true, coins: true, hidden: true },
    }),
    prisma.coinTopUp.groupBy({
      by: ["packId"],
      where: bought(week),
      _count: { _all: true },
      _sum: { coins: true, paidHalalas: true },
    }),
    prisma.coinTopUp.groupBy({
      by: ["packId"],
      where: bought(lastWeek),
      _count: { _all: true },
      _sum: { coins: true, paidHalalas: true },
    }),
    prisma.coinTopUp.findMany({ where: bought(week), distinct: ["userId"], select: { userId: true } }),
  ]);

  // آثار+ هذا الشهر: من أوّله بتوقيت الرياض، ويُقارن بالمدّة نفسها من الشهر الماضي.
  const riyadhNow = new Date(now + OFFSET);
  const monthStart = new Date(Date.UTC(riyadhNow.getUTCFullYear(), riyadhNow.getUTCMonth(), 1) - OFFSET);
  const lastMonthStart = new Date(Date.UTC(riyadhNow.getUTCFullYear(), riyadhNow.getUTCMonth() - 1, 1) - OFFSET);
  const month = { gte: monthStart };
  const lastMonth = {
    gte: lastMonthStart,
    lt: new Date(Math.min(lastMonthStart.getTime() + (now - monthStart.getTime()), monthStart.getTime())),
  };
  // المشتركون من المتجر حسابٌ لا حدث: من اشترى ثمّ أعاد الشراء يُعدّ مرّة.
  const subscribers = (type: string, at: { gte: Date; lt?: Date }) =>
    prisma.billingEvent
      .findMany({ where: { type, at }, distinct: ["appUserId"], select: { appUserId: true } })
      .then((rows) => rows.length);
  const granted = (createdAt: { gte: Date; lt?: Date }) =>
    prisma.moderationLog
      .findMany({ where: { action: "PLUS_GRANTED", createdAt }, distinct: ["ownerId"], select: { ownerId: true } })
      .then((rows) => rows.length);
  const [subsNow, subsBefore, renewals, grantsNow, grantsBefore, endedNow, endedBefore] = await Promise.all([
    subscribers("INITIAL_PURCHASE", month),
    subscribers("INITIAL_PURCHASE", lastMonth),
    subscribers("RENEWAL", month),
    granted(month),
    granted(lastMonth),
    prisma.user.count({ where: { plusEndedAt: month } }),
    prisma.user.count({ where: { plusEndedAt: lastMonth } }),
  ]);

  const series = (rows: { day: Date; n: number }[]) => {
    const byDay = new Map(rows.map((row) => [keyOf(new Date(row.day)), row.n]));
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(since30.getTime() + i * DAY);
      return { label: dayMonth(day), tip: dayMonth(day), value: byDay.get(keyOf(day)) ?? 0 };
    });
  };
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const back = 7 - i;
    const value = weekly.find((row) => row.w === back)?.n ?? 0;
    const from = dayMonth(new Date(weekDay.getTime() - back * 7 * DAY));
    return {
      label: back === 0 ? "هذا" : from,
      tip: back === 0 ? `هذا الأسبوع (من السبت ${from})` : `أسبوع السبت ${from}`,
      value,
    };
  });
  const source = (name: string) => sources.find((row) => row.source === name)?.n ?? 0;
  const platform = (name: string) => platforms.find((row) => row.platform === name)?.n ?? 0;

  type Sale = { count: number; coins: number; paid: number };
  const tally = (rows: typeof coinsNow) => {
    const byPack = new Map<string | null, Sale>(
      rows.map((row) => [
        row.packId,
        { count: row._count._all, coins: row._sum.coins ?? 0, paid: row._sum.paidHalalas ?? 0 },
      ]),
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
  // الظاهرةُ كلُّها ولو لم تُبع، والمخفيّةُ إن بيعت، وباقةٌ حُذفت بعد بيعها سطرٌ وحده.
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
      ? [{
          key: "gone",
          name: "باقة محذوفة",
          coins: 0,
          now: salesNow.byPack.get(null) ?? EMPTY,
          before: salesBefore.byPack.get(null) ?? EMPTY,
        }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12px] text-muted">
        هذا الأسبوع من السبت {dayMonth(weekDay)} حتى الآن، ويُقارن بالفترة نفسها من الأسبوع الماضي.
      </p>

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">المستخدمون</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="كل المستخدمين" value={ar(total)} hint={`${pct(plus, total)} منهم مشتركون في آثار+`} />
          <Tile label="مستخدمون جدد هذا الأسبوع" value={ar(newWeek)} hint={`${ar(newLastWeek)} في الفترة نفسها الماضية`}>
            <Delta now={newWeek} before={newLastWeek} />
          </Tile>
          <Tile label="نشطون هذا الأسبوع" value={ar(wau)} hint={`${pct(wau, total)} من الكل`}>
            <Delta now={wau} before={wauBefore[0]?.n ?? 0} />
          </Tile>
          <Tile label="نشطون آخر ٢٤ ساعة" value={ar(dau)} hint={`${pct(dau, total)} من الكل`} />
          <Tile label="نشطون آخر ٣٠ يوماً" value={ar(mau)} hint={`${pct(mau, total)} من الكل`} />
          <Tile
            label="الالتصاق (يومي ÷ شهري)"
            value={pct(dau, mau)}
            hint="كم من نشطي الشهر يفتحه كل يوم"
          />
          <Tile
            label="العودة بعد أسبوع"
            value={pct(cohortBack, cohort)}
            hint={`${ar(cohortBack)} من ${ar(cohort)} سجّلوا الأسبوع الماضي وظهروا هذا الأسبوع`}
          />
          <Tile
            label="من أين نشطوا هذا الأسبوع"
            value={`${ar(source("app"))} تطبيق`}
            hint={`${ar(source("web"))} ويب · أجهزة: ${ar(platform("ios"))} آيفون، ${ar(platform("android"))} أندرويد`}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">آثار+ هذا الشهر</h2>
        <p className="mb-2.5 text-[12px] text-muted">
          من {dayMonth(new Date(monthStart.getTime() + OFFSET))} حتى الآن، ويُقارن بالمدّة نفسها من الشهر الماضي.
        </p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Tile label="مشتركون جدد" value={ar(subsNow)} hint="اشتراكٌ أوّل من المتجر — كلُّ حسابٍ مرّة">
            <Delta now={subsNow} before={subsBefore} />
          </Tile>
          <Tile label="جدّدوا" value={ar(renewals)} hint="تجديدٌ تلقائيّ هذا الشهر" />
          <Tile label="مُنحوا من اللوحة" value={ar(grantsNow)}>
            <Delta now={grantsNow} before={grantsBefore} />
          </Tile>
          <Tile label="انتهى اشتراكهم" value={ar(endedNow)} hint={`${ar(endedBefore)} في الفترة نفسها الماضية`} />
          <Tile label="مشتركون الآن" value={ar(plus)} hint={`${pct(plus, total)} من الكل`} />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">شراء النقاط هذا الأسبوع</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="عمليات الشراء" value={ar(salesNow.sum.count)}>
            <Delta now={salesNow.sum.count} before={salesBefore.sum.count} />
          </Tile>
          <Tile label="المشترون" value={ar(buyers.length)} hint="كلُّ حسابٍ مرّةً مهما اشترى" />
          <Tile label="النقاط المُشتراة" value={ar(salesNow.sum.coins)} />
          <Tile label="المدفوع" value={riyals(salesNow.sum.paid)} hint="قبل حصّة آبل">
            <Delta now={salesNow.sum.paid} before={salesBefore.sum.paid} />
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
                <th className="py-1 text-start font-normal">الماضي</th>
              </tr>
            </thead>
            <tbody>
              {packRows.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  <td className="py-1.5">
                    {row.name}
                    {/* «٥٠٠ نقطة · ٥٠٠ نقطة» حين يكون العددُ في الاسم نفسه. */}
                    {row.coins && !row.name.includes(ar(row.coins)) && !row.name.includes(String(row.coins)) ? (
                      <span className="text-muted"> · {ar(row.coins)} نقطة</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 font-bold">{ar(row.now.count)}</td>
                  <td className="py-1.5">{ar(row.now.coins)}</td>
                  <td className="py-1.5">{riyals(row.now.paid)}</td>
                  <td className="py-1.5 text-muted">{ar(row.before.count)}</td>
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
                <td className="py-1.5 font-normal text-muted">{ar(salesBefore.sum.count)}</td>
              </tr>
            </tbody>
          </table>
        </figure>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Bars title="النشطون يومياً — آخر ٣٠ يوماً" rows={series(daily)} unit="مستخدم" />
        <Bars title="التسجيلات يومياً — آخر ٣٠ يوماً" rows={series(signups)} unit="تسجيل" />
        <Bars title="النشطون أسبوعياً (من السبت) — آخر ٨ أسابيع" rows={weeks} unit="مستخدم" every={1} peak="أسبوع" />
        <figure className="rounded-2xl border border-line bg-card px-4 py-3.5">
          <figcaption className="mb-2 text-[13px] font-bold">النشاط هذا الأسبوع</figcaption>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="py-1 text-start font-normal">الفعل</th>
                <th className="py-1 text-start font-normal">هذا الأسبوع</th>
                <th className="py-1 text-start font-normal">الماضي</th>
                <th className="py-1 text-start font-normal">التغيّر</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <td className="py-1.5">{row.label}</td>
                  <td className="py-1.5 font-bold">{ar(row.now)}</td>
                  <td className="py-1.5 text-muted">{ar(row.before)}</td>
                  <td className="py-1.5">
                    {row.before ? (
                      <span style={{ color: row.now >= row.before ? "#2f7d4f" : "#b4443a" }}>
                        {row.now >= row.before ? "▲" : "▼"}{" "}
                        {ar(Math.abs(Math.round(((row.now - row.before) / row.before) * 100)))}٪
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-1.5">قصص ونوت حيّة الآن</td>
                <td className="py-1.5 font-bold" colSpan={3}>
                  {ar(liveStories)} قصة · {ar(liveNotes)} نوت
                </td>
              </tr>
            </tbody>
          </table>
        </figure>
      </section>

      <p className="text-[11px] leading-relaxed text-muted">
        «نشط» من فتح التطبيق أو الموقع وهو داخلٌ بحسابه. الأيّامُ بتوقيت الرياض. وما قبل
        بدء سجلّ الأيّام تقريبٌ من آثارٍ مؤكَّدة (الدخول والكتابة)، فأعمدتُه قد تكون أقصر
        من الحقيقة. والمدفوعُ بعملة الشراء قبل حصّة آبل، وهو وأرقامُ آثار+ تشمل مشتريات الاختبار (Sandbox)
        ما دامت مفتوحةً على الخادم.
      </p>
    </div>
  );
}
