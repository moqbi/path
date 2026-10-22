import Link from "next/link";

import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds, mutualCount } from "@/lib/circle";
import { blockedWith, visibleWhere } from "@/lib/visibility";
import { momentShape } from "@/lib/feed";
import {
  acceptFriend,
  ignoreFriend,
  requestFriend,
  startConversation,
} from "@/app/actions";
import { MomentCard } from "@/components/moment-card";
import { AlertBell } from "@/components/edit-sheet";
import { canTryStickers } from "@/lib/stickers";
import { GiftButton } from "./gift";
import { PulseRings } from "@/components/pulse-rings";
import { storyRings } from "@/lib/stories";
import { togetherMoments } from "@/lib/together";
import { Avatar, CoverLayer, Empty, ScreenHeader, NameTag } from "@/components/ui";
import { AvatarMenu } from "@/components/avatar-menu";
import { TabBar } from "@/components/tab-bar";
import {
  CheckIcon,
  CloseIcon,
  LockIcon,
  MessageIcon,
  WithIcon,
} from "@/components/icons";
import { ar, dayLabel, membership } from "@/lib/format";

/** ما يُعرض عن صنفٍ ملبوس حين تُضغط صورة العرض. */
const WORN = {
  id: true,
  name: true,
  kind: true,
  spec: true,
  mediaId: true,
  frameHole: true,
  priceCoins: true,
  plusOnly: true,
} as const;

