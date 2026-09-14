import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { circleIds } from "@/lib/circle";
import { momentById } from "@/lib/feed";
import { addComment } from "@/app/actions";
import { Avatar, NameTag, ScreenHeader } from "@/components/ui";
import { SeenTracker } from "@/components/interactive";
import { Reactions, Reactors } from "@/components/reactions";
import { CommentList } from "@/components/comments";
import { EVENTS, EventLine } from "@/components/moment-card";
import { Photo } from "@/components/photo";
import { PinIcon } from "@/components/icons";
import { ar, timeOfDay } from "@/lib/format";

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

      {/*
        الرأس واحدٌ لكل لحظة — بعلامته ورجوعه. قبلها كانت اللحظة المصوّرة
        تُخفيه وتضع سهماً عائماً فوق الصورة، فتختلف الشاشة عن بقية التطبيق.
      */}
      <ScreenHeader title="لحظة" back="/" mark />

      <main className="scroll-area px-5 pt-4">
        {/*
          قالبٌ واحد: المنشور، ثم خط، ثم التفاعلات، ثم خط، ثم التعليقات.
          قبله كانت الصفحة سطوراً سائبة فوق قالب تعليقاتٍ وحده، فتُقرأ
          التعليقات كأنها الموضوع واللحظة هامشٌ فوقها.
        */}
        <article className="mb-4 overflow-hidden rounded-2xl border border-line bg-card">
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar
                name={moment.author.name}
                size={36}
                frameSpec={moment.author.frame?.spec}
                charm={moment.author.charm}
                mediaId={moment.author.avatarMediaId}
              />
              <div className="min-w-0 grow">
                <p dir="auto" className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                  {moment.author.name}
                  <NameTag isPlus={moment.author.isPlus} tag={moment.author.tag} size={10} />
                </p>
                <p className="text-[11px] text-faint">
                  {timeOfDay(moment.createdAt)}
                  {moment.placeCity ? ` · ${moment.placeCity}` : null}
                </p>
              </div>
            </div>

            {/* الحدث سطرُه كما في الخط الزمني — بأيقونته وصورة أغنيته. */}
            {EVENTS.has(moment.kind) ? (
              <EventLine moment={moment} withNames={withNames} />
            ) : (
              <>
                {moment.mediaId ? (
                  <div className="mb-3">
                    <Photo mediaId={moment.mediaId} height={260} rounded />
                  </div>
                ) : moment.imageSpec ? (
                  <div
                    className="mb-3 rounded-2xl"
                    style={{ height: 220, background: moment.imageSpec }}
                  />
                ) : null}

                {moment.text ? (
                  <p dir="auto" className="text-[14.5px] leading-loose text-ink">
                    {moment.text}
                  </p>
                ) : null}

                {moment.placeName ? (
                  <p dir="auto" className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted">
                    <PinIcon size={13} />
                    {moment.placeName}
                  </p>
                ) : null}

                {withNames.length > 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted">مع {withNames.join(" و")}</p>
                ) : null}
              </>
            )}
          </div>

          <div className="h-px bg-line" />

          <div className="px-4 py-3.5">
            {moment.reactions.length > 0 ? (
              <div className="mb-3">
                <Reactors reactions={moment.reactions} viewerId={user.id} />
              </div>
            ) : null}
            <Reactions
              momentId={moment.id}
              momentKind={moment.kind}
              mine={mine}
              count={moment.reactions.length}
              isPlus={user.isPlus}
            />
          </div>

          <div className="h-px bg-line" />

          <section className="px-4 py-3.5">
            <p className="mb-3 text-[12px] font-semibold text-muted">
              التعليقات {moment.comments.length > 0 ? ar(moment.comments.length) : ""}
            </p>
            {moment.comments.length === 0 ? (
              <p className="py-2 text-center text-[12.5px] text-muted">
                ما علّق أحد بعد. اكتب أول سطر.
              </p>
            ) : (
              <CommentList comments={moment.comments} viewerId={user.id} size={30} />
            )}
          </section>
        </article>
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
