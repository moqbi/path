import Link from "next/link";
import { prisma } from "@/lib/db";
import { ar } from "@/lib/format";
import { setVisitorsOpen } from "@/app/actions";
import { Saver } from "./saver";

/*
  الرئيسيّة: غرفةُ العمليات (القاعدة ٤٧٧) — **بقرار المالك**، من خمسة تصاميم عُرضت عليه.

  تفتح اللوحةُ على ما ينتظر قراراً لا على قائمة أقسام: أربعةُ أرقامٍ تقول إن كان اليومُ
  هادئاً، ثمّ صفٌّ واحدٌ بما يحتاج يداً مرتّباً بالخطورة — البلاغُ الذي أبلغ عنه أكثرُ من
  واحدٍ أوّلاً، ثمّ البلاغُ والدعمُ بلا ردّ، ثمّ طلباتُ التجارب والوظائف. وكلُّ صفٍّ بابٌ
  إلى حيث يُحسم؛ لا إجراءَ جديدٌ هنا (القاعدة ١٣).
*/

const DAY = 86_400_000;
const OFFSET = 3 * 3_600_000;
const OWN_KINDS = ["PHOTO", "PLACE", "THOUGHT", "MUSIC", "MOOD", "QUESTION", "SLEEP", "WAKE"] as const;
const SPARK_DAYS = 14;

/** منتصفُ ليل يوم الرياض بالتوقيت العالميّ — ما يُكتب في `DailyActive.day`. */
function riyadhDay(at: number): Date {
  const shifted = new Date(at + OFFSET);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

const REPORT_LABEL: Record<string, string> = {
  MOMENT: "بلاغ عن لحظة",
  COMMENT: "بلاغ عن تعليق",
  STORY: "بلاغ عن قصة",
  MESSAGE: "بلاغ عن رسالة",
  USER: "بلاغ عن حساب",
};

type Need = {
  key: string;
  sev: "hi" | "md" | "lo";
  who: string;
  what: string;
  line: string;
  href: string;
  act: string;
  at: Date;
};

const SEV_COLOR = { hi: "var(--color-live)", md: "var(--color-gold)", lo: "var(--color-line)" };
const SEV_RANK = { hi: 0, md: 1, lo: 2 };

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-[11px] text-muted">لا مقارنة</span>;
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  return (
    <span className="text-[11px] font-semibold" style={{ color: up ? "#3fc07e" : "#ff8f74" }}>
      {up ? "▲" : "▼"} {ar(Math.abs(change))}٪ <span className="font-normal text-muted">عن أمس</span>
    </span>
  );
}

/** خطٌّ صغير بمساحةٍ تحته: أربعة عشر يوماً، والأحدثُ في آخره بنقطة. */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 26 - (v / max) * 22] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-1 block h-7 w-full" aria-hidden>
      <path d={`${line} L100 28 L0 28Z`} fill={color} opacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  );
}

function Kpi({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className="text-[24px] font-bold leading-tight">{value}</p>
      {children}
    </div>
  );
}

