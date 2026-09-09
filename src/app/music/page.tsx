import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { disconnectMusic } from "@/app/actions";
import { ScreenHeader } from "@/components/ui";
import { MusicIcon, InfoIcon, CheckIcon } from "@/components/icons";

export default async function MusicPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { empty } = await searchParams;
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { musicProvider: true, musicAccountName: true },
  });

  // الربط لا يعمل بلا مفاتيح تطبيق من سبوتيفاي، ولا يُدّعى خلاف ذلك.
  const spotifyReady = Boolean(process.env.SPOTIFY_CLIENT_ID);

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenHeader title="الموسيقى" back="/" />

      <main className="grow px-5 py-5">
        <p className="mb-6 text-[13.5px] leading-loose text-muted">
          لحظة الأغنية تُنشر من الحساب المربوط تلقائياً — ما تكتب الاسم والفنان بيدك.
        </p>

        {empty ? (
          <p
            className="mb-4 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed"
            style={{ background: "var(--color-live-soft)", color: "var(--color-live)" }}
          >
            ما فيه شي يُسمع الآن. شغّل أغنية ثم جرّب مرة ثانية.
          </p>
        ) : null}

        {account?.musicProvider ? (
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "var(--color-clay-soft)", color: "var(--color-clay)" }}
              >
                <CheckIcon size={20} />
              </span>
              <div>
                <p className="text-[14px] font-semibold">
                  {account.musicProvider === "SPOTIFY" ? "سبوتيفاي" : "أنغامي"} مربوط
                </p>
                {account.musicAccountName ? (
                  <p className="text-[11.5px] text-muted">{account.musicAccountName}</p>
                ) : null}
              </div>
            </div>
            <form action={disconnectMusic}>
              <button
                type="submit"
                className="h-11 w-full rounded-xl border border-line text-[13.5px] font-semibold text-muted"
              >
                فكّ الربط
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <a
              href={spotifyReady ? "/api/music/spotify/start" : undefined}
              aria-disabled={!spotifyReady}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
              style={{ opacity: spotifyReady ? 1 : 0.5, pointerEvents: spotifyReady ? "auto" : "none" }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--color-chip)", color: "var(--color-clay)" }}
              >
                <MusicIcon size={20} />
              </span>
              <div className="grow">
                <p className="text-[14px] font-semibold">اربط سبوتيفاي</p>
                <p className="text-[11.5px] text-muted">
                  {spotifyReady ? "ينشر ما تسمعه الآن" : "غير مفعّل — يحتاج مفاتيح التطبيق"}
                </p>
              </div>
            </a>

            <div
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
              style={{ opacity: 0.5 }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--color-chip)", color: "var(--color-muted)" }}
              >
                <MusicIcon size={20} />
              </span>
              <div className="grow">
                <p className="text-[14px] font-semibold">أنغامي</p>
                <p className="text-[11.5px] text-muted">تحتاج اعتماد شريك من أنغامي</p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 text-[11.5px] leading-relaxed text-faint">
          <InfoIcon size={14} className="mt-0.5 shrink-0" />
          <span>
            سبوتيفاي تحتاج <code className="latin">SPOTIFY_CLIENT_ID</code> و
            <code className="latin"> SPOTIFY_CLIENT_SECRET</code> من لوحة مطوّري سبوتيفاي،
            مع تسجيل رابط العودة <code className="latin">/api/music/spotify/callback</code>.
          </span>
        </p>
      </main>
    </div>
  );
}
