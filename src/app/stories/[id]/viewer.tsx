"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteStory, reactStory, seeStory, storyTrack } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { CloseIcon, EyeIcon, ScreenshotIcon } from "@/components/icons";
import { filterCss, vignetteCss } from "@/components/story-composer";
import { StoryTexts, type StoryText } from "@/components/story-texts";
import { StoryStickers, type StorySticker } from "@/components/story-stickers";
import { ReactionGlyph } from "@/components/reactions";
import { ar, relative } from "@/lib/format";
import { BASE } from "@/lib/base";

/** مدة شريحة الصورة. والفيديو مدّته مدّته. */
const SLIDE_MS = 5000;

type Story = {
  id: string;
  mediaId: string;
  at: string;
  seen: number;
  /** من شاهدها — لصاحبها وحده، وفارغةٌ لغيره. */
  viewers: { id: string; name: string; avatarMediaId: string | null; seenAt: string; reaction: string | null; screenshot: boolean }[];
  video: boolean;
  seconds: number | null;
  filter: string | null;
  texts: StoryText[] | null;
  stickers: StorySticker[] | null;
  audioMediaId: string | null;
  audioSeconds: number | null;
  /** أغنيةٌ من دِيزر بدل الصوت المرفوع، وصوتُ المقطع مكتوم (القاعدة ٢٧٧). */
  trackId: string | null;
  trackSeconds: number | null;
  videoMuted: boolean;
  /** تقريبُ الصورة وإزاحتُها كما وضعها صاحبُها في التطبيق (القاعدة ٢٩٦). */
  frame: { z: number; x: number; y: number; a?: number } | null;
  myReaction: string | null;
};

/** الوجوهُ الخمسة — مفتوحةٌ للجميع (القاعدة ٣). */
const FACES = ["LOVE", "LAUGH", "GASP", "SAD", "SMILE"] as const;

/**
 * عارض القصص.
 *
 * شريط تقدّم لكل شريحة، ولمسةٌ على النصف الأيمن ترجع وعلى الأيسر تتقدّم
 * (وهو المعتاد في RTL)، والضغط المطوّل يوقف العدّ — من يقرأ تعليقاً على
 * صورة لا يجب أن تُسحب من تحته.
 */
