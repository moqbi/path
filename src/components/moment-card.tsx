import Link from "next/link";
import { Avatar } from "@/components/ui";
import { EyeIcon, MusicIcon, PinIcon, MoonIcon } from "@/components/icons";
import { ReactionFace } from "@/components/icons";
import { ar, timeOfDay, until } from "@/lib/format";
import { JoinButton } from "@/components/interactive";
import type { FeedMoment } from "@/lib/feed";

/** لحظة سطر واحد: وصل مكاناً، نام، يسمع أغنية — بلا بطاقة ولا إطار. */
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
  const joined = moment.joinings.some((j) => j.userId === viewerId);

  if (kind === "PLACE" || kind === "SLEEP" || kind === "MUSIC") {
    const icon =
      kind === "PLACE" ? <PinIcon size={15} /> : kind === "SLEEP" ? <MoonIcon size={15} /> : <MusicIcon size={15} />;

    return (
      <article className="relative flex gap-3 pb-5">
        <Spine name={author.name} frameSpec={author.frame?.spec} at={moment.createdAt} />
        <div className="grow">
          <InlineMoment icon={icon}>
            {kind === "PLACE" ? (
              <>
                وصل <span className="font-semibold text-ink">{moment.placeName}</span>
              </>
            ) : kind === "SLEEP" ? (
              <>نام</>
            ) : (
              <>
                يسمع <span className="font-semibold text-ink">{moment.musicTitle}</span>
                {moment.musicArtist ? ` — ${moment.musicArtist}` : null}
              </>
            )}
          </InlineMoment>
        </div>
      </article>
    );
  }

  if (kind === "PRESENCE") {
    const live = moment.expiresAt !== null && moment.expiresAt > new Date();
    return (
      <article className="relative flex gap-3 pb-5">
        <Spine name={author.name} frameSpec={author.frame?.spec} at={moment.createdAt} />
        <div className="grow rounded-2xl border border-line bg-card p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: live ? "var(--color-live)" : "var(--color-faint)" }}
            />
            <span className="text-[11px] font-semibold tracking-wide text-live">
              {live && moment.expiresAt ? `الآن · ${until(moment.expiresAt)}` : "انتهى"}
            </span>
          </div>

          <p className="mb-1 text-[15px] font-semibold leading-snug">
            {author.name} في {moment.placeName}
          </p>
          <p className="mb-3.5 text-[12.5px] text-muted">
            {withNames.length > 0 ? `مع ${withNames.join(" و")}` : null}
            {withNames.length > 0 && moment.text ? " · " : null}
            {moment.text ? `«${moment.text}»` : null}
          </p>

          <div className="flex items-center gap-2.5">
            {author.id === viewerId ? (
              <div className="flex h-11 grow items-center justify-center rounded-xl bg-chip text-[14px] font-semibold text-muted">
                حضورك
              </div>
            ) : (
              <JoinButton momentId={moment.id} joined={joined} />
            )}

            {moment.joinings.length > 0 ? (
              <div className="flex items-center">
                {moment.joinings.slice(0, 3).map((j, i) => (
                  <div key={j.userId} style={{ marginRight: i === 0 ? 0 : -9 }}>
                    <Avatar name={j.user.name} size={27} ring="var(--color-card)" />
                  </div>
                ))}
                {moment.joinings.length > 3 ? (
                  <span className="mr-1 text-[11px] font-semibold text-clay">
                    +{ar(moment.joinings.length - 3)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  // PHOTO و THOUGHT: بطاقة كاملة قابلة للفتح.
  return (
    <article className="relative flex gap-3 pb-5">
      <Spine name={author.name} frameSpec={author.frame?.spec} at={moment.createdAt} />
      <Link
        href={`/m/${moment.id}`}
        className="grow overflow-hidden rounded-2xl border border-line bg-card"
      >
        {moment.imageSpec ? (
          <div className="h-33 w-full" style={{ height: 132, background: moment.imageSpec }} />
        ) : null}
        <div className="px-4 pb-3 pt-3">
          {moment.text ? (
            <p className="mb-3 text-[13.5px] leading-relaxed text-ink">{moment.text}</p>
          ) : null}

          {withNames.length > 0 ? (
            <p className="mb-3 text-[12px] text-muted">مع {withNames.join(" و")}</p>
          ) : null}

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
                <span className="mr-0.5 text-[12px] text-faint">
                  {ar(moment.reactions.length)}
                </span>
              ) : null}
            </div>

            <span className="flex items-center gap-1.5 text-[11px] text-faint">
              <EyeIcon size={14} />
              شافها {ar(moment._count.views)} من {ar(circleSize)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

