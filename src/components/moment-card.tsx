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
import { InlineComment } from "@/components/interactive";
import { Reactions } from "@/components/reactions";
import { ar, relative, timeOfDay } from "@/lib/format";
import type { FeedMoment } from "@/lib/feed";

/** لحظة سطر واحد: وصل مكاناً، نام، يسمع أغنية، أضاف صديقاً. */
function InlineMoment({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pt-1.5">
      <span className="text-muted">{icon}</span>
      <p className="text-[13.5px] text-ink-2">{children}</p>
    </div>
  );
}

function Spine({
  name,
  frameSpec,
  mediaId,
  at,
}: {
  name: string;
  frameSpec?: string | null;
  mediaId?: string | null;
  at: Date;
}) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
      <Avatar name={name} size={34} frameSpec={frameSpec} mediaId={mediaId} />
      <span className="text-[10px] text-faint">{timeOfDay(at)}</span>
    </div>
  );
}

/** التعليقات تحت اللحظة في الخط الزمني نفسه — لا حاجة لفتحها لقراءتها. */
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
        <Link href={`/m/${moment.id}`} className="text-[11.5px] text-clay">
          و{ar(hidden)} تعليق آخر
        </Link>
      ) : null}
    </div>
  );
}

function Footer({
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
  const mine = moment.reactions.find((r) => r.userId === viewerId) ?? null;

  return (
    <div className="flex items-center justify-between">
      <Reactions
        momentId={moment.id}
        mine={mine}
        count={moment.reactions.length}
        isPlus={isPlus}
      />
      <span className="flex items-center gap-1.5 text-[11px] text-faint">
        <EyeIcon size={14} />
        شافها {ar(moment._count.views)} من {ar(circleSize)}
      </span>
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
  isPlus: boolean;
  circleSize: number;
}) {
  const { author, kind } = moment;
  const withNames = moment.tags.map((t) => t.user.name);

  // الأغنية بطاقتها الخاصة: الغلاف والعنوان اللاتيني لا يستقيمان داخل سطر عربي.
  if (kind === "MUSIC") {
    const body = (
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cover bg-center"
          style={{
            backgroundImage: moment.musicThumb ? `url(${moment.musicThumb})` : undefined,
            background: moment.musicThumb ? undefined : "var(--color-chip)",
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
      <article className="relative flex gap-3 pb-5">
        <Spine
          name={author.name}
          frameSpec={author.frame?.spec}
          mediaId={author.avatarMediaId}
          at={moment.createdAt}
        />
        <div className="min-w-0 grow rounded-2xl border border-line bg-card p-3">
          {moment.musicUrl ? (
            <a href={moment.musicUrl} target="_blank" rel="noreferrer noopener">
              {body}
            </a>
          ) : (
            body
          )}
        </div>
      </article>
    );
  }

  // اللحظات السطرية: بلا بطاقة، وبلا تعليقات — لا شيء يُعلَّق عليه.
  if (kind === "SLEEP" || kind === "FRIEND_ADDED") {
    const icon = kind === "SLEEP" ? <MoonIcon size={15} /> : <WithIcon size={15} />;

    return (
      <article className="relative flex gap-3 pb-5">
        <Spine
          name={author.name}
          frameSpec={author.frame?.spec}
          mediaId={author.avatarMediaId}
          at={moment.createdAt}
        />
        <div className="min-w-0 grow">
          <InlineMoment icon={icon}>
            {kind === "SLEEP" ? (
              <>نام</>
            ) : (
              <>
                أضاف <span className="font-semibold text-ink">{moment.text}</span> إلى دائرته
              </>
            )}
          </InlineMoment>
        </div>
      </article>
    );
  }

  // مكان، صورة، فكرة: بطاقة قابلة للفتح، وتعليقاتها ظاهرة تحتها.
  return (
    <article className="relative flex gap-3 pb-5">
      <Spine
          name={author.name}
          frameSpec={author.frame?.spec}
          mediaId={author.avatarMediaId}
          at={moment.createdAt}
        />
      <div className="min-w-0 grow overflow-hidden rounded-2xl border border-line bg-card">
        <Link href={`/m/${moment.id}`} className="block">
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

          <div className="px-4 pb-1 pt-3">
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
              <p className="mb-2.5 text-[13.5px] leading-relaxed text-ink">{moment.text}</p>
            ) : null}

            {withNames.length > 0 ? (
              <p className="flex items-center gap-1.5 text-[12px] text-muted">
                <WithIcon size={13} />
                مع {withNames.join(" و")}
              </p>
            ) : null}
          </div>
        </Link>

        <div className="px-4 pb-3 pt-2">
          <Footer
            moment={moment}
            viewerId={viewerId}
            isPlus={isPlus}
            circleSize={circleSize}
          />
          <Comments moment={moment} />
          <InlineComment momentId={moment.id} viewerId={viewerId} />
        </div>
      </div>
    </article>
  );
}
