import { maskPresence } from "@/lib/presence";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { unreadCount } from "@/lib/dm";
import { CIRCLE_CAP, circleIds } from "@/lib/circle";
import { Avatar, NameTag } from "@/components/ui";
import { CheckIcon, CloseIcon, GearIcon, MessageIcon } from "@/components/icons";
import { CircleStrip } from "@/components/circle-strip";
import { acceptFriend, ignoreFriend } from "@/app/actions";
import type { SessionUser } from "@/lib/auth";
import { storyRings } from "@/lib/stories";
import { listNotes } from "@/lib/notes";
import { DeskChatButton, FriendsDesk } from "./friends-desk";
import { ar, presence, relative } from "@/lib/format";

const ONLINE_MS = 3 * 60_000;

/**
 * عمود الأصدقاء على يمين سطح المكتب — **بقرار المالك**، بهيئة تبويب الأصدقاء
 * في الجوّال (القاعدة ٢٦٨ و٢٧٣): شريطُ القصص والنوت في أعلاه، ثمّ طلباتُ
 * الصداقة تُقبل في مكانها، ثمّ المتصلون الآن، ثمّ بقيّةُ الدائرة. وكلُّ صفٍّ
 * يفتح الملفّ وبجانبه بابُ المحادثة في العمود نفسه (القاعدة ٢٠٠).
 * ولا مقترحون: العمودُ لمن في دائرتك (القاعدة ٢٢٧).
 */