/** ملف صديق: مخططه ولحظاته — لا يفتحه إلا من هو في دائرته. */
export default async function FriendProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;

  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  if (id === viewer.id) redirect("/me");

  const [ids, blocked] = await Promise.all([circleIds(viewer.id), blockedWith(viewer.id)]);
  const friend = ids.includes(id);
  /* تنبيهُ قصّة الصديق ونوته (القاعدة ٣١٩) — للمشرفين يجرّبونه أوّلاً. */
  const trial = canTryStickers(viewer);
  const alertOn =
    trial && friend
      ? Boolean(await prisma.storyAlert.findUnique({ where: { userId_friendId: { userId: viewer.id, friendId: id } }, select: { userId: true } }))
      : false;
  // من يتابعني وأنا حسابٌ مفتوح تُقرأ لحظاتُه عندي (القاعدة ٢٧٨) — بشرط الرؤية نفسه.
  const followsMe = !friend && Boolean(
    await prisma.friendship.findFirst({
      where: { status: "ACCEPTED", follow: true, requesterId: id, addresseeId: viewer.id },
      select: { id: true },
    }),
  );
  // والحظر في الاتجاهين فوق كل شيء — حتى فوق انفتاح الحساب.
  if (blocked.includes(id)) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      memberNo: true,
      name: true,
      handle: true,
      bio: true,
      city: true,
      isPlus: true,
      isOpen: true,
      createdAt: true,
      avatarMediaId: true,
      coverMediaId: true,
      coverX: true,
      coverY: true,
      coverZoom: true,
      frame: { select: WORN },
      charm: { select: WORN },
      background: { select: { spec: true, coverMediaId: true } },
      tag: { select: { name: true, bg: true, fg: true } },
    },
  });
  if (!person) notFound();

  /*
    من ليس في الدائرة: تُعرض بطاقته وحدها — لكلّ حسابٍ قائم، لا لمن
    يجمعك به صديقٌ مشترك وحده. من أعطى رابطه أعطى بطاقته، ومن فتحها
    يرسل طلباً وصاحبُها يقبل أو يدع: الحارسُ هو القبول لا الوصول.
    ولا خطَّ زمنيّ ولا محادثة قبل القبول.

    وليس هذا استكشافاً عامّاً (القاعدة ٢): لا بحثَ بالاسم ولا بالبريد
    ولا قائمةَ تُتصفَّح. وكان شرطُ الصديق المشترك يُخفي البطاقة، فمن
    حذف صديقاً لا يجمعه به أحد وجد «غير موجود» مكان من كان صديقَه
    أمسِ، ولا بابَ إلى إعادته.
  */
  if (!friend && !followsMe && !person.isOpen) {
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

    return (
      <LockedProfile
        person={person}
        mutual={mutual}
        sentByMe={pending?.requesterId === viewer.id}
        incoming={pending && pending.requesterId === id ? pending.id : null}
        staff={viewer.role === "ADMIN" || viewer.adminScope === "ALL"}
      />
    );
  }

  const [moments, theirs, mine] = await Promise.all([
    /*
      بابٌ ثانٍ ظاهرٌ لا توسعةٌ لـ`visibleWhere()` (القاعدة ٢٣): الصديق
      يقرأ ما وُجّه إليه، والزائرُ لحسابٍ مفتوح يقرأ ما وُجّه إلى
      الدائرة كلها وحده — فلا تُقرأ لحظةٌ خصّ بها صاحبُها تصنيفاً أو
      أشخاصاً بأعيانهم.
    */
    prisma.moment.findMany({
      where: friend
        ? { authorId: id }
        : followsMe
          ? { AND: [await visibleWhere(viewer.id), { authorId: id }] }
          : { authorId: id, audience: "CIRCLE" },
      select: momentShape,
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.purchase.findMany({ where: { userId: id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { itemId: true } }),
    prisma.purchase.findMany({ where: { userId: viewer.id, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { itemId: true } }),
  ]);

  /*
    ملفُّ الصديق بهيئة «الآن» (القاعدة ٣٢٠) — للمالك وممنوحي اللوحة أوّلاً (`canTryStickers`):
    أفعالُه أقراصٌ بجانب اسمه، وقصّتُه على صورته، وتحت الرأس «لحظاته | آثارنا».
    و«آثارنا» لمشتركي آثار+ (القاعدة ١٥٩) — والخادمُ يفحصها هنا لا الرابطُ وحده.
  */
  const fresh = trial && friend;
  const tab = fresh && tabParam === "together" && viewer.isPlus ? "together" : "moments";
  const [shown, ring] = await Promise.all([
    tab === "together" ? togetherMoments(viewer.id, id) : Promise.resolve(moments),
    fresh ? storyRings(viewer.id).then((rings) => rings.find((r) => r.userId === id) ?? null) : Promise.resolve(null),
  ]);

  const days: { label: string; items: typeof moments }[] = [];
  for (const moment of shown) {
    const label = dayLabel(moment.createdAt);
    const last = days.at(-1);
    if (last && last.label === label) last.items.push(moment);
    else days.push({ label, items: [moment] });
  }

  return (
    <div className="screen">
      {/* جرسُ قصصه ونوته في طرف الرأس الأيسر — **بقرار المالك** (القاعدة ٣٣٠). */}
      <ScreenHeader
        title={person.name}
        back="/circle"
        action={
          fresh ? (
            <AlertBell
              chrome
              friendId={person.id}
              name={person.name}
              initial={alertOn}
              avatar={<Avatar name={person.name} size={26} mediaId={person.avatarMediaId} />}
            />
          ) : null
        }
      />

      <div className="scroll-area">
        <ProfileHead
          person={person}
          avatar={
            /* الصورة تُضغط: عرضها، أو معلومات ما يلبسه صاحبها — أو قصّته إن كانت له (القاعدة ٣٢٠). */
            <span className="relative block">
            {ring?.fresh ? <PulseRings /> : null}
            <AvatarMenu
              name={person.name}
              size={104}
              frame={person.frame}
              charm={person.charm}
              mediaId={person.avatarMediaId}
              frameItem={person.frame}
              charmItem={person.charm}
              owned={mine.map((row) => row.itemId)}
            />
            {ring ? (
              <Link
                href={`/stories/${person.id}`}
                aria-label={`قصة ${person.name}`}
                className="absolute inset-0 z-10 rounded-full"
                style={ring.fresh ? undefined : { boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-ground-ink) 35%, transparent)" }}
              />
            ) : null}
            </span>
          }
          actions={
            fresh ? (
              <>
                <GiftButton
                  disc
                  friendOwned={theirs.map((row) => row.itemId)}
                  friendId={person.id}
                  friendName={person.name}
                  friendIsPlus={person.isPlus}
                />
                <form action={startConversation.bind(null, person.id)}>
                  <button type="submit" aria-label="محادثة" className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}>
                    <MessageIcon size={17} />
                  </button>
                </form>
              </>
            ) : null
          }
        >
          {/*
            الإهداء والمحادثة و«آثارنا» لأصدقائك: الأوّل للأصدقاء وحدهم
            (القاعدة ٣٩)، والثاني يُفتح بينكما، والثالث ما جمعكما —
            ولا شيء من ذلك بينك وبين حسابٍ مفتوح لم تُضِفه بعد.
            فيظهر له زرُّ الإضافة مكانها.
          */}
          {fresh ? (
            /* «لحظاته | آثارنا» — والإهداءُ في القرص فوق لا قسماً هنا (القاعدة ٣٢٠). */
            <nav role="tablist" aria-label="أقسام الملف" className="flex grow gap-1 rounded-full bg-chip p-1">
              {([["moments", "لحظاته", `/u/${person.id}`], ["together", "آثارنا", viewer.isPlus ? `/u/${person.id}?tab=together` : "/subscribe"]] as const).map(
                ([key, label, href]) => (
                  <Link
                    key={key}
                    href={href}
                    role="tab"
                    aria-selected={tab === key}
                    className="flex h-9 grow items-center justify-center rounded-full text-[13px] font-bold text-ink"
                    style={{ background: tab === key ? "var(--color-card)" : "transparent" }}
                  >
                    {label}
                  </Link>
                ),
              )}
            </nav>
          ) : friend ? (
            <>
              {/* المتجرُ كلُّه يُجلب ساعةَ تُفتح النافذة لا مع كل ملف (القاعدة ١٦٢). */}
              <GiftButton
                grow
                friendOwned={theirs.map((row) => row.itemId)}
                friendId={person.id}
                friendName={person.name}
                friendIsPlus={person.isPlus}
              />
              <Link href={`/?view=together&with=${person.id}`} className={`${ACTION} grow`} style={{ height: 46 }}>
                <WithIcon size={16} />
                آثارنا
              </Link>
              <ChatButton id={person.id} />
            </>
          ) : (
            /* الحسابُ المفتوح: يُضاف فيقبل بنفسه، ويُراسَل بلا إضافة (القاعدة ٢٢١). */
            <>
              <form action={requestFriend.bind(null, person.id)} className="flex grow">
                <button type="submit" className="brand-gradient grow rounded-xl text-[13.5px] font-bold" style={{ height: 46, color: "var(--color-on-brand)" }}>
                  أضفه
                </button>
              </form>
              <ChatButton id={person.id} />
            </>
          )}
        </ProfileHead>

        <div className="px-5">
          {shown.length === 0 ? (
            <Empty title={tab === "together" ? "ما جمعتكما لحظةٌ بعد" : "ما نشر شي بعد"} />
          ) : (
            <div className="spine relative">
              {days.map((day) => (
                <section key={day.label}>
                  <div className="relative flex items-center gap-3 py-4">
                    <div className="flex w-14 justify-center">
                      <span className="block h-2 w-2 rounded-full" style={{ background: "color-mix(in srgb, var(--color-ground-ink) 45%, transparent)" }} />
                    </div>
                    <h2 className="text-[15px] font-bold text-ground-ink">{day.label}</h2>
                  </div>
                  {day.items.map((moment) => (
                    <MomentCard
                      key={moment.id}
                      moment={moment}
                      viewerId={viewer.id}
                      isPlus={viewer.isPlus}
                      moderate={viewer.canModerate}
                      trial={trial}
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
  handle: string | null;
  bio: string | null;
  city: string | null;
  isPlus: boolean;
  createdAt: Date;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  coverX: number;
  coverY: number;
  coverZoom: number;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  background: { spec: string; coverMediaId: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
};

/**
 * ملفّ من ليس في دائرتك — **بهيئة ملفّ الصديق نفسها**.
 *
 * غلافٌ وصورةٌ واسمٌ ورقمُ عضوية كما يراها الصديق تماماً، ويتبدّل شيئان
 * وحدهما: مكانُ اللحظات يحمل سطراً يقول لماذا لا تُرى، ومكانُ
 * «آثارنا» والإهداء والمحادثة يحمل زرَّ الإضافة. صفحةٌ بتخطيطٍ آخر
 * تُقرأ تطبيقاً آخر، والفرقُ بين الحالين ليس فرقَ تصميم.
 *
 * والثلاثةُ لا تظهر قبل القبول: الإهداء للأصدقاء وحدهم (القاعدة ٣٩)،
 * والمحادثةُ بابٌ بين اثنين، و«آثارنا» ما جمعكما ولمّا يجمعكما شيء.
 *
 * ولا عددَ أصدقائه هنا: عددُ الدائرة يقول عن صاحبها ما لم يأذن بقوله
 * (القاعدة ٨٧ب)، والصديق وحده يقرؤه.
 */
function LockedProfile({
  person,
  mutual,
  sentByMe,
  incoming,
  staff,
}: {
  person: Person;
  mutual: number;
  sentByMe: boolean;
  incoming: string | null;
  /** المشرفُ يُراسل أيَّ حسابٍ بلا إضافة (القاعدة ٣١٧). */
  staff: boolean;
}) {
  return (
    <div className="screen">
      <ScreenHeader title={person.name} back="/circle" />

      <div className="scroll-area">
        <ProfileHead
          person={person}
          extra={mutual > 0 ? (mutual === 1 ? "صديق مشترك واحد" : `${ar(mutual)} أصدقاء مشتركين`) : null}
          avatar={
            <Avatar
              name={person.name}
              size={104}
              frame={person.frame}
              charm={person.charm}
              mediaId={person.avatarMediaId}
            />
          }
        >
            {incoming ? (
              <>
                <form action={acceptFriend.bind(null, incoming)} className="flex grow">
                  <button
                    type="submit"
                    className="flex grow items-center justify-center gap-1.5 rounded-xl px-4 text-[13.5px] font-bold"
                    style={{ height: 46, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                  >
                    <CheckIcon size={16} />
                    اقبل
                  </button>
                </form>
                <form action={ignoreFriend.bind(null, incoming)}>
                  <button
                    type="submit"
                    aria-label="تجاهل"
                    className="flex w-11 items-center justify-center rounded-xl border border-line bg-card text-muted"
                    style={{ height: 46 }}
                  >
                    <CloseIcon size={17} />
                  </button>
                </form>
              </>
            ) : sentByMe ? (
              <span
                className="flex grow items-center justify-center rounded-xl border border-line bg-card px-4 text-[13px] font-semibold text-muted"
                style={{ height: 46 }}
              >
                طلبك معلّق
              </span>
            ) : (
              <form action={requestFriend.bind(null, person.id)} className="flex grow">
                <button
                  type="submit"
                  className="brand-gradient grow rounded-xl px-4 text-[13.5px] font-bold"
                  style={{ height: 46, color: "var(--color-on-brand)" }}
                >
                  أضفه
                </button>
              </form>
            )}
            {staff ? <ChatButton id={person.id} /> : null}
        </ProfileHead>

        {/* مكانُ اللحظات يقول لماذا لا تُرى — لا فراغٌ يُقرأ «ما نشر شي». */}
        <div className="px-5">
          <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-card p-4">
            <span className="mt-0.5 shrink-0 text-muted">
              <LockIcon size={16} />
            </span>
            <p className="text-[12.5px] leading-relaxed text-muted">
              لن تتمكّن من مشاهدة لحظاته حتى تضيفه إلى دائرتك ويقبل طلبك.
              والمحادثة و«آثارنا» والإهداء تُفتح بعدها. الدائرة الصغيرة تعني
              أن ما يُنشر فيها لا يُرى من خارجها.
            </p>
          </div>
        </div>
      </div>

      <TabBar active="/circle" />
    </div>
  );
}

const ACTION =
  "flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-[13.5px] font-semibold text-ink";

/** زرُّ المحادثة بمقاس صفّ الأزرار (٤٦) — قرصٌ في طرف الصفّ كالجوّال. */
function ChatButton({ id }: { id: string }) {
  return (
    <form action={startConversation.bind(null, id)}>
      <button
        type="submit"
        aria-label="محادثة"
        className="flex w-[46px] items-center justify-center rounded-xl border border-line bg-card text-ink-2"
        style={{ height: 46 }}
      >
        <MessageIcon size={18} />
      </button>
    </form>
  );
}

/**
 * رأسُ ملف الصديق بهيئة «أنا» — نسخةُ `ProfileHead` في الجوّال (القاعدة ٢٣٣): الغلاف،
 * ثمّ الصورةُ (١٠٤) في طرف البداية تعبر حافّته والاسمُ ووسمُه بجانبها، ثمّ سطرُ العضويّة
 * بعرض الشاشة، ثمّ صفُّ الأزرار بمقاسٍ واحد. بلا عددِ أصدقائه (القاعدة ٨٧ب).
 */
function ProfileHead({
  person,
  avatar,
  extra = null,
  actions = null,
  children,
}: {
  /** أقراصُ الأفعال في طرف سطر الاسم — ملفُّ الصديق (القاعدة ٣٢٠). */
  actions?: React.ReactNode;
  person: Person;
  avatar: React.ReactNode;
  /** سطرٌ يُلحق بالعضويّة — «صديق مشترك واحد» في بطاقة من ليس صديقاً. */
  extra?: string | null;
  children: React.ReactNode;
}) {
  const line = [
    `عضوية رقم ${ar(person.memberNo)}`,
    person.handle ? `\u2068@${person.handle}\u2069` : null,
    person.city,
    `لك معانا ${membership(person.createdAt)}`,
    extra,
  ].filter(Boolean);
  return (
    <>
      <div className="relative shrink-0 overflow-hidden" style={{ height: 176 }}>
        <CoverLayer
          mediaId={person.coverMediaId}
          themeMediaId={person.background?.coverMediaId}
          spec={person.background?.spec}
          x={person.coverX}
          y={person.coverY}
          zoom={person.coverZoom}
        />
      </div>
      <div className="relative px-5" style={{ marginTop: -52 }}>
        <div className="flex items-end gap-3">
          <div className="shrink-0">{avatar}</div>
          <h1 className="flex min-w-0 grow items-center gap-2 pb-3 text-[20px] font-bold text-ground-ink">
            <span dir="auto" className="truncate">{person.name}</span>
            <NameTag isPlus={person.isPlus} tag={person.tag} size={12} />
          </h1>
          {actions ? <div className="flex shrink-0 items-center gap-1.5 pb-2">{actions}</div> : null}
        </div>
        {person.bio ? (
          <p dir="auto" className="mt-1 text-[13px] leading-relaxed text-ground-ink">
            {person.bio}
          </p>
        ) : null}
        <p className="mt-1.5 text-[12.5px] text-ground-ink">{line.join("  │  ")}</p>
        <div className="mb-2 mt-3.5 flex gap-2.5">{children}</div>
      </div>
    </>
  );
}
