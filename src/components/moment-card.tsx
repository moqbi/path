import Link from "next/link";
import { Avatar } from "@/components/ui";
import {
  EyeIcon,
  MoonIcon,
  MusicIcon,
  PinIcon,
  PlaneIcon,
  PlayIcon,
  WithIcon,
} from "@/components/icons";
import { MomentBar } from "@/components/moment-bar";
import { Reactors } from "@/components/reactions";
import { ar, relative, timeOfDay } from "@/lib/format";
import type { FeedMoment } from "@/lib/feed";

/** بعد هذا العدد تُفتح اللحظة لقراءة بقية التعليقات، وقبله لا داعي. */
const INLINE_COMMENTS = 3;

/**
 * الأحداث تُكتب سطراً على الورق لا بطاقةً: وصولٌ إلى مدينة، نوم، مكان،
 * صديق جديد، أغنية. البطاقة تُحفظ لما له متن — صورة أو خاطرة — وهكذا
 * كان Path: الخطّ الزمني يوميّات، والأحداث أسطرٌ فيها.
 */
const EVENTS = new Set(["CITY", "PLACE", "SLEEP", "MUSIC", "FRIEND_ADDED"]);

const EVENT_STYLE: Record<string, { bg: string; ink: string }> = {
  CITY: { bg: "var(--color-night)", ink: "#f7f5ef" },
  PLACE: { bg: "var(--color-live-soft)", ink: "var(--color-live)" },
  SLEEP: { bg: "var(--color-night-2)", ink: "#f7f5ef" },
  MUSIC: { bg: "var(--color-clay)", ink: "var(--color-on-brand)" },
  FRIEND_ADDED: { bg: "var(--color-gold-soft)", ink: "var(--color-gold-ink)" },
};

function EventIcon({ kind }: { kind: string }) {
  const style = EVENT_STYLE[kind] ?? EVENT_STYLE.PLACE;
  const glyph =
    kind === "CITY" ? (
      <PlaneIcon size={16} />
    ) : kind === "SLEEP" ? (
      <MoonIcon size={16} />
    ) : kind === "MUSIC" ? (
      <MusicIcon size={16} />
    ) : kind === "FRIEND_ADDED" ? (
      <WithIcon size={16} />
    ) : (
      <PinIcon size={16} />
    );

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{ background: style.bg, color: style.ink }}
    >
      {glyph}
    </span>
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
 * تُعرض ثلاثة، وما زاد يُقرأ بفتح اللحظة — فلا تبتلع لحظةٌ واحدة الشاشة.
 */
