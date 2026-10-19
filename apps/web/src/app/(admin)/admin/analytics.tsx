import { prisma } from "@/lib/db";
import { ar } from "@/lib/format";

/*
  لوحةُ التحليلات (القاعدة ٣٠٧): من يستعمل التطبيق، وكم يعود، وماذا يفعل.

  «النشطون» من `lastSeenAt` للأرقام الكبيرة — آخرُ ظهورٍ صادقٌ منذ اليوم الأوّل —
  ومن `DailyActive` للخطّ الزمنيّ: `lastSeenAt` يقول آخرَ مرّة لا أيّامَ الحضور.
  والأيّامُ أيّامُ الرياض (+٣) كجرس الصباح.
*/

const DAY = 86_400_000;
const OFFSET = 3 * 3_600_000;

/** منتصفُ ليل يوم الرياض بالتوقيت العالميّ — ما يُكتب في `DailyActive.day`. */
function riyadhMidnight(at: number): Date {
  const shifted = new Date(at + OFFSET);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

const keyOf = (date: Date) => date.toISOString().slice(0, 10);

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
      <span className="font-normal text-muted"> عن الأسبوع الماضي</span>
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
  const week = { gte: ago(7) };
  const lastWeek = { gte: ago(14), lt: ago(7) };

  const [
    total, newWeek, newLastWeek, dau, wau, mau, plus,
    cohort, cohortBack, daily, signups, weekly, sources, platforms, liveStories, liveNotes,
    activity,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: week } }),
    prisma.user.count({ where: { createdAt: lastWeek } }),
    prisma.user.count({ where: { lastSeenAt: { gte: ago(1) } } }),
    prisma.user.count({ where: { lastSeenAt: week } }),
    prisma.user.count({ where: { lastSeenAt: { gte: ago(30) } } }),
    prisma.user.count({ where: { isPlus: true, plusUntil: { gt: new Date(now) } } }),
    // العودة: من سجّل في الأسبوع الذي قبل هذا، كم منهم ظهر هذا الأسبوع.
    prisma.user.count({ where: { createdAt: lastWeek } }),
    prisma.user.count({ where: { createdAt: lastWeek, lastSeenAt: week } }),
    prisma.$queryRaw<{ day: Date; n: number }[]>`
      SELECT "day", COUNT(*)::int AS n FROM "DailyActive"
      WHERE "day" >= ${since30}::date GROUP BY "day"`,
    prisma.$queryRaw<{ day: Date; n: number }[]>`
      SELECT (("createdAt" + interval '3 hours')::date) AS day, COUNT(*)::int AS n FROM "User"
      WHERE "createdAt" >= ${new Date(since30.getTime() - OFFSET)} GROUP BY 1`,
    // النشطون في كل أسبوعٍ من الثمانية الأخيرة — كلُّ حسابٍ مرّةً في أسبوعه.
    prisma.$queryRaw<{ w: number; n: number }[]>`
      SELECT ((${today}::date - "day") / 7)::int AS w, COUNT(DISTINCT "userId")::int AS n
      FROM "DailyActive" WHERE "day" > ${today}::date - 56 GROUP BY 1`,
    prisma.$queryRaw<{ source: string; n: number }[]>`
      SELECT "source", COUNT(DISTINCT "userId")::int AS n FROM "DailyActive"
      WHERE "day" > ${today}::date - 7 GROUP BY 1`,
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
  ]);

  const series = (rows: { day: Date; n: number }[]) => {
    const byDay = new Map(rows.map((row) => [keyOf(new Date(row.day)), row.n]));
    return Array.from({ length: 30 }, (_, i) => {
      const day = new Date(since30.getTime() + i * DAY);
      const [, m, d] = keyOf(day).split("-");
      return {
        label: `${ar(Number(d))}/${ar(Number(m))}`,
        tip: `${ar(Number(d))}/${ar(Number(m))}`,
        value: byDay.get(keyOf(day)) ?? 0,
      };
    });
  };
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const back = 7 - i;
    const value = weekly.find((row) => row.w === back)?.n ?? 0;
    const label = back === 0 ? "هذا" : `−${ar(back)}`;
    return { label, tip: back === 0 ? "آخر ٧ أيام" : `قبل ${ar(back)} أسبوع`, value };
  });
  const source = (name: string) => sources.find((row) => row.source === name)?.n ?? 0;
  const platform = (name: string) => platforms.find((row) => row.platform === name)?.n ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="mb-2.5 text-[15px] font-bold">المستخدمون</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="كل المستخدمين" value={ar(total)} hint={`+${ar(newWeek)} آخر ٧ أيام`}>
            <Delta now={newWeek} before={newLastWeek} />
          </Tile>
          <Tile label="نشطون آخر ٧ أيام" value={ar(wau)} hint={`${pct(wau, total)} من الكل`}>
            <Delta now={wau} before={weeks[6]?.value ?? 0} />
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
          <Tile label="مشتركو آثار+" value={ar(plus)} hint={`${pct(plus, total)} من الكل`} />
          <Tile
            label="من أين نشطوا هذا الأسبوع"
            value={`${ar(source("app"))} تطبيق`}
            hint={`${ar(source("web"))} ويب · أجهزة: ${ar(platform("ios"))} آيفون، ${ar(platform("android"))} أندرويد`}
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Bars title="النشطون يومياً — آخر ٣٠ يوماً" rows={series(daily)} unit="مستخدم" />
        <Bars title="التسجيلات يومياً — آخر ٣٠ يوماً" rows={series(signups)} unit="تسجيل" />
        <Bars title="النشطون أسبوعياً — آخر ٨ أسابيع" rows={weeks} unit="مستخدم" every={1} peak="أسبوع" />
        <figure className="rounded-2xl border border-line bg-card px-4 py-3.5">
          <figcaption className="mb-2 text-[13px] font-bold">النشاط آخر ٧ أيام</figcaption>
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
        من الحقيقة.
      </p>
    </div>
  );
}