export async function HomeSection() {
  const now = Date.now();
  const today = riyadhDay(now);
  const yesterday = new Date(today.getTime() - DAY);
  const since = new Date(today.getTime() - (SPARK_DAYS - 1) * DAY);
  // لحظاتُ «اليوم» من منتصف ليل الرياض بتوقيته — `today` منتصفُ ليلٍ عالميّ يحمل التاريخ وحده.
  const todayStart = new Date(today.getTime() - OFFSET);
  const yesterdayStart = new Date(todayStart.getTime() - DAY);
  const yesterdaySameTime = new Date(now - DAY);
  const week = new Date(now - 7 * DAY);
  const lastWeek = new Date(now - 14 * DAY);

  const [daily, momentsToday, momentsYesterday, plusNow, coinsWeek, coinsBefore, reports, tickets] =
    await Promise.all([
      prisma.dailyActive.groupBy({ by: ["day"], where: { day: { gte: since } }, _count: { _all: true } }),
      prisma.moment.count({ where: { createdAt: { gte: todayStart }, kind: { in: [...OWN_KINDS] } } }),
      // أمسِ إلى الساعة نفسها: يومٌ بدأ قبل ساعتين لا يُقاس على يومٍ كامل.
      prisma.moment.count({
        where: { createdAt: { gte: yesterdayStart, lt: yesterdaySameTime }, kind: { in: [...OWN_KINDS] } },
      }),
      // من دفع أو أُهدي إليه بمال — منحُ اللوحة لا يُحسب (القاعدة ٤٧٨).
      prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM "User" u
        WHERE u."isPlus" AND u."plusUntil" > ${new Date(now)}
          AND (EXISTS (SELECT 1 FROM "BillingEvent" b WHERE b."appUserId" = u."id" AND b."type" <> 'NON_RENEWING_PURCHASE' AND b."sandbox" = false)
            OR EXISTS (SELECT 1 FROM "PlusGift" g WHERE g."recipientId" = u."id" AND g."status" = 'DONE'
              AND EXISTS (SELECT 1 FROM "BillingEvent" e WHERE e."id" = g."eventId" AND e."sandbox" = false)))`.then(
        (rows) => rows[0]?.n ?? 0,
      ),
      prisma.coinTopUp.aggregate({ where: { source: "STORE", sandbox: false, createdAt: { gte: week } }, _sum: { coins: true } }),
      prisma.coinTopUp.aggregate({
        where: { source: "STORE", sandbox: false, createdAt: { gte: lastWeek, lt: week } },
        _sum: { coins: true },
      }),
      prisma.report.findMany({
        where: { state: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          target: true,
          targetId: true,
          reason: true,
          snippet: true,
          createdAt: true,
          reported: { select: { id: true, name: true, memberNo: true } },
        },
      }),
      prisma.supportTicket.findMany({
        // ما ينتظر الفريق: لم يُردّ عليها، أو علّق صاحبُها بعد آخر ردّ (القاعدة ٤٨٠).
        where: {
          closed: false,
          OR: [{ repliedAt: null }, { lastAt: { gt: prisma.supportTicket.fields.repliedAt } }],
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          body: true,
          topic: true,
          name: true,
          createdAt: true,
          user: { select: { name: true, memberNo: true } },
        },
      }),
    ]);

  const byDay = new Map(daily.map((row) => [row.day.toISOString().slice(0, 10), row._count._all]));
  const series = Array.from({ length: SPARK_DAYS }, (_, i) =>
    byDay.get(new Date(since.getTime() + i * DAY).toISOString().slice(0, 10)) ?? 0,
  );
  const activeToday = series[SPARK_DAYS - 1] ?? 0;
  const activeYesterday = byDay.get(yesterday.toISOString().slice(0, 10)) ?? 0;
  const coins = coinsWeek._sum.coins ?? 0;
  const coinsPrev = coinsBefore._sum.coins ?? 0;

  // بلاغاتُ الشيء الواحد صفٌّ واحد بعددها: ثلاثةُ أشخاصٍ على تعليقٍ واحد أخطرُ من واحد.
  const grouped = new Map<string, { count: number; first: (typeof reports)[number] }>();
  for (const report of reports) {
    const key = `${report.target}:${report.targetId}`;
    const seen = grouped.get(key);
    if (seen) seen.count += 1;
    else grouped.set(key, { count: 1, first: report });
  }

  const needs: Need[] = [
    ...[...grouped.entries()].map(([key, { count, first }]) => ({
      key,
      sev: (count >= 2 ? "hi" : "md") as Need["sev"],
      who: first.reported ? first.reported.name : "حسابٌ محذوف",
      what: REPORT_LABEL[first.target] ?? "بلاغ",
      line: `${first.snippet ? `«${first.snippet}» — ` : ""}${first.reason}${count > 1 ? ` · ${ar(count)} بلاغات` : ""}`,
      href: "/admin?s=inbox&v=reports",
      act: "احسم",
      at: first.createdAt,
    })),
    ...tickets.map((ticket) => {
      const side = ticket.topic === "beta" || ticket.topic === "careers";
      return {
        key: ticket.id,
        sev: (side ? "lo" : "md") as Need["sev"],
        who: ticket.user?.name ?? ticket.name ?? "زائر",
        what: ticket.topic === "beta" ? "فريق التجارب" : ticket.topic === "careers" ? "طلب وظيفة" : "رسالة دعم",
        line: ticket.body,
        href: `/admin?s=inbox&open=${ticket.id}`,
        act: side ? "افتح" : "ردّ",
        at: ticket.createdAt,
      };
    }),
  ].sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || b.at.getTime() - a.at.getTime());

  const shown = needs.slice(0, 12);

  const hour = new Date(Date.now() + OFFSET).getUTCHours();
  const visitorsOn = (await prisma.siteText.findUnique({ where: { key: "visitors.open" } }).catch(() => null))?.value === "1";
  return (
    <>
      <header className="mb-4">
        <h1 className="text-[24px] font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          {hour < 12 ? "صباح الخير" : "مساء الخير"}
        </h1>
        <p className="text-[12.5px] text-muted">
          ملخّص اليوم بتوقيت الرياض —{" "}
          {new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Riyadh" }).format(new Date())}
        </p>
      </header>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="نشطون اليوم" value={ar(activeToday)}>
          <Delta now={activeToday} before={activeYesterday} />
          <Spark values={series} color="#F6B93B" />
        </Kpi>
        <Kpi label="لحظاتٌ اليوم" value={ar(momentsToday)}>
          <Delta now={momentsToday} before={momentsYesterday} />
        </Kpi>
        <Kpi label="مشتركون يدفعون" value={ar(plusNow)}>
          <Link href="/admin?s=analytics" className="text-[11px] font-semibold text-clay-ink">
            التفاصيل في التحليلات
          </Link>
        </Kpi>
        <Kpi label="نقاطٌ بيعت · ٧ أيام" value={ar(coins)}>
          {coinsPrev ? (
            <span className="text-[11px] font-semibold" style={{ color: coins >= coinsPrev ? "#3fc07e" : "#ff8f74" }}>
              {coins >= coinsPrev ? "▲" : "▼"} {ar(Math.abs(Math.round(((coins - coinsPrev) / coinsPrev) * 100)))}٪{" "}
              <span className="font-normal text-muted">عن الأسبوع قبله</span>
            </span>
          ) : (
            <span className="text-[11px] text-muted">لا مقارنة</span>
          )}
        </Kpi>
      </div>

      <VisitorsSwitch open={visitorsOn} />

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <h2 className="flex items-center justify-between border-b border-line px-4 py-3 text-[15px] font-bold">
          يحتاج يدك الآن
          <span
            className="rounded-full px-2.5 text-[12px] font-bold"
            style={{
              background: needs.length ? "var(--color-live)" : "var(--color-ground)",
              color: needs.length ? "#fff" : "var(--color-muted)",
            }}
          >
            {ar(needs.length)}
          </span>
        </h2>
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">لا بلاغ ولا رسالة تنتظر. يومٌ هادئ.</p>
        ) : (
          shown.map((need) => (
            <Link
              key={need.key}
              href={need.href}
              className="flex items-stretch gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-ground"
            >
              <span className="w-1 shrink-0 rounded-full" style={{ background: SEV_COLOR[need.sev] }} />
              <div className="min-w-0 grow py-0.5">
                <p className="truncate text-[13.5px]">
                  <b>{need.who}</b> <span className="text-muted">· {need.what}</span>
                </p>
                <p className="truncate text-[12px] text-muted">{need.line}</p>
              </div>
              <span
                className="self-center rounded-xl px-3 py-1.5 text-[12px] font-bold"
                style={{
                  background: need.sev === "hi" ? "var(--color-live)" : "var(--color-chrome)",
                  color: "#fff",
                }}
              >
                {need.act}
              </span>
            </Link>
          ))
        )}
        {needs.length > shown.length ? (
          <p className="border-t border-line px-4 py-2 text-[11.5px] text-muted">
            و{ar(needs.length - shown.length)} غيرها في{" "}
            <Link href="/admin?s=inbox" className="font-semibold text-clay-ink">الصندوق</Link>.
          </p>
        ) : null}
      </section>
    </>
  );
}

/**
 * «من كان هنا» مفتوحة (القاعدة ٤٨٥) — **بقرار المالك**: مفتاحٌ في الرئيسيّة يبدّل اسمَ المكان
 * في اللحظة من «أصدقاؤك في ١٠ أيام» إلى «كلُّ من زاره في ٢٤ ساعة بزرّ إضافة»، ويُظهر في خصوصيّة
 * التطبيق «إظهاري في من زار الموقع». الإطفاءُ يُرجع الاثنين.
 */
function VisitorsSwitch({ open }: { open: boolean }) {
  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3.5">
      <div className="min-w-0 grow">
        <h2 className="flex items-center gap-2 text-[14.5px] font-bold">
          من زار الموقع — مفتوحة للجميع
          <span
            className="rounded-full px-2 text-[11px] font-bold"
            style={open ? { background: "#3fc07e", color: "#0e1a24" } : { background: "var(--color-ground)", color: "var(--color-muted)" }}
          >
            {open ? "مفعّلة" : "مطفأة"}
          </span>
        </h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          {open
            ? "اسمُ المكان في أيّ لحظة يُظهر كلَّ من زاره خلال ٢٤ ساعة، صديقاً أو غيره، بزرّ إضافة. ومن أطفأ «إظهاري» في خصوصيّته لا يظهر."
            : "مطفأةً: أصدقاءُ القارئ الذين زاروا المكان خلال ١٠ أيام، وغيرُهم عددٌ بلا أسماء. وتفعيلُها يُظهر مفتاحَ «إظهاري في من زار الموقع» في خصوصيّة التطبيق."}
        </p>
      </div>
      <Saver action={setVisitorsOpen}>
        <input type="hidden" name="open" value={open ? "0" : "1"} />
        <button
          type="submit"
          className="h-10 rounded-xl px-4 text-[13px] font-bold"
          style={open ? { border: "1px solid var(--color-line)" } : { background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {open ? "أطفئها" : "فعّلها"}
        </button>
      </Saver>
    </section>
  );
}
