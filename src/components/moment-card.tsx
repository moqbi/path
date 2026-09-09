import Link from "next/link";
import { Avatar } from "@/components/ui";
import {
  EyeIcon,
  MusicIcon,
  PinIcon,
  PlayIcon,
  MoonIcon,
  WithIcon,
} from "@/components/icons";
import { MomentBar } from "@/components/moment-bar";
import { Reactors } from "@/components/reactions";
import { ar, relative, timeOfDay } from "@/lib/format";
import type { FeedMoment } from "@/lib/feed";

/** بعد هذا العدد تُفتح اللحظة لقراءة بقية التعليقات، وقبله لا داعي. */
const INLINE_COMMENTS = 3;

function InlineMoment({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pt-1.5">
      <span className="text-muted">{icon}</span>
      <p className="text-[13.5px] text-ink-2">{children}</p>
    </div>
  );
}

function Spine({
  authorId,
  viewerId,
  name,
  frameSpec,
  mediaId,
  at,
}: {
  authorId: string;
  viewerId: string;
  name: string;
  frameSpec?: string | null;
  mediaId?: string | null;
  at: Date;
}) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
      <Link
        href={authorId === viewerId ? "/me" : `/u/${authorId}`}
        aria-label={`ملف ${name}`}
      >
        <Avatar name={name} size={34} frameSpec={frameSpec} mediaId={mediaId} />
      </Link>
      <span className="text-[10px] text-faint">{timeOfDay(at)}</span>
    </div>
  );
}

/**
 * التعليقات داخل الخط الزمني.
 * تُعرض ثلاثة، وما زاد يُقرأ بفتح اللحظة — فلا تبتلع بطاقةٌ واحدة الشاشة.
 */
function Comments({ moment }: { moment: FeedMoment }) {
  if (moment.comments.length === 0) return null;
  const hidden = moment._count.comments - moment.comments.length;

  return (
    <div className="mt-2.5 flex flex-col gap-2 border-t border-line pt-2.5">
      {moment.comments.map((comment) => (
        <div key={comment.id} className="flex items-start gap-2">
          <Avatar name={comment.user.name} size={22} mediaId={comment.user.avatarMediaId} />
          <p className="min-w-0 grow break-words text-[12.5px] leading-relaxed">
            <span className="font-semibold">{comment.user.name}</span>{" "}
            <span className="text-ink-2">{comment.body}</span>
          </p>
          <span className="shrink-0 pt-0.5 text-[10px] text-faint">
            {relative(comment.createdAt)}
          </span>
        </div>
      ))}
      {hidden > 0 ? (
        <Link href={`/m/${moment.id}`} className="text-[11.5px] font-semibold text-clay-ink">
          اقرأ {ar(hidden)} تعليقاً آخر
        </Link>
      ) : null}
    </div>
  );
}

function Footer({ moment, circleSize }: { moment: FeedMoment; circleSize: number }) {
  const views = (
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-faint">
      <EyeIcon size={14} />
      {ar(moment._count.views)}/{ar(circleSize)}
    </span>
  );

  if (moment.reactions.length === 0) return <div className="flex justify-end">{views}</div>;

  return (
    <div className="flex items-center justify-between gap-2">
      <Reactors reactions={moment.reactions} />
      {views}
    </div>
  );
}

/** صف اللحظة: الصورة على الخط الزمني، وإلى جانبها البطاقة. */
function Row({ moment, viewerId, children }: { moment: FeedMoment; viewerId: string; children: React.ReactNode }) {
  return (
    <article className="relative flex items-start gap-2 pb-5">
      <Spine
        authorId={moment.author.id}
        viewerId={viewerId}
        name={moment.author.name}
        frameSpec={moment.author.frame?.spec}
        mediaId={moment.author.avatarMediaId}
        at={moment.createdAt}
      />
      <div className="min-w-0 grow">{children}</div>
    </article>
  );
}

