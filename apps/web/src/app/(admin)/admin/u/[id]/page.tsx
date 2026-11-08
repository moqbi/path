import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ScreenHeader } from "@/components/ui";
import { ar, dayLabel, relative, timeOfDay } from "@/lib/format";
import { linkedAccounts } from "@/lib/linked";
import { setOpenAccount, setUserTag } from "@/app/actions";
import { TagPill } from "@/components/ui";
import { coinText } from "@/lib/format";
import { Suspend } from "../../suspend";
import { PlusGrant } from "../../plus";
import { CoinsGrant } from "../../coins";
import { AdminEmail } from "../../email";
import { RemoveMoment } from "./remove";

export const metadata: Metadata = { title: "حساب · لوحة التحكم" };

/** قسمٌ بعنوانه — بطاقةٌ واحدة لكلّ شأن، لا جدارٌ واحد يُمرَّر (القاعدة ٤٢٩). */
function Section({ title, hint, children, open = true }: { title: string; hint?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="mb-3 rounded-2xl border border-line bg-card">
      <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-bold">{title}</summary>
      <div className="border-t border-line px-4 py-3">
        {hint ? <p className="mb-2 text-[11px] leading-relaxed text-faint">{hint}</p> : null}
        {children}
      </div>
    </details>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[12.5px]">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 truncate text-left font-semibold">{value}</span>
    </div>
  );
}

const when = (date: Date | null | undefined) =>
  date ? `${date.toLocaleDateString("ar-SA-u-ca-gregory")} · ${timeOfDay(date)}` : "—";

/**
 * لحظات حسابٍ بعينه — بابُ الإشراف.
 *
 * البلاغ يصل على منشور، فلا يكفي أن يقرأ المشرف نصّاً منسوخاً في صفّ
 * البلاغ: يحتاج أن يفتح الحساب ويرى ما حوله ثمّ يحكم. وهذا **خارج
 * `visibleWhere()`** قصداً ومن بابٍ واحد ظاهر (القاعدة ٢٣): توسعةُ شرط
 * الرؤية بحقلٍ في صفّ القارئ تجعل كلّ استعلامٍ في التطبيق يحمل ثقباً.
 *
 * والصلاحية تُقرأ من الصفّ في كل زيارة لا من الجلسة وحدها، وكلُّ حذفٍ
 * يُختم في `ModerationLog`: من مُنح هذا الباب يُعرف ما فعل به.
 */
const KIND: Record<string, string> = {
  PHOTO: "صورة",
  PLACE: "مكان",
  THOUGHT: "خاطرة",
  MUSIC: "أغنية",
  SLEEP: "نام",
  WAKE: "صحا",
  CITY: "انتقل",
  FRIEND_ADDED: "صديق جديد",
  GIFT_SENT: "أهدى",
  GIFT_GOT: "وصلته هدية",
};

