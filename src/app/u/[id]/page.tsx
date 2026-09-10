import Link from "next/link";

import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds, mutualCount } from "@/lib/circle";
import { momentShape } from "@/lib/feed";
import { plusTag, tagOf } from "@/lib/tags";
import {
  acceptFriend,
  ignoreFriend,
  requestFriend,
  startConversation,
} from "@/app/actions";
import { MomentCard } from "@/components/moment-card";
import { GiftButton } from "./gift";
import { Avatar, coverStyle, Empty, ScreenHeader, TagPill } from "@/components/ui";
import { TabBar } from "@/components/tab-bar";
import {
  CheckIcon,
  CloseIcon,
  LockIcon,
  MessageIcon,
  SparkIcon,
  WithIcon,
} from "@/components/icons";
import { ar, dayLabel } from "@/lib/format";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** ملف صديق: مخططه ولحظاته — لا يفتحه إلا من هو في دائرته. */
export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  if (id === viewer.id) redirect("/me");

  const ids = await circleIds(viewer.id);
  const friend = ids.includes(id);

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      memberNo: true,
      name: true,
      city: true,
      isPlus: true,
      createdAt: true,
      avatarMediaId: true,
      coverMediaId: true,
      frame: { select: { spec: true } },
      charm: { select: { spec: true, mediaId: true } },
      background: { select: { spec: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });
  if (!person) notFound();

  // من ليس في الدائرة: تُعرض بطاقته وحدها إن كان يجمعكما صديق مشترك أو
  // طلبٌ معلّق. لا خطّ زمني ولا محادثة قبل القبول — والغريب تماماً لا
  // يُعرَض أصلاً، فلا اكتشاف عام في التطبيق.
  if (!friend) {
    const [mutual, pending] = await Promise.all([
      mutualCount(viewer.id, id),
      prisma.friendship.findFirst({
        where: {
          status: "PENDING",
          OR: [
            { requesterId: viewer.id, addresseeId: id },
            { requesterId: id, addresseeId: viewer.id },
          ],
        },
        select: { id: true, requesterId: true },
      }),
    ]);
    if (mutual === 0 && !pending) notFound();

    return (
      <LockedProfile
        person={person}
        mutual={mutual}
        sentByMe={pending?.requesterId === viewer.id}
        incoming={pending && pending.requesterId === id ? pending.id : null}
        auto={await plusTag()}
      />
    );
  }

  const [moments, theirCircle, auto, frames, theirs] = await Promise.all([
    prisma.moment.findMany({
      where: { authorId: id },
      select: momentShape,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    circleIds(id),
    plusTag(),
    // أصناف المتجر كلها تُقرأ هنا لتُعرض في نافذة الإهداء بلا مغادرة الملف:
    // الإطار والثيم والتميمة كلّها تُهدى.
    prisma.storeItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.purchase.findMany({ where: { userId: id }, select: { itemId: true } }),
  ]);

  const joined = `${MONTHS[person.createdAt.getMonth()]} ${ar(person.createdAt.getFullYear())}`;

  const days: { label: string; items: typeof moments }[] = [];
  for (const moment of moments) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  return (
    <div className="screen">
      <ScreenHeader title={person.name} />

      <div className="scroll-area">
        <div
          className="relative shrink-0"
          style={{ height: 140, ...coverStyle(person.coverMediaId, person.background?.spec) }}
        />

        <div className="relative px-5" style={{ marginTop: -34 }}>
          <div className="mb-3 flex items-end justify-between">
            <Avatar
              name={person.name}
              size={78}
              frameSpec={person.frame?.spec}
              charm={person.charm}
              mediaId={person.avatarMediaId}
            />
            <div className="flex items-center gap-2 pb-1.5">
              <GiftButton
                items={frames.map((item) => ({
                  id: item.id,
                  name: item.name,
                  spec: item.spec,
                  priceHalalas: item.priceHalalas,
                  plusOnly: item.plusOnly,
                  earnedAfterDays: item.earnedAfterDays,
                  mediaId: item.mediaId,
                }))}
                owned={theirs.map((row) => row.itemId)}
                friendId={person.id}
                friendName={person.name}
                friendIsPlus={person.isPlus}
                credit={viewer.storeCredit}
                isPlus={viewer.isPlus}
              />
              <Link
                href={`/?view=together&with=${person.id}`}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-[13px] font-semibold text-ink-2"
                style={{ height: 42 }}
              >
                <WithIcon size={16} />
                أثرنا
              </Link>
              <form action={startConversation.bind(null, person.id)}>
                <button
                  type="submit"
                  aria-label="محادثة"
                  className="flex w-11 items-center justify-center rounded-xl border border-line bg-card text-ink-2"
                  style={{ height: 42 }}
                >
                  <MessageIcon size={17} />
                </button>
              </form>
            </div>
          </div>

          <h1 className="mb-1 flex flex-wrap items-center gap-2 text-[19px] font-bold">
            {person.name}
            {person.isPlus ? <SparkIcon size={16} className="text-gold" /> : null}
            <TagPill tag={tagOf(person, auto)} size={11} />
          </h1>
          <p className="mb-4 text-[12.5px] text-muted">
            عضوية رقم {ar(person.memberNo)} · {person.city ? `${person.city} · ` : null}
            معك من {joined} · {ar(theirCircle.length)} من أصدقائه
          </p>
        </div>

        <div className="px-5">
          {moments.length === 0 ? (
            <Empty title="ما نشر شي بعد" />
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
                      viewerId={viewer.id}
                      isPlus={viewer.isPlus}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* الشريط السفلي يبقى: التبويب يؤدّي غرض الرجوع، فلا زرّ رجوع فوقه. */}
      <TabBar active="/circle" />
    </div>
  );
}


type Person = {
  id: string;
  memberNo: number;
  name: string;
  city: string | null;
  isPlus: boolean;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  frame: { spec: string } | null;
  charm: { spec: string; mediaId: string | null } | null;
  background: { spec: string } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

/**
 * بطاقة من ليس في دائرتك: اسمه وصورته وعدد الأصدقاء المشتركين، وزر
 * الإضافة. لا لحظاته ولا محادثته — كلاهما بعد القبول، والخادم يمنعهما
 * لا الواجهة وحدها.
 */
function LockedProfile({
  person,
  mutual,
  sentByMe,
  incoming,
  auto,
}: {
  person: Person;
  mutual: number;
  sentByMe: boolean;
  incoming: string | null;
  auto: { name: string; bg: string; fg: string } | null;
}) {
  return (
    <div className="screen">
      <ScreenHeader title={person.name} />

      <div className="scroll-area">
        <div
          className="relative shrink-0"
          style={{ height: 140, ...coverStyle(person.coverMediaId, person.background?.spec) }}
        />

        <div className="relative px-5" style={{ marginTop: -34 }}>
          <Avatar
            name={person.name}
            size={78}
            frameSpec={person.frame?.spec}
              charm={person.charm}
            mediaId={person.avatarMediaId}
          />

          <h1 className="mb-1 mt-3 flex flex-wrap items-center gap-2 text-[19px] font-bold">
            {person.name}
            {person.isPlus ? <SparkIcon size={16} className="text-gold" /> : null}
            <TagPill tag={tagOf(person, auto)} size={11} />
          </h1>
          <p className="mb-5 text-[12.5px] text-muted">
            عضوية رقم {ar(person.memberNo)}
            {person.city ? ` · ${person.city}` : ""}
            {mutual > 0
              ? ` · ${mutual === 1 ? "صديق مشترك واحد" : `${ar(mutual)} أصدقاء مشتركين`}`
              : ""}
          </p>

          {incoming ? (
            <div className="mb-5 flex gap-2.5">
              <form action={acceptFriend.bind(null, incoming)} className="grow">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold"
                  style={{ height: 48, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                >
                  <CheckIcon size={17} />
                  اقبل الإضافة
                </button>
              </form>
              <form action={ignoreFriend.bind(null, incoming)}>
                <button
                  type="submit"
                  aria-label="تجاهل"
                  className="flex items-center justify-center rounded-xl border border-line text-muted"
                  style={{ height: 48, width: 48 }}
                >
                  <CloseIcon size={17} />
                </button>
              </form>
            </div>
          ) : sentByMe ? (
            <p
              className="mb-5 flex items-center justify-center rounded-xl border border-line text-[13.5px] font-semibold text-muted"
              style={{ height: 48 }}
            >
              طلبك معلّق عنده
            </p>
          ) : (
            <form action={requestFriend.bind(null, person.id)} className="mb-5">
              <button
                type="submit"
                className="brand-gradient w-full rounded-xl text-[14.5px] font-bold"
                style={{ height: 50, color: "var(--color-on-brand)" }}
              >
                أضفه إلى أصدقائي
              </button>
            </form>
          )}

          <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-card p-4">
            <span className="mt-0.5 shrink-0 text-muted">
              <LockIcon size={16} />
            </span>
            <p className="text-[12.5px] leading-relaxed text-muted">
              لحظاته ومحادثته بعد قبول الإضافة. الدائرة الصغيرة تعني أن ما يُنشر
              فيها لا يُرى من خارجها.
            </p>
          </div>
        </div>
      </div>

      <TabBar active="/circle" />
    </div>
  );
}
