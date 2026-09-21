import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unblockUser } from "@/app/actions";
import { Avatar, Empty, ScreenHeader } from "@/components/ui";
import { ar } from "@/lib/format";

export default async function BlockedPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const rows = await prisma.block.findMany({
    where: { blockerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      blocked: { select: { id: true, name: true, memberNo: true, avatarMediaId: true } },
    },
  });

  return (
    <div className="screen">
      <ScreenHeader title="المحظورون" back="/settings" />

      <main className="scroll-area px-5 py-4">
        <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
          الحظر في الاتجاهين: لا ترى لحظاته ولا يراها، ولا يتفاعل معك. والصداقة
          تُفكّ عند الحظر.
        </p>

        {rows.length === 0 ? (
          <Empty title="ما فيه محظورون" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-center gap-3 p-3"
                style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-line)" }}
              >
                <Avatar name={row.blocked.name} size={42} mediaId={row.blocked.avatarMediaId} />
                <span className="min-w-0 grow">
                  <span className="block truncate text-[14px] font-semibold">{row.blocked.name}</span>
                  <span className="block text-[11.5px] text-faint">
                    عضوية {ar(row.blocked.memberNo)}
                  </span>
                </span>
                <form action={unblockUser.bind(null, row.blocked.id)}>
                  <button
                    type="submit"
                    className="h-10 rounded-xl border border-line px-3.5 text-[12.5px] font-semibold text-ink-2"
                  >
                    فكّ الحظر
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
