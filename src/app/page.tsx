import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { privateTimeline, timeline } from "@/lib/feed";
import { friendshipSince, togetherMoments } from "@/lib/together";
import { unreadCount } from "@/lib/dm";
import { MomentCard } from "@/components/moment-card";
import { ComposerFan } from "@/components/composer-fan";
import { Tour } from "@/components/tour";
import { Avatar, Empty, NameTag } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import { TimelineHead } from "@/components/timeline-head";
import { VerifyBanner } from "@/components/verify-banner";
import { AthrHeaderMark } from "@/components/brand";
import { MessageIcon, SparkIcon } from "@/components/icons";
import { ar, dayLabel, membership } from "@/lib/format";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/**
 * الخط الزمني، وفي مكانه تحلّ اللحظات الخاصة أو أثرٌ مشترك.
 *
 * لا صفحة جديدة ولا زرّ رجوع: الرأس والغلاف والصورة تبقى كما هي، ويتبدّل
 * ما تحتها وحده — فالانتقال يُحسّ تبديل عدسة لا مغادرة مكان.
 */
export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; with?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const view = params.view === "private" || params.view === "together" ? params.view : "";
  const withId = view === "together" ? (params.with ?? "") : "";
  // «آثارنا» من مزايا آثار+ — من اختارها بلا اشتراكٍ يُؤخذ إلى صفحته.
  if (view === "together" && !user.isPlus) redirect("/subscribe");

  const [unread, ids] = await Promise.all([
    unreadCount(user.id),
    circleIds(user.id),
  ]);

  const moments =
    view === "private"
      ? await privateTimeline(user.id)
      : view === "together"
        ? withId && ids.includes(withId)
          ? await togetherMoments(user.id, withId)
          : []
        : await timeline(user.id);

  const friend =
    withId && ids.includes(withId)
      ? await prisma.user.findUnique({
          where: { id: withId },
          select: {
            id: true,
            name: true,
            avatarMediaId: true,
            frame: { select: { spec: true, mediaId: true, frameHole: true } },
            charm: { select: { spec: true, mediaId: true } },
          },
        })
      : null;
  const since = friend ? await friendshipSince(user.id, friend.id) : null;

  // قائمة الأصدقاء تُعرض حين يُطلب أثرٌ مشترك بلا اختيار صاحبه.
  const pick =
    view === "together" && !friend
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            name: true,
            avatarMediaId: true,
            frame: { select: { spec: true, mediaId: true, frameHole: true } },
            charm: { select: { spec: true, mediaId: true } },
          },
          orderBy: { name: "asc" },
        })
      : [];

  // اللحظات تُجمَّع تحت فواصل الأيام، فالخط الزمني يُقرأ كيوميات لا كتدفق.
  const days: { label: string; items: typeof moments }[] = [];
  for (const moment of moments) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  return (
    <div className="screen">
      <header className="chrome flex items-center justify-between px-5 pb-3 pt-4">
        <AthrHeaderMark />
        <div className="flex items-center gap-1.5">
          {/* «آثار+» قبل الرسائل: بابُ الاشتراك ومزاياه، لا زرّ دفعٍ مباشر. */}
          <Link
            href="/subscribe"
            className="flex items-center gap-1 rounded-full px-3 text-[12px] font-bold"
            style={{
              height: 32,
              background: "var(--color-gold-soft)",
              color: "var(--color-gold-ink)",
              border: "1px solid var(--color-gold-line)",
            }}
          >
            <SparkIcon size={13} />
            آثار+
          </Link>

          <Link
            href="/messages"
            aria-label="المحادثات"
            // ٤٠ لا ٤٤: القرص الأكبر كان يرفع الرأس عن بقية التبويبات.
            className="relative flex h-10 w-10 items-center justify-center"
            style={{ color: "var(--color-chrome-ink)" }}
          >
            <MessageIcon size={21} />
            {unread > 0 ? (
              <span
                className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                style={{ background: "var(--color-live)", color: "var(--color-on-brand)" }}
              >
                {ar(unread)}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <TimelineHead
        coverMediaId={user.coverMediaId}
        coverSpec={user.background?.spec ?? null}
        coverY={user.coverY}
        coverX={user.coverX}
        coverZoom={user.coverZoom}
        name={user.name}
        since={membership(user.createdAt)}
        tag={<NameTag isPlus={user.isPlus} tag={user.tag} size={10} />}
        avatar={
          <Avatar
            name={user.name}
            size={68}
            frame={user.frame}
            charm={user.charm}
            mediaId={user.avatarMediaId}
          />
        }
      >
        {/*
           أوّلُ ما يقع عليه بصرُه بعد التسجيل — ولا يمنعه من شيء
           (القاعدة ١١٩ب). ومن لا بريدَ له (دخل بسناب) لا يُقال له
           «أكّد بريدك»: صفُّ «اربط بريدك» في الإعدادات موضعُه.
        */}
        {user.email && !user.emailVerifiedAt ? <VerifyBanner email={user.email} /> : null}

        {view === "private" ? (
          <p className="mb-1 text-[11.5px] leading-relaxed text-muted">
            ما نُشر لتصنيفٍ من أصدقائك أو لأشخاص بأعيانهم — غيرهم لا يراها أصلاً.
          </p>
        ) : null}

        {view === "together" && friend ? (
          <section className="mb-3 rounded-2xl border border-line bg-card p-4 text-center">
            <div className="mb-2 flex items-center justify-center">
              <Avatar name={user.name} size={44} mediaId={user.avatarMediaId} />
              <div style={{ marginRight: -12 }}>
                <Avatar
                  name={friend.name}
                  size={44}
                  frame={friend.frame}
                  charm={friend.charm}
                  mediaId={friend.avatarMediaId}
                />
              </div>
            </div>
            <p className="text-[12.5px] font-semibold text-clay-ink">آثاركما المشتركة</p>
            <p className="my-0.5 text-[28px] leading-none" style={{ fontFamily: "var(--font-display)" }}>
              {ar(moments.length)}
            </p>
            <p className="text-[12px] text-muted">
              لحظة تجمعك بـ{friend.name}
              {since ? ` منذ ${MONTHS[since.getMonth()]} ${ar(since.getFullYear())}` : ""}
            </p>
            <Link
              href="/?view=together"
              className="mt-2 inline-block text-[12px] font-semibold text-clay-ink"
            >
              غيّر الصديق
            </Link>
          </section>
        ) : null}

        {view === "together" && !friend ? (
          pick.length === 0 ? (
            <Empty title="ما عندك أصدقاء بعد" hint="أضف صديقاً أولاً من تبويب الأصدقاء." />
          ) : (
            <>
              <p className="mb-2 text-[11.5px] leading-relaxed text-muted">
                اختر صاحبك لترى ما جمعكما: إشارةٌ منه أو تفاعلٌ أو تعليق.
              </p>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                {pick.map((person, index) => (
                  <Link
                    key={person.id}
                    href={`/?view=together&with=${person.id}`}
                    className="flex items-center gap-3 p-3"
                    style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
                  >
                    <Avatar
                      name={person.name}
                      size={42}
                      frame={person.frame}
                      charm={person.charm}
                      mediaId={person.avatarMediaId}
                    />
                    <span className="min-w-0 grow truncate text-[14px] font-semibold">
                      {person.name}
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-clay-ink">آثارنا</span>
                  </Link>
                ))}
              </div>
            </>
          )
        ) : moments.length === 0 ? (
          <Empty
            title={
              view === "private"
                ? "ما فيه لحظات خاصة"
                : view === "together"
                  ? "ما فيه آثار بعد"
                  : "خطك الزمني فارغ"
            }
            hint={
              view === "private"
                ? "عند النشر اختر «من يراها» — تصنيفاً من أصدقائك أو أشخاصاً بأعيانهم."
                : view === "together"
                  ? "أشِر إليه في لحظة، أو تفاعل مع لحظاته — وسيبدأ الخطّ المشترك."
                  : "اضغط الزائد وانشر لحظتك الأولى، أو انتظر أحداً من أصدقائك ينشر."
            }
          />
        ) : (
          <div className="spine relative">
            {days.map((day) => (
              <section key={day.label}>
                <div className="relative flex items-center gap-3 py-4">
                  <div className="flex w-14 justify-center">
                    <span className="block h-1.5 w-1.5 rounded-full bg-line" />
                  </div>
                  <h2 className="text-[15px] font-bold text-ink-2">{day.label}</h2>
                </div>
                {day.items.map((moment) => (
                  <MomentCard
                    key={moment.id}
                    moment={moment}
                    viewerId={user.id}
                    isPlus={user.isPlus}
                    moderate={user.canModerate}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </TimelineHead>

      <Tour />
      <ComposerFan />
      <TabBar active="/" view={view} />
    </div>
  );
}
