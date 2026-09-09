import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { circleIds } from "@/lib/circle";
import { plusTag, tagOf } from "@/lib/tags";
import { Avatar, Empty, ScreenHeader, TabBar, TagPill } from "@/components/ui";
import { ar } from "@/lib/format";

/** آثارنا: اختر صاحباً لترى خطّكما المشترك. */
export default async function TogetherPickPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const ids = await circleIds(user.id);
  const [friends, auto] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        memberNo: true,
        isPlus: true,
        avatarMediaId: true,
        frame: { select: { spec: true } },
        tag: { select: { name: true, bg: true, fg: true } },
      },
      orderBy: { name: "asc" },
    }),
    plusTag(),
  ]);

  return (
    <div className="screen">
      <ScreenHeader title="آثارنا" back="/" />

      <main className="scroll-area px-5">
        <p className="py-3 text-[11.5px] leading-relaxed text-muted">
          لكل صداقة أثر: اللحظات التي جمعتكما — ما أُشير فيه إلى الآخر، أو ترك
          عليه أثراً بتفاعل أو تعليق.
        </p>

        {friends.length === 0 ? (
          <Empty title="ما عندك أصدقاء بعد" hint="أضف من دائرة أصدقائك أولاً." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {friends.map((friend, index) => (
              <Link
                key={friend.id}
                href={`/together/${friend.id}`}
                className="flex items-center gap-3 p-3"
                style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
              >
                <Avatar
                  name={friend.name}
                  size={44}
                  frameSpec={friend.frame?.spec}
                  mediaId={friend.avatarMediaId}
                />
                <span className="min-w-0 grow">
                  <span className="flex items-center gap-1.5 truncate text-[14.5px] font-semibold">
                    {friend.name}
                    <TagPill tag={tagOf(friend, auto)} size={10} />
                  </span>
                  <span className="block text-[11.5px] text-faint">
                    عضوية {ar(friend.memberNo)}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-clay-ink">أثرنا</span>
              </Link>
            ))}
          </div>
        )}
      </main>

      <TabBar active="/" />
    </div>
  );
}
