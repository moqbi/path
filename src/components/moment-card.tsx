import Link from "next/link";
import { WithNames } from "@/components/with-names";
import { Avatar, type Frame } from "@/components/ui";
import {
  MoonIcon,
  SunIcon,
  MusicIcon,
  PinIcon,
  PlaneIcon,
  PlayIcon,
  GiftIcon,
  WithIcon,
  TagIcon,
  CameraIcon,
  PrivateIcon,
} from "@/components/icons";
import { MomentBar } from "@/components/moment-bar";
import { AthrMark } from "@/components/brand";
import { Photo } from "@/components/photo";
import { PHOTO_RATIO } from "@/lib/photo";
import { mapsUrl } from "@/lib/maps";
import { PlaceLink } from "@/components/place-link";
import { Reactors } from "@/components/reactions";
import { AuthorFaces } from "@/components/author-panel";
import { CommentList } from "@/components/comments";
import { ar, relative, timeOfDay } from "@/lib/format";
import type { FeedMoment } from "@/lib/feed";

/** بعد هذا العدد تُفتح اللحظة لقراءة بقية التعليقات، وقبله لا داعي. */
const INLINE_COMMENTS = 3;

/**
 * الأحداث تُكتب سطراً على الورق لا بطاقةً: وصولٌ إلى مدينة، نوم، مكان،
 * صديق جديد، أغنية. البطاقة تُحفظ لما له متن — صورة أو خاطرة — وهكذا
 * كان Path: الخطّ الزمني يوميّات، والأحداث أسطرٌ فيها.
 */
export const EVENTS = new Set([
  "CITY",
  "PLACE",
  "SLEEP",
  "WAKE",
  "MUSIC",
  "FRIEND_ADDED",
  "GIFT_SENT",
  "GIFT_GOT",
  "JOINED",
  "TAG_GRANTED",
  "AVATAR_CHANGED",
  "COINS_GRANTED",
]);

const EVENT_STYLE: Record<string, { bg: string; ink: string }> = {
  CITY: { bg: "var(--color-night)", ink: "#f7f5ef" },
  PLACE: { bg: "var(--color-live-soft)", ink: "var(--color-live)" },
  SLEEP: { bg: "var(--color-night-2)", ink: "#f7f5ef" },
  WAKE: { bg: "var(--color-gold-soft)", ink: "var(--color-gold-ink)" },
  MUSIC: { bg: "var(--color-clay)", ink: "var(--color-on-brand)" },
  FRIEND_ADDED: { bg: "var(--color-gold-soft)", ink: "var(--color-gold-ink)" },
  GIFT_SENT: { bg: "var(--color-clay-soft)", ink: "var(--color-clay-ink)" },
  GIFT_GOT: { bg: "var(--color-clay-soft)", ink: "var(--color-clay-ink)" },
  JOINED: { bg: "var(--color-night)", ink: "#f7f5ef" },
  TAG_GRANTED: { bg: "var(--color-gold-soft)", ink: "var(--color-gold-ink)" },
  AVATAR_CHANGED: { bg: "var(--color-clay-soft)", ink: "var(--color-clay-ink)" },
  COINS_GRANTED: { bg: "var(--color-gold-soft)", ink: "var(--color-gold-ink)" },
};

