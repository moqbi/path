import Link from "next/link";
import { prisma } from "@/lib/db";
import { CIRCLE_CAP, circleIds } from "@/lib/circle";
import { startConversation } from "@/app/actions";
import { Avatar, NameTag } from "@/components/ui";
import { MessageIcon } from "@/components/icons";
import { ar, presence } from "@/lib/format";

const ONLINE_MS = 3 * 60_000;

/**
 * عمود الأصدقاء على يمين سطح المكتب — **بقرار المالك**.
 *
 * دائرتك كلّها بين يديك: المتصلون أولاً ثمّ البقيّة بالاسم، وكلُّ صفٍّ
 * يفتح الملف وبجانبه بابُ المحادثة. والطلباتُ المعلّقة سطرٌ في أعلاه يأخذ
 * إلى تبويب الأصدقاء حيث تُقبل — لا نسخةٌ ثانية من أدواته هنا.
 * ولا مقترحون: العمودُ لمن في دائرتك، والاقتراحُ في تبويبه لمن يطلبه.
 */
export async function FriendsPanel({ userId }: { userId: string }) {
  const ids = await circleIds(userId);
  const [members, pending] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        isPlus: true,
        lastSeenAt: true,
        avatarMediaId: true,
        frame: { select: { spec: true, mediaId: true, frameHole: true } },
        charm: { select: { spec: true, mediaId: true } },
        tag: { select: { name: true, bg: true, fg: true } },
      },
    }),
    prisma.friendship.count({ where: { addresseeId: userId, status: "PENDING" } }),
  ]);

  const now = Date.now();
  const online = (at: Date | null) => Boolean(at && now - at.getTime() < ONLINE_MS);
  const ordered = [...members].sort((a, b) => {
    const diff = Number(online(b.lastSeenAt)) - Number(online(a.lastSeenAt));
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "ar");
  });
  const live = ordered.filter((m) => online(m.lastSeenAt)).length;

  return (
    <section className="desk-panel">
      <header className="desk-panel-head">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
            الأصدقاء
          </h2>
          <p className="text-[11.5px] text-muted">
            {ar(members.length)} من {ar(CIRCLE_CAP)}
            {live ? ` · ${ar(live)} متصل الآن` : ""}
          </p>
        </div>
        <Link href="/circle" className="shrink-0 text-[12px] font-semibold text-clay-ink">
          إدارة الدائرة
        </Link>
      </header>

      {pending > 0 ? (
        <Link
          href="/circle"
          className="mx-3 mb-2 flex items-center justify-between rounded-xl px-3 py-2.5 text-[12.5px] font-semibold"
          style={{ background: "var(--color-live-soft)", color: "var(--color-live)" }}
        >
          <span>طلبات إضافة تنتظرك</span>
          <span>{ar(pending)}</span>
        </Link>
      ) : null}

      <div className="desk-panel-body">
        {ordered.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] leading-relaxed text-muted">
            دائرتك فارغة بعد. شارك رابط ملفّك مع من تعرف من تبويب «أنا».
          </p>
        ) : (
          ordered.map((member) => {
            const on = online(member.lastSeenAt);
            return (
              <div key={member.id} className="desk-row group">
                <Link href={`/u/${member.id}`} className="flex min-w-0 grow items-center gap-3">
                  <span className="relative shrink-0">
                    <Avatar
                      name={member.name}
                      size={40}
                      frame={member.frame}
                      charm={member.charm}
                      mediaId={member.avatarMediaId}
                    />
                    {on ? (
                      <span
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-full"
                        style={{ background: "#2f9e58", border: "2px solid var(--color-card)" }}
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 grow">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span dir="auto" className="truncate text-[13.5px] font-semibold">
                        {member.name}
                      </span>
                      <NameTag isPlus={member.isPlus} tag={member.tag} size={9} />
                    </span>
                    <span className="block truncate text-[11px] text-faint">
                      {presence(member.lastSeenAt) || " "}
                    </span>
                  </span>
                </Link>
                <form action={startConversation.bind(null, member.id)} className="shrink-0">
                  <button
                    type="submit"
                    aria-label={`محادثة مع ${member.name}`}
                    className="desk-icon-btn"
                  >
                    <MessageIcon size={17} />
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
