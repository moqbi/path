import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CIRCLE_CAP, circleIds } from "@/lib/circle";
import { presentNow } from "@/lib/feed";
import { Avatar, ScreenHeader, TabBar } from "@/components/ui";
import { SparkIcon, WithIcon } from "@/components/icons";
import { ar, relative, until } from "@/lib/format";

export default async function CirclePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const ids = await circleIds(user.id);
  const [members, present] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        isPlus: true,
        frame: { select: { spec: true } },
        moments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { name: "asc" },
    }),
    presentNow(user.id),
  ]);

  const presentIds = new Set(present.map((p) => p.author.id));
  const filled = ids.length / CIRCLE_CAP;
  const circumference = 2 * Math.PI * 57;

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenHeader
        title="دائرتك"
        action={
          <button
            type="button"
            aria-label="أضف"
            className="flex h-11 w-11 items-center justify-center text-ink-2"
          >
            <WithIcon size={20} />
          </button>
        }
      />

      <div className="px-5 pb-5 pt-6 text-center">
        <div className="relative mx-auto mb-4" style={{ width: 128, height: 128 }}>
          <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
            <defs>
              <linearGradient id="circle-fill" x1="0" y1="128" x2="128" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFB75E" />
                <stop offset="1" stopColor="#FF7A7A" />
              </linearGradient>
            </defs>
            <circle cx="64" cy="64" r="57" fill="none" stroke="var(--color-line)" strokeWidth="7" />
            <circle
              cx="64"
              cy="64"
              r="57"
              fill="none"
              stroke="url(#circle-fill)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - filled)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[40px] leading-none" style={{ fontFamily: "var(--font-display)" }}>
              {ar(ids.length)}
            </span>
            <span className="mt-1 text-[11.5px] text-muted">من {ar(CIRCLE_CAP)}</span>
          </div>
        </div>
        <p className="mx-auto max-w-[292px] text-[13px] leading-loose text-ink-2">
          السقف {ar(CIRCLE_CAP)} ولا يُشترى. الدائرة الصغيرة هي الشيء الوحيد الذي لا يقدر أي
          تطبيق آخر أن يعطيك إياه.
        </p>
      </div>

      <main className="grow px-5">
        {present.length > 0 ? (
          <>
            <p className="mb-2.5 text-[11.5px] font-semibold tracking-wide text-faint">
              حاضر الآن · {ar(present.length)}
            </p>
            {present.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="relative shrink-0">
                  <Avatar name={p.author.name} size={44} frameSpec={p.author.frame?.spec} />
                  <span
                    className="absolute bottom-0 left-0 h-3 w-3 rounded-full"
                    style={{ background: "var(--color-live)", border: "2.5px solid var(--color-paper)" }}
                  />
                </div>
                <div className="grow">
                  <p className="mb-0.5 text-[14.5px] font-semibold">{p.author.name}</p>
                  <p className="text-[11.5px] text-live">
                    في {p.placeName}
                    {p.expiresAt ? ` · ${until(p.expiresAt)}` : null}
                  </p>
                </div>
              </div>
            ))}
            <div className="my-3.5 h-px bg-line" />
          </>
        ) : null}

        <p className="mb-2.5 text-[11.5px] font-semibold tracking-wide text-faint">الكل</p>
        {members.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">دائرتك فاضية.</p>
        ) : (
          members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-2.5">
              <Avatar name={member.name} size={44} frameSpec={member.frame?.spec} />
              <div className="grow">
                <p className="mb-0.5 flex items-center gap-1.5 text-[14.5px] font-semibold">
                  {member.name}
                  {member.isPlus ? <SparkIcon size={13} className="text-gold" /> : null}
                </p>
                <p className="text-[11.5px] text-faint">
                  {presentIds.has(member.id)
                    ? "حاضر الآن"
                    : member.moments[0]
                      ? `آخر لحظة ${relative(member.moments[0].createdAt)}`
                      : "لا لحظات بعد"}
                </p>
              </div>
            </div>
          ))
        )}
      </main>

      <TabBar active="/circle" />
    </div>
  );
}