function EventIcon({ kind }: { kind: string }) {
  const style = EVENT_STYLE[kind] ?? EVENT_STYLE.PLACE;
  const glyph =
    kind === "CITY" ? (
      <PlaneIcon size={16} />
    ) : kind === "SLEEP" ? (
      <MoonIcon size={16} />
    ) : kind === "WAKE" ? (
      <SunIcon size={16} />
    ) : kind === "MUSIC" ? (
      <MusicIcon size={16} />
    ) : kind === "FRIEND_ADDED" ? (
      <WithIcon size={16} />
    ) : kind === "GIFT_SENT" || kind === "GIFT_GOT" ? (
      <GiftIcon size={16} />
    ) : kind === "JOINED" ? (
      <AthrMark size={20} />
    ) : kind === "TAG_GRANTED" ? (
      <TagIcon size={16} />
    ) : kind === "AVATAR_CHANGED" ? (
      <CameraIcon size={16} />
    ) : kind === "COINS_GRANTED" ? (
      <GiftIcon size={16} />
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
  frame,
  mediaId,
  charm,
  at,
  hidden = false,
}: {
  authorId: string;
  viewerId: string;
  name: string;
  frame?: Frame;
  mediaId?: string | null;
  charm?: { spec: string; mediaId: string | null } | null;
  at: Date;
  /** لحظةٌ لتصنيفٍ أو لأشخاصٍ بأعيانهم — لا للدائرة كلّها. */
  hidden?: boolean;
}) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
      <Link
        href={authorId === viewerId ? "/me" : `/u/${authorId}`}
        aria-label={`ملف ${name}`}
      >
        <Avatar name={name} size={46} frame={frame} mediaId={mediaId} charm={charm} />
      </Link>
      <span className="text-[10px] font-semibold text-muted">{timeOfDay(at)}</span>
      {/*
        «خاصة» تحت الساعة — يراها صاحبُها ومن اختارهم، فيعرف كلٌّ منهم أنّ
        اللحظة لم تُوجَّه إلى الدائرة كلّها (القاعدة ٢٠٦).
      */}
      {hidden ? (
        <span
          title="لحظة خاصة"
          className="flex items-center gap-0.5 rounded-full border border-line bg-card px-1.5 py-px text-[9.5px] font-bold"
          style={{ color: "var(--color-clay-ink)" }}
        >
          <PrivateIcon size={11} />
          خاصة
        </span>
      ) : null}
    </div>
  );
}

/**
 * التعليقات داخل الخط الزمني.
 * تُعرض ثلاثة، وما زاد يُقرأ بفتح اللحظة — فلا تبتلع لحظةٌ واحدة الشاشة.
 */
