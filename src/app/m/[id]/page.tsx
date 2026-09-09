import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { circleIds } from "@/lib/circle";
import { momentById } from "@/lib/feed";
import { addComment } from "@/app/actions";
import { Avatar, ScreenHeader } from "@/components/ui";
import { SeenTracker } from "@/components/interactive";
import { Reactions, Reactors } from "@/components/reactions";
import { EyeIcon } from "@/components/icons";
import { ar, relative, timeOfDay } from "@/lib/format";

export default async function MomentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) redirect("/login");

  const moment = await momentById(id);
  if (!moment) notFound();

  // لا استكشاف عام: اللحظة لصاحبها ولدائرته فقط.
  const ids = await circleIds(user.id);
  if (moment.author.id !== user.id && !ids.includes(moment.author.id)) notFound();

  const mine = moment.reactions.find((r) => r.userId === user.id) ?? null;
  const withNames = moment.tags.map((t) => t.user.name);
  const commentOn = addComment.bind(null, moment.id);

  return (
    <div className="screen">
      <SeenTracker momentId={moment.id} />

      {moment.imageSpec ? (
        <div className="relative shrink-0" style={{ height: 300, background: moment.imageSpec }}>
          <a
            href="/"
            aria-label="رجوع"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(11,17,32,.55)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5efe7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </a>
        </div>
      ) : (
        <ScreenHeader title="لحظة" back="/" />
      )}

      <main className="scroll-area px-5 pt-4">
        <div className="mb-3 flex items-center gap-2.5">
          <Avatar name={moment.author.name} size={36} frameSpec={moment.author.frame?.spec} />
          <div className="grow">
            <p className="text-[14px] font-semibold">{moment.author.name}</p>
            <p className="text-[11px] text-faint">
              {timeOfDay(moment.createdAt)}
              {moment.placeCity ? ` · ${moment.placeCity}` : null}
            </p>
          </div>
        </div>

        {moment.text ? (
          <p className="mb-4 text-[14.5px] leading-loose text-ink">{moment.text}</p>
        ) : null}

        {withNames.length > 0 ? (
          <p className="mb-4 text-[12.5px] text-muted">مع {withNames.join(" و")}</p>
        ) : null}

        <div className="mb-3.5">
          <Reactors reactions={moment.reactions} viewerId={user.id} />
        </div>

        <div className="mb-3.5">
          <Reactions
            momentId={moment.id}
            mine={mine}
            count={moment.reactions.length}
            isPlus={user.isPlus}
          />
        </div>

        <section className="mb-3.5 rounded-2xl border border-line bg-card px-4 py-3.5">
          <p className="mb-3 flex items-center gap-2 text-[11.5px] font-semibold text-ink-2">
            <EyeIcon size={15} />
            شافها {ar(moment.views.length)} من {ar(ids.length)}
          </p>
          {moment.views.length > 0 ? (
            <div className="flex items-center">
              {moment.views.slice(0, 5).map((v, i) => (
                <div key={v.user.id} style={{ marginRight: i === 0 ? 0 : -10 }}>
                  <Avatar name={v.user.name} size={29} ring="var(--color-card)" />
                </div>
              ))}
              {moment.views.length > 5 ? (
                <span className="mr-2 text-[11px] font-semibold text-muted">
                  +{ar(moment.views.length - 5)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-[12px] text-faint">ما شافها أحد بعد</p>
          )}
        </section>

        <section className="flex flex-col gap-3.5">
          {moment.comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar name={comment.user.name} size={32} />
              <div className="grow">
                <p className="text-[13px] leading-relaxed">
                  <span className="font-semibold">{comment.user.name}</span>{" "}
                  <span className="text-ink-2">{comment.body}</span>
                </p>
                <p className="mt-1 text-[10.5px] text-faint">{relative(comment.createdAt)}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <form action={commentOn} className="flex items-center gap-2 px-5 pb-8 pt-3">
        <input
          name="body"
          required
          maxLength={500}
          placeholder="اكتب تعليق…"
          className="grow rounded-full border border-line bg-card px-5 text-[13.5px] outline-none focus:border-clay"
          style={{ height: 48 }}
        />
        <button
          type="submit"
          className="brand-gradient shrink-0 rounded-full px-5 text-[13.5px] font-bold"
          style={{ height: 48, color: "var(--color-on-brand)" }}
        >
          إرسال
        </button>
      </form>
    </div>
  );
}