function Comments({ moment }: { moment: FeedMoment }) {
  if (moment.comments.length === 0) return null;
  const hidden = moment._count.comments - moment.comments.length;

  return (
    <div className="flex flex-col gap-2">
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

/**
 * صندوق ما تحت الحدث: من تفاعل وما كُتب.
 * الحدث نفسه سطرٌ عارٍ، وما يجتمع حوله من ناس يجلس في قالبٍ أبيض تحته —
 * فيُقرأ الفرق بين ما قاله صاحبه وما ردّ به الناس.
 */
function Bubble({ moment, circleSize }: { moment: FeedMoment; circleSize: number }) {
  const hasComments = moment.comments.length > 0;
  const hasReactions = moment.reactions.length > 0;
  if (!hasComments && !hasReactions) return null;

  return (
    <div className="mt-2 rounded-2xl border border-line bg-card px-3 py-2.5">
      {hasReactions ? <Reactors reactions={moment.reactions} /> : null}
      {hasReactions && hasComments ? <div className="my-2.5 h-px bg-line" /> : null}
      <Comments moment={moment} />
      <p className="mt-2 flex items-center justify-end gap-1.5 text-[10.5px] text-faint">
        <EyeIcon size={13} />
        {ar(moment._count.views)}/{ar(circleSize)}
      </p>
    </div>
  );
}

function Row({
  moment,
  viewerId,
  children,
}: {
  moment: FeedMoment;
  viewerId: string;
  children: React.ReactNode;
}) {
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

/** عنوان الحدث وسطره الثاني — بلا إطار، على ورق الخط الزمني نفسه. */
function EventLine({
  moment,
  withNames,
}: {
  moment: FeedMoment;
  withNames: string[];
}) {
  const { kind } = moment;

  const title =
    kind === "CITY" ? (
      <>
        وصل إلى <span className="font-bold">{moment.text ?? "مدينة"}</span>
      </>
    ) : kind === "SLEEP" ? (
      <span className="font-bold">نام</span>
    ) : kind === "FRIEND_ADDED" ? (
      <>
        أصبح صديق <span className="font-bold">{moment.text ?? "أحدهم"}</span>
      </>
    ) : kind === "MUSIC" ? (
      <>
        يسمع <span className="font-bold">{moment.musicTitle ?? "أغنية"}</span>
        {moment.musicArtist ? (
          <>
            {" "}
            لـ<span className="font-bold">{moment.musicArtist}</span>
          </>
        ) : null}
      </>
    ) : (
      <>
        في <span className="font-bold">{moment.placeName ?? "مكان"}</span>
      </>
    );

  const subtitle =
    kind === "MUSIC"
      ? null
      : kind === "PLACE"
        ? [moment.placeCity, moment.text].filter(Boolean).join(" · ") || null
        : kind === "SLEEP"
          ? "تصبح على خير"
          : null;

  return (
    <div className="flex items-start gap-2.5">
      <EventIcon kind={kind} />
      <div className="min-w-0 grow pt-1">
        <p dir="auto" className="text-[13.5px] leading-snug text-ink">
          {title}
        </p>
        {subtitle ? (
          <p dir="auto" className="mt-0.5 truncate text-[12px] text-muted">
            {subtitle}
          </p>
        ) : null}
        {withNames.length > 0 ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
            <WithIcon size={12} />
            مع {withNames.join(" و")}
          </p>
        ) : null}
      </div>

      {moment.kind === "MUSIC" && moment.musicThumb ? (
        <span
          className="h-11 w-11 shrink-0 rounded-xl bg-cover bg-center"
          style={{ backgroundImage: `url(${moment.musicThumb})` }}
        />
      ) : null}
      {moment.kind === "MUSIC" && moment.musicUrl ? (
        <a
          href={moment.musicUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="استمع"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--color-clay-soft)", color: "var(--color-clay-ink)" }}
        >
          <PlayIcon size={16} />
        </a>
      ) : null}
    </div>
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
  circleSize: number;
  isPlus: boolean;
}) {
  const { author, kind } = moment;
  const withNames = moment.tags.map((t) => t.user.name);
  const mine = moment.reactions.find((r) => r.userId === viewerId) ?? null;
  // الفتح في صفحة مستقلة له معنى واحد: تعليقات لم تسعها البطاقة.
  const opens = moment._count.comments > INLINE_COMMENTS;

  if (EVENTS.has(kind)) {
    const line = <EventLine moment={moment} withNames={withNames} />;

    return (
      <Row moment={moment} viewerId={viewerId}>
        <MomentBar
          momentId={moment.id}
          mine={mine}
          isPlus={isPlus}
          head={
            opens ? (
              <Link href={`/m/${moment.id}`} className="block">
                {line}
              </Link>
            ) : (
              line
            )
          }
          extra={
            <>
              {moment.mediaId ? (
                <div
                  className="mt-2.5 overflow-hidden rounded-2xl"
                  style={{
                    height: 190,
                    backgroundImage: `url(/api/media/${moment.mediaId})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : null}
              <Bubble moment={moment} circleSize={circleSize} />
            </>
          }
        />
      </Row>
    );
  }

  // ما له متن — صورة أو خاطرة — يبقى في بطاقته.
  const head = (
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
          {moment.reactions.length > 0 ? <Reactors reactions={moment.reactions} /> : null}
          {moment.comments.length > 0 ? (
            <div className="mt-2.5 border-t border-line pt-2.5">
              <Comments moment={moment} />
            </div>
          ) : null}
          <p className="mt-2 flex items-center justify-end gap-1.5 text-[10.5px] text-faint">
            <EyeIcon size={13} />
            {ar(moment._count.views)}/{ar(circleSize)}
          </p>
          <MomentBar momentId={moment.id} mine={mine} isPlus={isPlus} />
        </div>
      </div>
    </Row>
  );
}