function Comments({
  moment,
  viewerId,
  moderate = false,
}: {
  moment: FeedMoment;
  viewerId: string;
  moderate?: boolean;
}) {
  if (moment.comments.length === 0) return null;
  const hidden = moment._count.comments - moment.comments.length;

  return (
    <div className="flex flex-col gap-2">
      <CommentList
        comments={moment.comments}
        viewerId={viewerId}
        momentAuthorId={moment.author.id}
        moderate={moderate}
      />
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
function Bubble({
  moment,
  viewerId,
  moderate = false,
}: {
  moment: FeedMoment;
  viewerId: string;
  moderate?: boolean;
}) {
  const hasComments = moment.comments.length > 0;
  const hasReactions = moment.reactions.length > 0;
  // لصاحبها صفُّ من شاهد ومن تفاعل (القاعدة ٢٠٢) — لا يُعرف عددُه قبل الجلب،
  // فالقالبُ يُرسم له بالتعليقات وحدها حين لا يتفاعل أحد.
  if (moment.author.id === viewerId) {
    return (
      <div className="mt-2 flex flex-col gap-2.5 empty:hidden">
        <AuthorFaces momentId={moment.id} />
        {hasComments ? (
          <div className="rounded-2xl border border-line bg-card px-3 py-2.5">
            <Comments moment={moment} viewerId={viewerId} moderate={moderate} />
          </div>
        ) : null}
      </div>
    );
  }
  if (!hasComments && !hasReactions) return null;

  return (
    <div className="mt-2 rounded-2xl border border-line bg-card px-3 py-2.5">
      {hasReactions ? <Reactors reactions={moment.reactions} viewerId={viewerId} /> : null}
      {hasReactions && hasComments ? <div className="my-2.5 h-px bg-line" /> : null}
      <Comments moment={moment} viewerId={viewerId} moderate={moderate} />
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
        frame={moment.author.frame}
        mediaId={moment.author.avatarMediaId}
        charm={moment.author.charm}
        at={moment.createdAt}
        hidden={moment.audience !== "CIRCLE"}
      />
      <div className="min-w-0 grow">{children}</div>
    </article>
  );
}

/** عنوان الحدث وسطره الثاني — بلا إطار، على ورق الخط الزمني نفسه. */
export function EventLine({
  moment,
  withNames,
  href,
  viewerId,
}: {
  moment: FeedMoment;
  withNames: string[];
  /** القارئ: اسمُه في «مع …» يفتح «أنا» لا ملفّه بعين غيره. */
  viewerId?: string;
  /** وجهة الفتح حين تُفتح اللحظة في صفحتها — على النصّ وحده لا على الصفّ. */
  href?: string;
}) {
  const { kind } = moment;

  /*
    اسمُ الطرف الآخر رابطٌ إلى ملفّه — كالجوّال (القاعدة ١٦٥): «أصبح صديق فلان»
    و«أهديت فلاناً» و«وصلتك هدية من فلان». الطرفُ إشارةٌ على اللحظة (معرّفُه
    معها)، وما كُتب قبل الإشارة يبقى نصّاً.
  */
  const other =
    kind === "FRIEND_ADDED" || kind === "GIFT_SENT" || kind === "GIFT_GOT"
      ? (moment.tags[0]?.user ?? null)
      : null;
  const who = (fallback: string) =>
    other ? (
      <Link href={`/u/${other.id}`} className="font-bold text-clay-ink hover:underline">
        {other.name}
      </Link>
    ) : (
      <span className="font-bold">{fallback}</span>
    );

  const title =
    kind === "CITY" ? (
      <>
        وصل إلى <span className="font-bold">{moment.text ?? "مدينة"}</span>
      </>
    ) : kind === "SLEEP" ? (
      <span className="font-bold">نمت</span>
    ) : kind === "WAKE" ? (
      <span className="font-bold">صحيت</span>
    ) : kind === "FRIEND_ADDED" ? (
      <>
        أصبح صديق {who(moment.text ?? "أحدهم")}
      </>
    ) : kind === "GIFT_SENT" ? (
      <>
        أهديت {who(withNames[0] ?? "صديقاً")}{" "}
        <span className="font-bold">{moment.text ?? "هدية"}</span>
      </>
    ) : kind === "GIFT_GOT" ? (
      <>
        وصلتك هدية من {who(withNames[0] ?? "صديق")}:{" "}
        <span className="font-bold">{moment.text ?? "هدية"}</span>
      </>
    ) : kind === "TAG_GRANTED" ? (
      <>
        تهانينا — حصل على وسم <span className="font-bold">«{moment.text ?? ""}»</span> من الإدارة
      </>
    ) : kind === "AVATAR_CHANGED" ? (
      <>
        <span className="font-bold">{moment.author.name}</span> غيّر صورته
      </>
    ) : kind === "COINS_GRANTED" ? (
      // القاعدة ٢٢٤: البطاقةُ هنا لا تعرف قارئها، فبالغائب واسمِه.
      <>
        لأنه يستحق — تمّ منح <span className="font-bold">{moment.author.name}</span>{" "}
        {ar(Number(moment.text) || 0)} نقطة من قبل الإدارة
      </>
    ) : kind === "JOINED" ? (
      <>
        انضم <span className="font-bold">{moment.author.name}</span> إلى آثار مومنتس
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
        في{" "}
        {/* اسمُ المكان يفتح الخرائط (القاعدة ٢١١). */}
        {mapsUrl(moment) ? (
          <PlaceLink
            url={mapsUrl(moment)}
            visitors={moment.author.id === viewerId ? { momentId: moment.id, place: moment.placeName! } : undefined}
            className="font-bold text-clay-ink hover:underline"
          >
            {moment.placeName}
          </PlaceLink>
        ) : (
          <span className="font-bold">{moment.placeName ?? "مكان"}</span>
        )}
      </>
    );

  const subtitle =
    kind === "MUSIC"
      ? null
      : kind === "PLACE"
        ? [moment.placeCity, moment.text].filter(Boolean).join(" · ") || null
        : kind === "SLEEP"
          ? "تصبح على خير"
          // خبر «صحيت» ساعتُه: تُقرأ من طابع اللحظة لا من نصٍّ محفوظ.
          : kind === "WAKE"
            ? `الساعة ${timeOfDay(moment.createdAt)}`
            : null;

  const body = (
    <>
      <EventIcon kind={kind} />
      <div className="min-w-0 grow pt-1">
        <p dir="auto" className="text-[13.5px] font-semibold leading-snug text-ink">
          {title}
        </p>
        {subtitle ? (
          <p dir="auto" className="mt-0.5 truncate text-[12px] font-medium text-ink-2">
            {subtitle}
          </p>
        ) : null}
        {withNames.length > 0 && kind !== "GIFT_SENT" && kind !== "GIFT_GOT" && kind !== "FRIEND_ADDED" ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-2">
            <WithIcon size={12} />
            <WithNames people={moment.tags.map((t) => t.user)} viewerId={viewerId} />
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="flex items-start gap-2.5">
      {/*
        الفتحُ على النصّ وحده: لفُّ الصفّ كلّه برابطٍ يضع رابط الأغنية داخل
        رابط — وهو غير جائز في HTML، وكان يُصلَح بمعالج ضغطٍ يوقف الصعود،
        ومكوّن الخادم لا يملك أن يمرّر معالجاً فيسقط العرض كلّه.
      */}
      {/* ورابطُ الاسم لا يُلفّ برابطٍ ثانٍ — رابطٌ داخل رابطٍ لا يجوز في HTML. */}
      {href && !other ? (
        <Link href={href} className="flex min-w-0 grow items-start gap-2.5">
          {body}
        </Link>
      ) : (
        body
      )}

      {/*
        صورة الأغنية هي زرّ التشغيل: زرٌّ ثالثٌ بجانبها كان يزاحم زرّ
        التفاعل في الطرف نفسه. والمثلّث يظهر فوقها فيُعرف أنها تُضغط.
      */}
      {moment.kind === "MUSIC" && moment.musicThumb ? (
        moment.musicUrl ? (
          <a
            href={moment.musicUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="استمع"
            className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-cover bg-center"
            style={{ backgroundImage: `url(${moment.musicThumb})` }}
          >
            {/* المثلّث فوق الصورة لا في وسطها: الوسط يحجب وجهها. */}
            <span
              className="absolute flex h-5 w-5 items-center justify-center rounded-full"
              style={{
                top: 3,
                insetInlineStart: 3,
                background: "rgba(14,26,36,.68)",
                color: "#fff",
              }}
            >
              <PlayIcon size={11} />
            </span>
          </a>
        ) : (
          <span
            className="h-11 w-11 shrink-0 rounded-xl bg-cover bg-center"
            style={{ backgroundImage: `url(${moment.musicThumb})` }}
          />
        )
      ) : null}
    </div>
  );
}

export function MomentCard({
  moment,
  viewerId,
  isPlus,
  /** صلاحية الإشراف: تُضاف «احذفها» إلى لوحة التفاعل على لحظة غيره. */
  moderate = false,
}: {
  moment: FeedMoment;
  viewerId: string;
  isPlus: boolean;
  moderate?: boolean;
}) {
  const { author, kind } = moment;
  const withNames = moment.tags.map((t) => t.user.name);
  const mine = moment.reactions.find((r) => r.userId === viewerId) ?? null;
  // الفتح في صفحة مستقلة له معنى واحد: تعليقات لم تسعها البطاقة.
  const opens = moment._count.comments > INLINE_COMMENTS;

  if (EVENTS.has(kind)) {
    const line = (
      <EventLine
        moment={moment}
        withNames={withNames}
        viewerId={viewerId}
        href={opens ? `/m/${moment.id}` : undefined}
      />
    );

    return (
      <Row moment={moment} viewerId={viewerId}>
        <MomentBar
          momentId={moment.id}
          momentKind={kind}
          mine={mine}
          isPlus={isPlus}
          author={moment.author.id === viewerId}
          moderate={moderate && moment.author.id !== viewerId}
          locked={moment.commentsLocked}
          head={line}
          extra={
            <>
              {moment.mediaId ? (
                <div className="mt-2.5">
                  <Photo mediaId={moment.mediaId} rounded x={moment.photoX ?? 50} y={moment.photoY ?? 50} />
                </div>
              ) : null}
              <Bubble moment={moment} viewerId={viewerId} moderate={moderate} />
            </>
          }
        />
      </Row>
    );
  }

  // ما له متن — صورة أو خاطرة — يبقى في بطاقته.
  // الصورةُ في أعلى البطاقة وزرُّ التفاعل في ركنها فوقها، بإطار المحرّر وموضعه.
  const media = moment.mediaId ? (
    // حشوةٌ لا هامش: هامشُ أوّل ابنٍ ينهار عبر أبيه فيُزيح البطاقة كلّها.
    <div className="px-3 pt-3">
      <Photo mediaId={moment.mediaId} rounded x={moment.photoX ?? 50} y={moment.photoY ?? 50} />
    </div>
  ) : moment.imageSpec ? (
    <div className="px-3 pt-3">
      <div className="rounded-2xl" style={{ aspectRatio: PHOTO_RATIO, background: moment.imageSpec }} />
    </div>
  ) : null;

  const head = (
    <>
      {/* بلا صورةٍ يبدأ النصّ من أعلى البطاقة بجانب الزرّ، ومعها يأتي تحتها. */}
      <div className={media ? "px-4 pt-3" : "min-h-[50px] pl-[52px] pr-4 pt-3.5"}>
        {moment.text ? (
          <p dir="auto" className="mb-2 text-[13.5px] leading-relaxed text-ink">{moment.text}</p>
        ) : null}

        {/* الموقع على لحظةٍ أو صورة: سطرٌ صغير، لا حدثُ مكانٍ مستقل. */}
        {/* ويُضغط فيفتح الخرائط (القاعدة ٢١١). */}
        {moment.placeName ? (
          <p dir="auto" className="mb-2 text-[12px]">
            <PlaceLink
              url={mapsUrl(moment)}
              visitors={moment.author.id === viewerId ? { momentId: moment.id, place: moment.placeName } : undefined}
              className="flex items-center gap-1.5 font-semibold text-clay-ink hover:underline"
            >
              <PinIcon size={12} />
              {moment.placeName}
            </PlaceLink>
          </p>
        ) : null}

        {withNames.length > 0 ? (
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <WithIcon size={13} />
            <WithNames people={moment.tags.map((t) => t.user)} viewerId={viewerId} />
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <Row moment={moment} viewerId={viewerId}>
      {/* زرّ التفاعل في أعلى البطاقة: يُلمس قبل القراءة لا بعدها. */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <MomentBar
          momentId={moment.id}
          momentKind={kind}
          mine={mine}
          isPlus={isPlus}
          author={moment.author.id === viewerId}
          moderate={moderate && moment.author.id !== viewerId}
          locked={moment.commentsLocked}
          inset
          media={media}
          extra={
            opens ? (
              <Link href={`/m/${moment.id}`} className="block">
                {head}
              </Link>
            ) : (
              head
            )
          }
          footer={
            <div className="px-4 pb-3 pt-2">
              {moment.author.id === viewerId ? (
                /* لصاحبها صفٌّ واحد: من تفاعل ومن شاهد باهتاً (القاعدة ٢٠٢). */
                <AuthorFaces momentId={moment.id} />
              ) : moment.reactions.length > 0 ? (
                <Reactors reactions={moment.reactions} viewerId={viewerId} />
              ) : null}
              {moment.comments.length > 0 ? (
                <div className="mt-2.5 border-t border-line pt-2.5">
                  <Comments moment={moment} viewerId={viewerId} moderate={moderate} />
                </div>
              ) : null}
            </div>
          }
        />
      </div>
    </Row>
  );
}
