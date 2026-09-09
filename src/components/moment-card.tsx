import Link from "next/link";
import { Avatar } from "@/components/ui";
import {
  EyeIcon,
  MusicIcon,
  PinIcon,
  MoonIcon,
  WithIcon,
  ReactionFace,
} from "@/components/icons";
import { InlineComment } from "@/components/interactive";
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

function Spine({ name, frameSpec, at }: { name: string; frameSpec?: string | null; at: Date }) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
      <Avatar name={name} size={34} frameSpec={frameSpec} />
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
          <Avatar name={comment.user.name} size={22} />
          <p className="grow text-[12.5px] leading-relaxed">
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

function Footer({ moment, circleSize }: { moment: FeedMoment; circleSize: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {moment.reactions.slice(0, 3).map((r) => (
          <span
            key={r.userId}
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background:
                r.kind === "LOVE" ? "var(--color-live-soft)" : "var(--color-chip)",
            }}
          >
            {r.kind === "CUSTOM" ? (
              <span className="text-[14px] leading-none">{r.emoji}</span>
            ) : (
              <ReactionFace
                kind={r.kind}
                size={r.kind === "LOVE" ? 15 : 16}
                color={r.kind === "LOVE" ? "#ff7a7a" : "#94a3b8"}
              />
            )}
          </span>
        ))}
        {moment.reactions.length > 0 ? (
          <span className="mr-0.5 text-[12px] text-faint">{ar(moment.reactions.length)}</span>
        ) : null}
      </div>

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
  circleSize,
}: {
  moment: FeedMoment;
  viewerId: string;
  circleSize: number;
}) {
  const { author, kind } = moment;
  const withNames = moment.tags.map((t) => t.user.name);

  // اللحظات السطرية: بلا بطاقة، وبلا تعليقات — لا شيء يُعلَّق عليه.
  if (kind === "SLEEP" || kind === "MUSIC" || kind === "FRIEND_ADDED") {
    const icon =
      kind === "SLEEP" ? <MoonIcon size={15} /> : kind === "MUSIC" ? <MusicIcon size={15} /> : <WithIcon size={15} />;

    return (
      <article className="relative flex gap-3 pb-5">
        <Spine name={author.name} frameSpec={author.frame?.spec} at={moment.createdAt} />
        <div className="grow">
          <InlineMoment icon={icon}>
            {kind === "SLEEP" ? (
              <>نام</>
            ) : kind === "MUSIC" ? (
              <>
                يسمع <span className="font-semibold text-ink">{moment.musicTitle}</span>
                {moment.musicArtist ? ` — ${moment.musicArtist}` : null}
              </>
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
      <Spine name={author.name} frameSpec={author.frame?.spec} at={moment.createdAt} />
      <div className="grow overflow-hidden rounded-2xl border border-line bg-card">
        <Link href={`/m/${moment.id}`} className="block">
          {moment.imageSpec ? (
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
              <p className="mb-2.5 flex items-center gap-1.5 text-[12px] text-muted">
                <WithIcon size={13} />
                مع {withNames.join(" و")}
              </p>
            ) : null}

            <Footer moment={moment} circleSize={circleSize} />
          </div>
        </Link>

        <div className="px-4 pb-3">
          <Comments moment={moment} />
          <InlineComment momentId={moment.id} viewerId={viewerId} />
        </div>
      </div>
    </article>
  );
}