export default async function ModeratedProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  /*
    صفحةُ الحساب لمن يدير الحسابات (المالك وممنوحُ اللوحة كلّها) ولمن يملك الإشراف.
    واللحظاتُ للإشراف وحده — من يمنح وسماً لا يحتاج أن يقرأ لحظات الناس (القاعدة ١٠٩).
  */
  const owner = viewer.role === "ADMIN";
  const manager = owner || viewer.adminScope === "ALL";
  if (!manager && !viewer.canModerate) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      memberNo: true,
      name: true,
      handle: true,
      email: true,
      emailVerifiedAt: true,
      passwordHash: true,
      city: true,
      lastCity: true,
      bio: true,
      createdAt: true,
      lastSeenAt: true,
      coins: true,
      isPlus: true,
      plusUntil: true,
      plusGiftUntil: true,
      plusEndedAt: true,
      isOpen: true,
      tagId: true,
      tag: true,
      suspendedUntil: true,
      suspendedReason: true,
      notifyDm: true,
      notifyComment: true,
      notifyReaction: true,
      invitedBy: { select: { id: true, name: true, memberNo: true } },
      identities: { select: { provider: true } },
      devices: { select: { platform: true, createdAt: true, seenAt: true }, orderBy: { seenAt: "desc" } },
      _count: {
        select: {
          moments: true,
          comments: true,
          stories: true,
          friendshipsSent: { where: { status: "ACCEPTED" } },
          friendshipsReceived: { where: { status: "ACCEPTED" } },
          invitees: true,
          reportsAgainst: true,
          blocksGot: true,
        },
      },
    },
  });
  if (!person) notFound();

  const now = new Date();
  const [tags, purchases, stickerBuys, topUps, grants, plusSent, plusGot, giftsSent, sessions, access, tickets, billing] =
    await Promise.all([
      prisma.tag.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
      prisma.purchase.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true, paidCoins: true, createdAt: true, expiresAt: true,
          item: { select: { name: true, kind: true } },
          giftedBy: { select: { id: true, name: true, memberNo: true } },
        },
      }),
      prisma.stickerPurchase.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        select: { id: true, paidCoins: true, createdAt: true, pack: { select: { name: true } }, giftedBy: { select: { name: true, memberNo: true } } },
      }),
      prisma.coinTopUp.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, coins: true, paidHalalas: true, source: true, createdAt: true } }),
      prisma.coinGrant.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, coins: true, note: true, invites: true, createdAt: true } }),
      prisma.plusGift.findMany({ where: { giverId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, plan: true, status: true, createdAt: true, recipient: { select: { id: true, name: true, memberNo: true } } } }),
      prisma.plusGift.findMany({ where: { recipientId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, plan: true, status: true, createdAt: true, giver: { select: { id: true, name: true, memberNo: true } } } }),
      prisma.purchase.findMany({
        where: { giftedById: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, paidCoins: true, createdAt: true, item: { select: { name: true } }, user: { select: { id: true, name: true, memberNo: true } } },
      }),
      prisma.refreshToken.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { family: true, device: true, createdAt: true, revokedAt: true, expiresAt: true },
      }),
      prisma.accessEvent.findMany({ where: { userId: id }, orderBy: { lastAt: "desc" }, take: 8, select: { ip: true, device: true, firstAt: true, lastAt: true, hits: true } }),
      prisma.supportTicket.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, body: true, createdAt: true, reply: true } }).catch(() => [] as { id: string; body: string; createdAt: Date; reply: string | null }[]),
      prisma.billingEvent.findMany({ where: { appUserId: id }, orderBy: { at: "desc" }, take: 10, select: { type: true, at: true } }).catch(() => [] as { type: string; at: Date }[]),
    ]);

  /*
    الجلساتُ عائلات (القاعدة ٤٢٨): كلُّ دخولٍ عائلةٌ تُدوَّر توكناتُها. الحيّةُ ما فيها توكنٌ
    غيرُ مُبطَل ولا منتهٍ، والمنتهيةُ تقول متى انتهت — خروجٌ بيده، أو إلغاءٌ من الخادم.
  */
  const families = new Map<string, { device: string | null; started: Date; last: Date; alive: boolean; endedAt: Date | null }>();
  for (const token of sessions) {
    const row = families.get(token.family) ?? { device: token.device, started: token.createdAt, last: token.createdAt, alive: false, endedAt: null };
    if (token.createdAt < row.started) row.started = token.createdAt;
    if (token.createdAt > row.last) row.last = token.createdAt;
    if (!token.revokedAt && token.expiresAt > now) row.alive = true;
    if (token.revokedAt && (!row.endedAt || token.revokedAt > row.endedAt)) row.endedAt = token.revokedAt;
    families.set(token.family, row);
  }
  const familyRows = [...families.values()].sort((a, b) => b.last.getTime() - a.last.getTime()).slice(0, 8);

  /*
    المشاكلُ تُقرأ من الصفوف لا تُخمَّن: ما يمنع التنبيه، وما يمنع الدخول، وما أخرجه.
  */
  const problems: string[] = [];
  if (person.suspendedUntil && person.suspendedUntil > now) problems.push(`موقوف حتى ${when(person.suspendedUntil)}${person.suspendedReason ? ` — ${person.suspendedReason}` : ""}`);
  if (person.devices.length === 0) problems.push("لا جهاز مسجّل للتنبيهات — لم يسمح بالتنبيهات أو لم يدخل من الجوّال");
  if (person.email && !person.emailVerifiedAt) problems.push("البريد غير مؤكَّد — لا يستعيد حسابه به");
  if (!person.email && !person.passwordHash && person.identities.length <= 1) problems.push("لا بريد ولا كلمة مرور — بابُه الوحيد مزوّدُه، فإن فقده فقد الحساب");
  if (![...families.values()].some((row) => row.alive)) problems.push("لا جلسة حيّة على أيّ جهاز — خرج أو أُخرج، فيحتاج أن يدخل من جديد");
  const lostRecently = familyRows.filter((row) => !row.alive && row.endedAt && now.getTime() - row.endedAt.getTime() < 14 * 86_400_000);
  if (lostRecently.length > 0) problems.push(`انتهت ${ar(lostRecently.length)} جلسة في أسبوعين — آخرها ${when(lostRecently[0].endedAt)}`);
  if (!person.lastSeenAt || now.getTime() - person.lastSeenAt.getTime() > 14 * 86_400_000) problems.push(`لم يظهر منذ ${person.lastSeenAt ? relative(person.lastSeenAt) : "التسجيل"}`);
  if (access.length === 0) problems.push("لم يصل إلى الخادم طلبٌ موثَّقٌ منه بعد — إن قال «network request failed» فالطلبُ لا يخرج من جهازه أو شبكته");
  if (person._count.reportsAgainst > 0) problems.push(`بلاغات عليه: ${ar(person._count.reportsAgainst)}`);

  const friends = person._count.friendshipsSent + person._count.friendshipsReceived;
  const plusLive = person.isPlus && person.plusUntil && person.plusUntil > now;

  const { linked, crowded } = await linkedAccounts(id);

  const moments = !viewer.canModerate ? [] : await prisma.moment.findMany({
    where: { authorId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      text: true,
      placeName: true,
      placeCity: true,
      musicTitle: true,
      musicArtist: true,
      mediaId: true,
      audience: true,
      createdAt: true,
      _count: { select: { reactions: true, comments: true } },
    },
  });

  return (
    <div className="screen">
      <ScreenHeader title="حساب" back="/admin?s=users" />

      <main className="scroll-area admin-narrow px-5 pb-10 pt-4">
        <div className="mb-3 rounded-2xl border border-line bg-card p-4">
          <p className="flex items-center gap-2 text-[16px] font-bold">
            <bdi>{person.name}</bdi>
            <TagPill tag={person.tag} size={11} />
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            عضو رقم {ar(person.memberNo)}
            {person.handle ? <> · <bdi dir="ltr">@{person.handle}</bdi></> : null}
          </p>
          <p dir="ltr" className="text-right text-[11.5px] text-faint">{person.email ?? "بلا بريد"}</p>
          {person.bio ? <p dir="auto" className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{person.bio}</p> : null}
          <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
            {[
              ["الرصيد", coinText(person.coins)],
              ["لحظات", ar(person._count.moments)],
              ["أصدقاء", ar(friends)],
              ["دعا", ar(person._count.invitees)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl py-2" style={{ background: "var(--color-chip)" }}>
                <div className="text-[13.5px] font-bold">{value}</div>
                <div className="text-[10.5px] text-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <Section title={problems.length ? `مشاكل (${ar(problems.length)})` : "مشاكل"} hint="ما يُقرأ من صفوفه: التنبيه والدخول والجلسات. بدايةُ مساعدته من هنا.">
          {problems.length === 0 ? (
            <p className="text-[12.5px] text-muted">لا شيء ظاهر.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {problems.map((line) => (
                <li key={line} className="rounded-xl px-3 py-2 text-[12.5px] leading-relaxed" style={{ background: "var(--color-live-soft)", color: "var(--color-ink)" }}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="الحساب">
          <Row label="سجّل" value={when(person.createdAt)} />
          <Row label="آخر ظهور" value={person.lastSeenAt ? `${relative(person.lastSeenAt)} — ${when(person.lastSeenAt)}` : "لم يفتح التطبيق"} />
          <Row label="المدينة" value={person.city ?? person.lastCity ?? "—"} />
          <Row label="الدخول" value={[person.passwordHash ? "كلمة مرور" : null, ...person.identities.map((row) => row.provider)].filter(Boolean).join(" · ") || "—"} />
          <Row label="البريد" value={person.email ? (person.emailVerifiedAt ? "مؤكَّد" : "غير مؤكَّد") : "لا بريد"} />
          <Row label="آثار+" value={plusLive ? `مشترك حتى ${when(person.plusUntil)}${person.plusGiftUntil && person.plusGiftUntil > now ? " (بهدية)" : ""}` : person.plusEndedAt ? `انتهى ${when(person.plusEndedAt)}` : "غير مشترك"} />
          <Row label="الحساب" value={person.isOpen ? "مفتوح" : "عادي"} />
          <Row label="دعاه" value={person.invitedBy ? <Link href={`/admin/u/${person.invitedBy.id}`} className="text-clay-ink"><bdi>{person.invitedBy.name}</bdi> · {ar(person.invitedBy.memberNo)}</Link> : "—"} />
          <Row label="تعليقات · قصص" value={`${ar(person._count.comments)} · ${ar(person._count.stories)}`} />
          <Row label="حظره" value={`${ar(person._count.blocksGot)} حساب`} />
        </Section>

        <Section title="الأجهزة والجلسات" hint="الجلسة دخولٌ على جهاز. «انتهت» = خرج بيده أو أُبطلت. والتنبيهات تصل إلى الأجهزة المسجّلة وحدها.">
          <p className="mb-1 text-[12px] font-semibold">أجهزة التنبيهات</p>
          {person.devices.length === 0 ? <p className="mb-2 text-[12px] text-muted">لا شيء.</p> : person.devices.map((device, index) => (
            <Row key={index} label={device.platform} value={`مسجّل ${when(device.createdAt)} · آخر تأكيد ${relative(device.seenAt)}`} />
          ))}
          <p className="mb-1 mt-2 text-[12px] font-semibold">الجلسات</p>
          {familyRows.length === 0 ? <p className="text-[12px] text-muted">لا جلسات.</p> : familyRows.map((row, index) => (
            <Row
              key={index}
              label={row.device ?? "جهاز"}
              value={row.alive ? `حيّة · آخر تجديد ${relative(row.last)}` : `انتهت ${when(row.endedAt)}`}
            />
          ))}
          <p className="mb-1 mt-2 text-[12px] font-semibold">آخر الوصول</p>
          {access.length === 0 ? <p className="text-[12px] text-muted">لا شيء.</p> : access.map((row, index) => (
            <Row key={index} label={<bdi dir="ltr">{row.ip || "—"}</bdi> as unknown as string} value={`${row.device ? "جوّال" : "ويب"} · ${ar(row.hits)} مرّة · آخرها ${relative(row.lastAt)}`} />
          ))}
        </Section>

        <Section title={`المشتريات (${ar(purchases.length + stickerBuys.length)})`} open={false}>
          {purchases.length + stickerBuys.length === 0 ? <p className="text-[12px] text-muted">لا شيء.</p> : null}
          {purchases.map((row) => (
            <Row
              key={row.id}
              label={row.item.name}
              value={`${row.giftedBy ? `هدية من ${row.giftedBy.name}` : coinText(row.paidCoins)} · ${when(row.createdAt)}${row.expiresAt ? (row.expiresAt > now ? ` · حتى ${when(row.expiresAt)}` : " · انتهت") : ""}`}
            />
          ))}
          {stickerBuys.map((row) => (
            <Row key={row.id} label={`ملصقات: ${row.pack.name}`} value={`${row.giftedBy ? `هدية من ${row.giftedBy.name}` : coinText(row.paidCoins)} · ${when(row.createdAt)}`} />
          ))}
        </Section>

        <Section title="النقاط والفوترة" open={false}>
          <p className="mb-1 text-[12px] font-semibold">شحن</p>
          {topUps.length === 0 ? <p className="text-[12px] text-muted">لا شيء.</p> : topUps.map((row) => (
            <Row key={row.id} label={`${coinText(row.coins)} · ${row.source}`} value={when(row.createdAt)} />
          ))}
          <p className="mb-1 mt-2 text-[12px] font-semibold">منح</p>
          {grants.length === 0 ? <p className="text-[12px] text-muted">لا شيء.</p> : grants.map((row) => (
            <Row key={row.id} label={`${coinText(row.coins)}${row.invites ? " · دعوات" : ""}`} value={`${row.note ?? ""} ${when(row.createdAt)}`} />
          ))}
          <p className="mb-1 mt-2 text-[12px] font-semibold">أحداث المتجر</p>
          {billing.length === 0 ? <p className="text-[12px] text-muted">لا شيء.</p> : billing.map((row, index) => (
            <Row key={index} label={row.type} value={when(row.at)} />
          ))}
        </Section>

        <Section title="الهدايا" open={false}>
          <p className="mb-1 text-[12px] font-semibold">أهدى</p>
          {giftsSent.length + plusSent.length === 0 ? <p className="text-[12px] text-muted">لا شيء.</p> : null}
          {giftsSent.map((row) => (
            <Row key={row.id} label={`${row.item.name} ← ${row.user.name}`} value={`${coinText(row.paidCoins)} · ${when(row.createdAt)}`} />
          ))}
          {plusSent.map((row) => (
            <Row key={row.id} label={`آثار+ ${row.plan === "year" ? "سنة" : "شهر"} ← ${row.recipient.name}`} value={`${row.status === "DONE" ? "تمّ" : "معلّق"} · ${when(row.createdAt)}`} />
          ))}
          <p className="mb-1 mt-2 text-[12px] font-semibold">وصله</p>
          {purchases.filter((row) => row.giftedBy).length + plusGot.length === 0 ? <p className="text-[12px] text-muted">لا شيء.</p> : null}
          {purchases.filter((row) => row.giftedBy).map((row) => (
            <Row key={row.id} label={`${row.item.name} من ${row.giftedBy!.name}`} value={when(row.createdAt)} />
          ))}
          {plusGot.map((row) => (
            <Row key={row.id} label={`آثار+ ${row.plan === "year" ? "سنة" : "شهر"} من ${row.giver.name}`} value={`${row.status === "DONE" ? "تمّ" : "معلّق"} · ${when(row.createdAt)}`} />
          ))}
        </Section>

        {tickets.length > 0 ? (
          <Section title={`رسائل الدعم (${ar(tickets.length)})`} open={false}>
            {tickets.map((row) => (
              <div key={row.id} className="mb-2 rounded-xl px-3 py-2 text-[12px]" style={{ background: "var(--color-chip)" }}>
                <p dir="auto" className="line-clamp-3">{row.body}</p>
                <p className="mt-1 text-[11px] text-faint">{when(row.createdAt)} · {row.reply ? "رُدّ عليها" : "بلا ردّ"}</p>
              </div>
            ))}
          </Section>
        ) : null}

        {manager ? (
          <Section title="الإجراءات" hint="كلُّ إجراءٍ يفحص الصلاحية في الخادم — إخفاؤه هنا ليس حماية (القاعدة ١٣).">
            <form action={setUserTag.bind(null, person.id)} className="mb-2 flex items-center gap-2">
              <span className="shrink-0 text-[12px] text-muted">الوسم</span>
              <select name="tagId" defaultValue={person.tagId ?? ""} className="h-10 min-w-0 grow rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none">
                <option value="">بلا وسم</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
              <button type="submit" className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-bold" style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}>
                احفظ
              </button>
            </form>
            <div className="-mx-4 flex flex-col">
              {viewer.canModerate ? <Suspend userId={person.id} until={person.suspendedUntil} reason={person.suspendedReason} /> : null}
              <PlusGrant userId={person.id} until={person.plusUntil} />
              <CoinsGrant userId={person.id} />
              {owner ? <AdminEmail userId={person.id} current={person.email} /> : null}
              {owner ? (
                <form action={setOpenAccount.bind(null, person.id, !person.isOpen)} className="flex items-center gap-2 border-t border-line px-4 py-2.5">
                  <button type="submit" className="text-[12px] font-semibold text-clay-ink">
                    {person.isOpen ? "أغلقه" : "افتحه للجميع"}
                  </button>
                  <span className="text-[11px] text-faint">{person.isOpen ? "مفتوح — يُضيفه الجميع" : "حسابٌ عاديّ"}</span>
                </form>
              ) : null}
            </div>
          </Section>
        ) : viewer.canModerate ? (
          <Section title="الإجراءات">
            <div className="-mx-4 flex flex-col">
              <Suspend userId={person.id} until={person.suspendedUntil} reason={person.suspendedReason} />
            </div>
          </Section>
        ) : null}

        {/*
          الحسابات المرتبطة (القاعدة ١٩٤): من يتهرّب من إيقافٍ بحسابٍ ثانٍ
          يُعرف بجهازه. قرينةٌ تُقرأ قبل الحكم لا حكمٌ بنفسها.
        */}
        <section className="mb-4 rounded-2xl border border-line bg-card p-4">
          <p className="text-[13.5px] font-bold">الحسابات المرتبطة</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
            من دخل من الجهاز نفسه أو الشبكة نفسها في آخر ٩٠ يوماً. الجهاز قرينةٌ
            قويّة، والشبكة ضعيفة — بيتٌ أو مقهى أو شبكةُ جوّال.
          </p>
          {linked.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-muted">لا حسابات مرتبطة.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-1.5">
              {linked.map((other) => (
                <Link
                  key={other.id}
                  href={`/admin/u/${other.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                  style={{ background: "var(--color-chip)" }}
                >
                  <span className="min-w-0">
                    <span dir="auto" className="block truncate text-[13px] font-semibold">
                      {other.name}
                    </span>
                    <span className="block text-[11px] text-muted">
                      عضو رقم {ar(other.memberNo)} · آخر ظهور {relative(other.lastAt)}
                      {other.suspendedUntil && other.suspendedUntil > new Date() ? " · موقوف" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {other.device ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "var(--color-live-soft)", color: "var(--color-live)" }}
                      >
                        الجهاز نفسه
                      </span>
                    ) : null}
                    {other.ips > 0 ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "var(--color-card)", color: "var(--color-muted)" }}
                      >
                        {other.ips === 1 ? "الشبكة نفسها" : `${ar(other.ips)} شبكات مشتركة`}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {crowded > 0 ? (
            <p className="mt-2 text-[10.5px] text-faint">
              تُرك {ar(crowded)} {crowded === 1 ? "عنوانٌ مزدحم" : "عناوين مزدحمة"} — يدخل منها
              أكثرُ من ١٢ حساباً فلا تقول شيئاً.
            </p>
          ) : null}
        </section>

        {viewer.canModerate ? <h2 className="mb-2 mt-4 px-1 text-[14px] font-bold">لحظاته</h2> : null}
        {viewer.canModerate && moments.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted">لا لحظات في هذا الحساب.</p>
        ) : null}

        <div className="flex flex-col gap-2">
          {moments.map((moment) => (
            <article key={moment.id} className="rounded-2xl border border-line bg-card p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}
                >
                  {KIND[moment.kind] ?? moment.kind}
                </span>
                <span className="text-[11px] text-faint">
                  {dayLabel(moment.createdAt)} · {timeOfDay(moment.createdAt)}
                </span>
                {moment.audience !== "CIRCLE" ? (
                  <span className="text-[11px] text-faint">
                    · {moment.audience === "GROUP" ? "تصنيف" : moment.audience === "EXCEPT" ? "ما عدا تصنيف" : "أشخاص"}
                  </span>
                ) : null}
              </div>

              {moment.text ? (
                <p dir="auto" className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                  {moment.text}
                </p>
              ) : null}
              {moment.placeName ? (
                <p dir="auto" className="text-[13px]">
                  {moment.placeName}
                  {moment.placeCity ? ` · ${moment.placeCity}` : ""}
                </p>
              ) : null}
              {moment.musicTitle ? (
                <p dir="auto" className="text-[13px]">
                  {moment.musicTitle}
                  {moment.musicArtist ? ` — ${moment.musicArtist}` : ""}
                </p>
              ) : null}

              {/*
                والصورة تُقرأ من `/api/media` بجلسة المشرف: البابُ يفحص
                الصلاحية بنفسه (القاعدة ٢٣ب)، فلا يُفتح بمعرّفٍ وحده.
              */}
              {moment.mediaId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/${moment.mediaId}`}
                  alt=""
                  className="mt-2 max-h-[280px] w-full rounded-xl object-cover"
                />
              ) : null}

              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="text-[11px] text-faint">
                  {ar(moment._count.reactions)} تفاعل · {ar(moment._count.comments)} تعليق
                </span>
                <RemoveMoment momentId={moment.id} />
              </div>
            </article>
          ))}
        </div>

        <Link
          href="/admin?s=reports"
          className="mt-6 block text-center text-[12.5px] font-semibold text-clay-ink"
        >
          إلى البلاغات
        </Link>
      </main>
    </div>
  );
}
