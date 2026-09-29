import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { notifications, unseenCount } from "@/lib/notifications";
import { unreadCount } from "@/lib/dm";
import { NoteRow } from "@/components/note-row";
import { Avatar, coverStyle, NameTag } from "@/components/ui";
import { GearIcon, MessageIcon, SparkIcon, StoreIcon, UserIcon } from "@/components/icons";
import { ar, membership } from "@/lib/format";
import { PanelTabs } from "./panel-tabs";

/**
 * عمود «أنا» على يسار سطح المكتب، ومعه الإشعارات بتبديل — **بقرار المالك**.
 *
 * «أنا» بطاقةٌ لا صفحة: الغلافُ والصورةُ والاسمُ وثلاثةُ أرقام، ثمّ
 * الأبوابُ التي تُطلب منها — الملفّ الكامل والمحادثات والمتجر وآثار+
 * والإعدادات. والتحريرُ والإكسسوارات في «ملفّي» حيث بُنيت (القاعدة ٤٠)،
 * لا نسخةٌ ثانيةٌ منها هنا.
 */
export async function MePanel({ user }: { user: SessionUser }) {
  const [ids, moments, notes, fresh, unread] = await Promise.all([
    circleIds(user.id),
    prisma.moment.count({ where: { authorId: user.id } }),
    notifications(user.id, 30),
    unseenCount(user.id),
    unreadCount(user.id),
  ]);

  const me = (
    <div className="px-3 pb-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div
          className="h-[104px]"
          style={coverStyle(user.coverMediaId, user.background?.spec ?? null, user.coverY, user.coverX)}
        />
        <div className="-mt-9 flex flex-col items-center px-4 pb-4 text-center">
          <Link href="/me" aria-label="ملفّي">
            <Avatar
              name={user.name}
              size={72}
              frame={user.frame}
              charm={user.charm}
              mediaId={user.avatarMediaId}
            />
          </Link>
          <p className="mt-2 flex items-center gap-1.5">
            <span dir="auto" className="text-[16px] font-bold">
              {user.name}
            </span>
            <NameTag isPlus={user.isPlus} tag={user.tag} size={10} />
          </p>
          <p className="text-[11.5px] text-faint">
            رقم العضوية {ar(user.memberNo)} · {membership(user.createdAt)}
          </p>
          {user.bio ? (
            <p dir="auto" className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
              {user.bio}
            </p>
          ) : null}

          <div className="mt-3 grid w-full grid-cols-3 gap-2">
            {[
              { value: moments, label: "لحظة", href: "/me" },
              { value: ids.length, label: "صديق", href: "/circle" },
              { value: user.coins, label: "نقطة", href: "/coins" },
            ].map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="rounded-xl py-2"
                style={{ background: "var(--color-paper)" }}
              >
                <span className="block text-[16px] font-bold">{ar(stat.value)}</span>
                <span className="block text-[10.5px] text-muted">{stat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <nav className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
        {[
          { href: "/me", label: "ملفّي", icon: <UserIcon size={18} />, count: 0 },
          { href: "/messages", label: "المحادثات", icon: <MessageIcon size={18} />, count: unread },
          { href: "/store", label: "المتجر", icon: <StoreIcon size={18} />, count: 0 },
          {
            href: "/subscribe",
            label: user.isPlus ? "آثار+ — اشتراكك" : "آثار+",
            icon: <SparkIcon size={18} />,
            count: 0,
          },
          { href: "/settings", label: "الإعدادات والخصوصية", icon: <GearIcon size={18} />, count: 0 },
        ].map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className="desk-link"
            style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
          >
            <span className="text-muted">{item.icon}</span>
            <span className="min-w-0 grow">{item.label}</span>
            {item.count > 0 ? <span className="desk-tab-badge">{ar(item.count)}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );

  const list = (
    <div className="flex flex-col gap-2 px-3 pb-4">
      {notes.length === 0 ? (
        <p className="px-2 py-8 text-center text-[12.5px] leading-relaxed text-muted">
          ما فيه إشعارات. حين يتفاعل أحدٌ من أصدقائك أو يشير إليك يظهر هنا.
        </p>
      ) : (
        notes.map((note) => <NoteRow key={note.id} note={note} />)
      )}
      <Link href="/notifications" className="mt-1 text-center text-[12px] font-semibold text-clay-ink">
        كلّ الإشعارات
      </Link>
    </div>
  );

  return (
    <section className="desk-panel">
      <PanelTabs me={me} notes={list} badge={fresh > 0 ? ar(fresh) : null} />
    </section>
  );
}