export function StoryViewer({
  author,
  stories,
  mine,
}: {
  author: { id: string; name: string; avatarMediaId: string | null };
  stories: Story[];
  mine: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  // قائمةُ من شاهدها فوق القصة، والعدُّ يقف ما دامت مفتوحة.
  const [watching, setWatching] = useState(false);
  const paused = held || watching;
  const started = useRef(Date.now());
  // الوقفةُ لا تبدأ الشريحة من أوّلها: ما مضى منها يُستأنف منه.
  const elapsed = useRef(0);

  const story = stories[index];
  // الفيديو يُقاس بمدّته لا بخمس ثوانٍ، والصورةُ بصوتها بطول مقطعها (القاعدة ٢٣٨).
  const span =
    story?.video && story.seconds
      ? story.seconds * 1000
      : !story?.video && story?.audioMediaId && story.audioSeconds
        ? story.audioSeconds * 1000
        : !story?.video && story?.trackId && story.trackSeconds
          ? story.trackSeconds * 1000
          : SLIDE_MS;

  // صوتُ القصّة: يقف بوقوفها، ويُكتم بضغط ملصقه — والكتمُ يبقى على ما بعدها.
  const audio = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  /*
    الصوتُ مقطعٌ مرفوع أو أغنيةٌ من دِيزر (القاعدة ٢٧٧)، على الصورة والمقطع سواء.
    والأغنيةُ رابطُها يُطلب طازجاً ويبدأ من حيث اختار صاحبُها.
  */
  const [song, setSong] = useState<{ id: string; url: string; start: number } | null>(null);
  const songOf = story && !story.audioMediaId && story.trackId ? story.id : null;
  useEffect(() => {
    if (!songOf) return;
    let alive = true;
    void storyTrack(songOf).then((said) => {
      if (alive && said.url) setSong({ id: songOf, url: said.url, start: said.start ?? 0 });
    });
    return () => {
      alive = false;
    };
  }, [songOf]);
  const audioSrc = story?.audioMediaId
    ? `${BASE}/api/media/${story.audioMediaId}`
    : song && song.id === story?.id
      ? song.url
      : null;
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (paused) el.pause();
    // المتصفّحُ يمنع التشغيل قبل لمسة — فتُبتلع، والملصقُ يشغّله.
    else void el.play().catch(() => setMuted(true));
  }, [paused, index]);

  // تفاعلي: يُكتب في الحال ويُرسل بعده، وضغطُ الوجه نفسه ثانيةً يرفعه.
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [burst, setBurst] = useState<{ face: string; key: number } | null>(null);
  function react(face: string) {
    if (!story) return;
    const current = story.id in picked ? picked[story.id] : story.myReaction;
    const next = current === face ? null : face;
    setPicked((all) => ({ ...all, [story.id]: next }));
    void reactStory(story.id, next);
    if (next) setBurst({ face: next, key: Date.now() });
  }

  // إيصال المشاهدة يُرسل مرة لكل شريحة تُفتح.
  useEffect(() => {
    if (!story) return;
    void seeStory(story.id);
  }, [story]);

  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused) return;
    started.current = Date.now() - elapsed.current;
    const tick = setInterval(() => {
      elapsed.current = Date.now() - started.current;
      const done = elapsed.current / span;
      if (done >= 1) {
        if (index + 1 < stories.length) setIndex(index + 1);
        else router.back();
        return;
      }
      setProgress(done);
    }, 60);
    return () => clearInterval(tick);
  }, [index, paused, span, stories.length, router]);

  if (!story) return null;

  function step(next: number) {
    if (next < 0) return;
    if (next >= stories.length) {
      router.back();
      return;
    }
    setIndex(next);
  }

  return (
    <div className="screen" style={{ background: "#0b1219" }}>
      <div className="relative grow overflow-hidden" style={{ containerType: "size" }}>
        {/* صورةٌ أصغرُ من الشاشة (القاعدة ٣٠٢): حولها نسخةٌ مغبّشةٌ منها لا فراغٌ أسود. */}
        {story.frame && story.frame.z < 1 && !story.video ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${BASE}/api/media/${story.mediaId}`}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover"
            style={{ filter: "blur(28px) brightness(.65)" }}
          />
        ) : null}
        {/* قصّةٌ وضع صاحبُها صورتَها بتقريبٍ وإزاحة تملأ الشاشةَ بهما كما رآها، وغيرُها كما كانت. */}
        <div
          className="absolute inset-0"
          style={frameStyle(story.frame)}
        >
        {story.video ? (
          <video
            key={story.id}
            src={`${BASE}/api/media/${story.mediaId}`}
            autoPlay
            playsInline
            muted={story.videoMuted}
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: story.frame ? "cover" : "contain", filter: filterCss(story.filter) }}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${BASE}/api/media/${story.mediaId}`}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: story.frame ? "cover" : "contain", filter: filterCss(story.filter) }}
          />
        )}
        </div>

        {vignetteCss(story.filter) && !story.video ? (
          <span className="pointer-events-none absolute inset-0" style={{ background: vignetteCss(story.filter)! }} />
        ) : null}

        {audioSrc ? (
          <audio
            key={story.id}
            ref={audio}
            src={audioSrc}
            autoPlay
            loop={Boolean(story.audioMediaId)}
            muted={muted}
            onLoadedMetadata={(event) => {
              if (!story.audioMediaId && song) event.currentTarget.currentTime = song.start;
            }}
          />
        ) : null}

        <StoryTexts texts={story.texts} />

        {/* نصفان للتنقّل: يمينٌ يرجع ويسارٌ يتقدّم، والضغط المطوّل يوقف. */}
        <button
          type="button"
          aria-label="السابق"
          className="absolute inset-y-0 right-0 w-1/2"
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onClick={() => step(index - 1)}
        />
        <button
          type="button"
          aria-label="التالي"
          className="absolute inset-y-0 left-0 w-1/2"
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onClick={() => step(index + 1)}
        />

        <StoryStickers
          stickers={story.stickers}
          at={new Date(story.at)}
          muted={muted}
          onMusic={() => {
            setMuted((value) => !value);
            void audio.current?.play().catch(() => {});
          }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
          <div className="mb-3 flex gap-1">
            {stories.map((item, position) => (
              <span
                key={item.id}
                className="h-[3px] grow overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,.28)" }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    background: "#fff",
                    width:
                      position < index
                        ? "100%"
                        : position === index
                          ? `${Math.min(100, progress * 100)}%`
                          : "0%",
                  }}
                />
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <Avatar name={author.name} size={34} mediaId={author.avatarMediaId} />
            <span className="grow">
              <span className="block text-[13.5px] font-semibold" style={{ color: "#fff" }}>
                {author.name}
              </span>
              <span className="block text-[11px]" style={{ color: "rgba(255,255,255,.75)" }}>
                {relative(new Date(story.at))}
              </span>
            </span>

            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => router.back()}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}
            >
              <CloseIcon size={17} />
            </button>
          </div>
        </div>

        {mine ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
            {/* العدّادُ بابُ القائمة: من نشر قصّةً يسأل «مَن» قبل «كم». */}
            <button
              type="button"
              onClick={() => setWatching(true)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold"
              style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}
            >
              <EyeIcon size={15} />
              {story.seen > 0
                ? `شاهدها ${ar(story.seen)}${reactedCount(story) ? `، تفاعل ${ar(reactedCount(story))}` : ""}`
                : "لم يشاهدها أحد بعد"}
            </button>
            <form
              action={async () => {
                await deleteStory(story.id);
                router.back();
              }}
            >
              <button
                type="submit"
                className="rounded-full px-3.5 py-2 text-[12px] font-semibold"
                style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}
              >
                احذف القصة
              </button>
            </form>
          </div>
        ) : null}

        {mine ? null : (
          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-5">
            <div className="flex gap-1.5 rounded-full p-1.5" style={{ background: "rgba(14,26,36,.55)" }}>
              {FACES.map((face) => {
                const on = (story.id in picked ? picked[story.id] : story.myReaction) === face;
                return (
                  <button
                    key={face}
                    type="button"
                    aria-label={on ? "ارفع التفاعل" : "تفاعل"}
                    onPointerDown={() => setHeld(true)}
                    onPointerUp={() => setHeld(false)}
                    onClick={() => react(face)}
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-transform"
                    style={{ background: on ? "rgba(246,185,59,.9)" : "transparent", transform: on ? "scale(1.08)" : undefined }}
                  >
                    <ReactionGlyph kind={face} size={32} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {burst ? (
          <span
            key={burst.key}
            className="story-burst pointer-events-none absolute left-1/2 top-[45%] z-20"
            onAnimationEnd={() => setBurst(null)}
          >
            <ReactionGlyph kind={burst.face} size={96} />
          </span>
        ) : null}

        {watching && mine ? (
          <div
            className="absolute inset-0 z-20 flex items-end"
            style={{ background: "rgba(14,26,36,.42)" }}
            onClick={() => setWatching(false)}
          >
            <div
              className="w-full rounded-t-3xl bg-card p-5"
              style={{ maxHeight: "60%", overflowY: "auto" }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="mb-3 text-center text-[15px] font-bold">من شاهد قصّتك</p>
              {story.viewers.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted">لم يشاهدها أحدٌ من أصدقائك بعد.</p>
              ) : (
                story.viewers.map((person) => (
                  <Link key={person.id} href={`/u/${person.id}`} className="flex items-center gap-3 py-2">
                    {/* الوجهُ فوق صورة من تفاعل، ومن شاهد وسكت يُقال له نصّاً (القاعدة ٢٣٨). */}
                    <span className="relative shrink-0">
                      <Avatar name={person.name} size={44} mediaId={person.avatarMediaId} />
                      {person.reaction ? (
                        <span className="absolute -right-2 -top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line bg-card">
                          <ReactionGlyph kind={person.reaction} size={20} />
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 grow">
                      <span className="flex items-center gap-1.5">
                        <span dir="auto" className="min-w-0 truncate text-[14px] font-semibold">
                          {person.name}
                        </span>
                        {/* صوّر الشاشة وهي مفتوحة (القاعدة ٢٤٠) — يقوله الجوّال، والمتصفّحُ لا يعرفه. */}
                        {person.screenshot ? (
                          <span title="صوّر الشاشة" className="shrink-0 text-live">
                            <ScreenshotIcon size={15} />
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[11.5px]" style={{ color: person.reaction ? "var(--color-clay-ink)" : "var(--color-faint)" }}>
                        {person.reaction ? "شاهدها وتفاعل" : "شاهدها وما تفاعل"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] text-faint">{relative(new Date(person.seenAt))}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** من تفاعل — من قائمة المشاهدين نفسها، فلا يُسأل الخادم مرّتين. */
const reactedCount = (story: Story) => story.viewers.filter((person) => person.reaction).length;

/**
 * موضعُ صورة القصّة (القاعدتان ٢٩٦ و٣٠٢): بنسبتها (`a`) صندوقٌ يملأ الشاشة بنسبة الصورة
 * نفسها — فإبعادُها يُري طرفيها — ثمّ الإزاحةُ والتقريب. وبلا نسبةٍ الصندوقُ الشاشةُ كما كان.
 */
function frameStyle(frame: { z: number; x: number; y: number; a?: number } | null): React.CSSProperties | undefined {
  if (!frame) return undefined;
  if (!frame.a) return { transform: `translate(${frame.x * 100}%, ${frame.y * 100}%) scale(${frame.z})` };
  return {
    inset: "auto",
    left: "50%",
    top: "50%",
    width: `max(100cqw, calc(100cqh * ${frame.a}))`,
    height: `max(100cqh, calc(100cqw / ${frame.a}))`,
    transform: `translate(-50%, -50%) translate(${frame.x * 100}cqw, ${frame.y * 100}cqh) scale(${frame.z})`,
  };
}