export async function FriendsPanel({ user }: { user: SessionUser }) {
  const userId = user.id;
  const ids = await circleIds(userId);
  const [members, requests, unread, rings, notes, groups] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        isPlus: true,
        lastSeenAt: true,
        hideOnline: true,
        avatarMediaId: true,
        frame: { select: { spec: true, mediaId: true, frameHole: true } },
        charm: { select: { spec: true, mediaId: true } },
        tag: { select: { name: true, bg: true, fg: true } },
      },
    }).then(maskPresence),
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        requester: {
          select: {
            id: true,
            name: true,
            isPlus: true,
            avatarMediaId: true,
            frame: { select: { spec: true, mediaId: true, frameHole: true } },
            charm: { select: { spec: true, mediaId: true } },
            tag: { select: { name: true, bg: true, fg: true } },
          },
        },
      },
    }),
    unreadCount(userId),
    storyRings(userId),
    listNotes(userId),
    prisma.friendGroup.findMany({
      where: { ownerId: userId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const now = Date.now();
  const online = (at: Date | null) => Boolean(at && now - at.getTime() < ONLINE_MS);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "ar");
  const live = members.filter((m) => online(m.lastSeenAt)).sort(byName);
  const rest = members.filter((m) => !online(m.lastSeenAt)).sort(byName);
  const share = Math.min(100, Math.round((members.length / CIRCLE_CAP) * 100));

  const row = (member: (typeof members)[number]) => {
    const on = online(member.lastSeenAt);
    return (
      <div key={member.id} className="desk-row group">
        <Link href={`/u/${member.id}`} className="flex min-w-0 grow items-center gap-3">
          <span className="relative shrink-0">
            <Avatar name={member.name} size={42} frame={member.frame} charm={member.charm} mediaId={member.avatarMediaId} />
            {on ? (
              <span
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full"
                style={{ background: "#2f9e58", border: "2px solid var(--color-card)" }}
              />
            ) : null}
          </span>
          <span className="min-w-0 grow">
            <span className="flex min-w-0 items-center gap-1.5">
              <span dir="auto" className="truncate text-[14px] font-semibold">
                {member.name}
              </span>
              <NameTag isPlus={member.isPlus} tag={member.tag} size={9} />
            </span>
            <span className="block truncate text-[11.5px]" style={{ color: on ? "#2f9e58" : "var(--color-faint)" }}>
              {presence(member.lastSeenAt) || "ما فتح التطبيق بعد"}
            </span>
          </span>
        </Link>
        <DeskChatButton friendId={member.id} name={member.name} />
      </div>
    );
  };

  return (
    <FriendsDesk>
      <section className="desk-panel">
        <header className="desk-panel-head">
          <div className="min-w-0 grow">
            <h2 className="text-[17px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
              الأصدقاء
            </h2>
            {/* السقفُ مقياسٌ لا رقمٌ وحده: كم بقي في الدائرة يُرى قبل أن يُقرأ (القاعدة ١). */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="desk-meter w-20" aria-hidden="true">
                <span style={{ width: `${Math.max(share, members.length ? 3 : 0)}%` }} />
              </div>
              <p className="text-[11px] text-muted">
                {ar(members.length)} من {ar(CIRCLE_CAP)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* والمحادثاتُ هنا لا في عمود «أنا» (القاعدة ٢٠٠). */}
            <Link href="/messages" aria-label="المحادثات" className="desk-icon-btn relative">
              <MessageIcon size={19} />
              {unread > 0 ? (
                <span className="desk-tab-badge absolute -right-1 -top-1">{ar(unread)}</span>
              ) : null}
            </Link>
            <Link href="/circle" aria-label="إدارة الدائرة" className="desk-icon-btn">
              <GearIcon size={18} />
            </Link>
          </div>
        </header>

        <div className="desk-panel-body pb-3">
          <div className="pt-1" style={{ borderBottom: "1px solid var(--color-line)" }}>
            <CircleStrip
              rings={rings}
              notes={notes}
              me={{ id: user.id, name: user.name, avatarMediaId: user.avatarMediaId }}
              groups={groups}
            />
          </div>

          {requests.length > 0 ? (
            <>
              <p className="desk-section" style={{ color: "var(--color-clay-ink)" }}>
                طلبات الصداقة · {ar(requests.length)}
              </p>
              {requests.map((request) => (
                <div key={request.id} className="desk-row">
                  <Link href={`/u/${request.requester.id}`} className="flex min-w-0 grow items-center gap-3">
                    <Avatar
                      name={request.requester.name}
                      size={42}
                      frame={request.requester.frame}
                      charm={request.requester.charm}
                      mediaId={request.requester.avatarMediaId}
                    />
                    <span className="min-w-0 grow">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span dir="auto" className="truncate text-[14px] font-semibold">
                          {request.requester.name}
                        </span>
                        <NameTag isPlus={request.requester.isPlus} tag={request.requester.tag} size={9} />
                      </span>
                      <span className="block text-[11.5px] text-faint">طلب {relative(request.createdAt)}</span>
                    </span>
                  </Link>
                  <form action={acceptFriend.bind(null, request.id)} className="shrink-0">
                    <button
                      type="submit"
                      aria-label={`اقبل ${request.requester.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
                    >
                      <CheckIcon size={16} />
                    </button>
                  </form>
                  <form action={ignoreFriend.bind(null, request.id)} className="shrink-0">
                    <button
                      type="submit"
                      aria-label={`تجاهل ${request.requester.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted"
                    >
                      <CloseIcon size={15} />
                    </button>
                  </form>
                </div>
              ))}
            </>
          ) : null}

          {members.length === 0 ? (
            <p className="px-6 py-10 text-center text-[12.5px] leading-relaxed text-muted">
              دائرتك فارغة بعد. شارك رابط ملفّك مع من تعرف من «أنا».
            </p>
          ) : (
            <>
              {live.length > 0 ? (
                <>
                  <p className="desk-section" style={{ color: "#2f9e58" }}>
                    متصل الآن · {ar(live.length)}
                  </p>
                  {live.map(row)}
                </>
              ) : null}
              {rest.length > 0 ? (
                <>
                  <p className="desk-section">
                    {live.length > 0 ? "غير متصل" : "دائرتك"} · {ar(rest.length)}
                  </p>
                  {rest.map(row)}
                </>
              ) : null}
            </>
          )}
        </div>
      </section>
    </FriendsDesk>
  );
}
