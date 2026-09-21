"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteStory, seeStory } from "@/app/actions";
import { Avatar } from "@/components/ui";
import { CloseIcon, EyeIcon } from "@/components/icons";
import { filterCss } from "@/components/story-composer";
import { ar, relative } from "@/lib/format";
import { BASE } from "@/lib/base";

/** مدة شريحة الصورة. والفيديو مدّته مدّته. */
const SLIDE_MS = 5000;

type Story = {
  id: string;
  mediaId: string;
  at: string;
  seen: number;
  video: boolean;
  seconds: number | null;
  filter: string | null;
};

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
  const [paused, setPaused] = useState(false);
  const started = useRef(Date.now());

  const story = stories[index];
  // الفيديو يُقاس بمدّته لا بخمس ثوانٍ: القصّ في منتصفه يُفقد آخره.
  const span = story?.video && story.seconds ? story.seconds * 1000 : SLIDE_MS;

  // إيصال المشاهدة يُرسل مرة لكل شريحة تُفتح.
  useEffect(() => {
    if (!story) return;
    void seeStory(story.id);
  }, [story]);

  useEffect(() => {
    started.current = Date.now();
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (paused) return;
    const tick = setInterval(() => {
      const done = (Date.now() - started.current) / span;
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
      <div className="relative grow overflow-hidden">
        {story.video ? (
          <video
            key={story.id}
            src={`${BASE}/api/media/${story.mediaId}`}
            autoPlay
            playsInline
            muted={false}
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: "contain", filter: filterCss(story.filter) }}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${BASE}/api/media/${story.mediaId}`}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: "contain", filter: filterCss(story.filter) }}
          />
        )}

        {/* نصفان للتنقّل: يمينٌ يرجع ويسارٌ يتقدّم، والضغط المطوّل يوقف. */}
        <button
          type="button"
          aria-label="السابق"
          className="absolute inset-y-0 right-0 w-1/2"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onClick={() => step(index - 1)}
        />
        <button
          type="button"
          aria-label="التالي"
          className="absolute inset-y-0 left-0 w-1/2"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onClick={() => step(index + 1)}
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
            <span
              className="pointer-events-none flex items-center gap-1.5 text-[12px]"
              style={{ color: "rgba(255,255,255,.85)" }}
            >
              <EyeIcon size={15} />
              {ar(story.seen)}
            </span>
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
      </div>
    </div>
  );
}