export function MomentCard({
  moment,
  viewerId,
  isPlus,
  circleSize,
}: {
  moment: FeedMoment;
  viewerId: string;
  isPlus: boolean;
  circleSize: number;
}) {
  const { author, kind } = moment;
  const withNames = moment.tags.map((t) => t.user.name);
  // الفتح في صفحة مستقلة له معنى واحد: تعليقات لم تسعها البطاقة.
  const opens = moment._count.comments > INLINE_COMMENTS;
  const mine = moment.reactions.find((r) => r.userId === viewerId) ?? null;

  // «أصبح صديق فلان» سطر خبر: لا تفاعل عليه ولا تعليق.
  if (kind === "FRIEND_ADDED") {
    return (
      <article className="relative flex gap-2 pb-5">
        <Spine
          authorId={author.id}
          viewerId={viewerId}
          name={author.name}
          frameSpec={author.frame?.spec}
          mediaId={author.avatarMediaId}
          at={moment.createdAt}
        />
        <div className="min-w-0 grow">
          <InlineMoment icon={<WithIcon size={15} />}>
            أصبح صديق <span className="font-semibold text-ink">{moment.text}</span>
          </InlineMoment>
        </div>
      </article>
    );
  }

  // الأغنية: العنوان اللاتيني لا يستقيم داخل سطر عربي، فبطاقتها خاصة.
  if (kind === "MUSIC") {
    const body = (
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cover bg-center"
          style={{
            backgroundImage: moment.musicThumb ? `url(${moment.musicThumb})` : undefined,
            backgroundColor: moment.musicThumb ? undefined : "var(--color-chip)",
          }}
        >
          {moment.musicThumb ? null : <MusicIcon size={20} className="text-muted" />}
        </div>
        <div className="min-w-0 grow">
          <p className="mb-0.5 text-[11.5px] text-muted">يسمع</p>
          <p
            dir="auto"
            className="truncate text-[13.5px] font-semibold"
            style={{ color: moment.musicUrl ? "var(--color-clay-ink)" : "var(--color-ink)" }}
          >
            {moment.musicTitle ?? "أغنية"}
          </p>
          {moment.musicArtist ? (
            <p dir="auto" className="truncate text-[11.5px] text-muted">
              {moment.musicArtist}
            </p>
          ) : null}
        </div>
        {moment.musicUrl ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-clay-soft)", color: "var(--color-clay-ink)" }}
          >
            <PlayIcon size={17} />
          </span>
        ) : null}
      </div>
    );

    return (
      <Row moment={moment} viewerId={viewerId}>
        <div className="rounded-2xl border border-line bg-card p-3">
          {moment.musicUrl ? (
            <a href={moment.musicUrl} target="_blank" rel="noreferrer noopener">
              {body}
            </a>
          ) : (
            body
          )}
          <div className="pt-2.5">
            <Footer moment={moment} circleSize={circleSize} />
            <Comments moment={moment} />
            <MomentBar momentId={moment.id} mine={mine} isPlus={isPlus} />
          </div>
        </div>
      </Row>
    );
  }

  const head =
    kind === "SLEEP" ? (
      <p className="flex items-center gap-2.5 px-4 pt-3 text-[13.5px] text-ink-2">
        <MoonIcon size={16} className="text-muted" />
        نام
      </p>
    ) : (
      <>
        {moment.mediaId ? (
          <div
            style={{
              height: 200,
              backgroundImage: `url(/api/media/${moment.mediaId})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : moment.imageSpec ? (
          <div style={{ height: 132, background: moment.imageSpec }} />
        ) : null}

        <div className="px-4 pt-3">
          {kind === "PLACE" ? (
            <p className="mb-2 flex items-center gap-2 text-[13.5px] text-ink-2">
              <PinIcon size={15} className="text-live" />
              <span>
                في <span className="font-semibold text-ink">{moment.placeName ?? "مكان"}</span>
                {moment.placeCity ? <span className="text-muted"> · {moment.placeCity}</span> : null}
              </span>
            </p>
          ) : null}

          {moment.text ? (
            <p className="mb-2 text-[13.5px] leading-relaxed text-ink">{moment.text}</p>
          ) : null}

          {withNames.length > 0 ? (
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <WithIcon size={13} />
              مع {withNames.join(" و")}
            </p>
          ) : null}
        </div>
      </>
    );

  return (
    <Row moment={moment} viewerId={viewerId}>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {opens ? (
          <Link href={`/m/${moment.id}`} className="block">
            {head}
          </Link>
        ) : (
          head
        )}

        <div className="px-4 pb-3 pt-2">
          <Footer moment={moment} circleSize={circleSize} />
          <Comments moment={moment} />
          <MomentBar momentId={moment.id} mine={mine} isPlus={isPlus} />
        </div>
      </div>
    </Row>
  );
}
