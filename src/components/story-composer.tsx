"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { postStory } from "@/app/actions";
import { shrink, type Picked } from "@/components/image-picker";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { ar } from "@/lib/format";

/** أقصى مدّة للفيديو، وأقصى حجمٍ يُقبل — نفس ما يفحصه الخادم. */
const MAX_SECONDS = 20;
const MAX_VIDEO = 9_000_000;

/**
 * الفلاتر: اسمٌ يُحفظ، وقيمة CSS تُطبَّق عند العرض.
 *
 * الصورة تُحفظ كما صُوِّرت ويُطبَّق الفلتر عليها في كل مكان تُعرض فيه —
 * فالتراجع ممكن، والفيديو لا يُعاد ترميزه في المتصفح أصلاً.
 */
export const FILTERS: { key: string; name: string; css: string }[] = [
  { key: "", name: "بلا", css: "none" },
  { key: "warm", name: "دافئ", css: "sepia(.35) saturate(1.25) contrast(1.03)" },
  { key: "cool", name: "بارد", css: "hue-rotate(-12deg) saturate(1.1) brightness(1.04)" },
  { key: "mono", name: "رمادي", css: "grayscale(1) contrast(1.08)" },
  { key: "vivid", name: "زاهي", css: "saturate(1.5) contrast(1.1)" },
  { key: "fade", name: "باهت", css: "saturate(.75) brightness(1.08) contrast(.92)" },
];

export const filterCss = (key: string | null | undefined) =>
  FILTERS.find((item) => item.key === (key ?? ""))?.css ?? "none";

type Draft = {
  file: Blob;
  url: string;
  width: number;
  height: number;
  video: boolean;
  seconds: number;
};

/** مدّة الفيديو ومقاسه — يُقرآن من العنصر نفسه قبل الرفع. */
function readVideo(file: File): Promise<{ seconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    const done = (seconds: number) => {
      URL.revokeObjectURL(url);
      resolve({ seconds, width: video.videoWidth, height: video.videoHeight });
    };

    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) {
        done(Math.round(video.duration));
        return;
      }
      /*
        ملفات `MediaRecorder` تخرج أحياناً بلا مدّة في رأسها (`Infinity`).
        القفزُ إلى زمنٍ بعيد يجبر المتصفح على حسابها من الملف نفسه، ثم
        نعود إلى أوّله.
      */
      video.currentTime = 1e101;
      video.ontimeupdate = () => {
        video.ontimeupdate = null;
        const seconds = Number.isFinite(video.duration) ? video.duration : video.currentTime;
        video.currentTime = 0;
        done(Math.max(1, Math.round(seconds)));
      };
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذّرت قراءة الفيديو"));
    };
    video.src = url;
  });
}

/**
 * نشر قصة: صورة أو فيديو، مع فلتر يُختار قبل النشر.
 *
 * الاختيار ثم المعاينة ثم النشر — لا رفعٌ فوريٌّ بمجرّد اختيار الملف:
 * ما يُنشر بلا مراجعة يُحذف بعدها.
 */
export function StoryComposer() {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    return () => {
      if (draft) URL.revokeObjectURL(draft.url);
    };
  }, [draft]);

  async function choose(file: File) {
    setError(null);
    try {
      if (file.type.startsWith("video/")) {
        const { seconds, width, height } = await readVideo(file);
        if (seconds > MAX_SECONDS) {
          setError(`الفيديو ${ar(seconds)} ثانية — الحدّ ${ar(MAX_SECONDS)}.`);
          return;
        }
        if (file.size > MAX_VIDEO) {
          setError(`حجم الفيديو ${(file.size / 1_000_000).toFixed(1)} ميغا — الحدّ ٩.`);
          return;
        }
        setDraft({ file, url: URL.createObjectURL(file), width, height, video: true, seconds });
        return;
      }

      // الصورة تُضغط قبل النشر، فلا يُرفع ملف هاتفٍ خام.
      const small: Picked = await shrink(file, 1400, false);
      setDraft({
        file: small.file,
        url: URL.createObjectURL(small.file),
        width: small.width,
        height: small.height,
        video: false,
        seconds: 0,
      });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "تعذّرت قراءة الملف");
    }
  }

  function publish() {
    if (!draft) return;
    const data = new FormData();
    data.set("image", draft.file, draft.video ? "clip" : "photo");
    data.set("width", String(draft.width));
    data.set("height", String(draft.height));
    data.set("filter", filter);
    if (draft.video) data.set("seconds", String(draft.seconds));

    start(async () => {
      const said = await postStory(data);
      if (said.error) setError(said.error);
      else {
        setDraft(null);
        setFilter("");
      }
    });
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void choose(file);
        }}
      />

      <button
        type="button"
        aria-label="قصة جديدة"
        onClick={() => input.current?.click()}
        className="flex h-[62px] w-[62px] items-center justify-center rounded-full"
      >
        <span
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{
            border: "1.5px dashed var(--color-line)",
            background: "var(--color-card)",
            color: "var(--color-clay-ink)",
          }}
        >
          <PlusIcon size={22} />
        </span>
      </button>

      {draft ? (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0b1219" }}>
          <div className="flex items-center justify-between px-4 pt-4">
            <button
              type="button"
              aria-label="إلغاء"
              onClick={() => setDraft(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}
            >
              <CloseIcon size={18} />
            </button>
            <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,.8)" }}>
              {draft.video ? `فيديو · ${ar(draft.seconds)}″` : "صورة"}
            </span>
          </div>

          <div className="relative min-h-0 grow p-4">
            {draft.video ? (
              <video
                src={draft.url}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full rounded-2xl"
                style={{ objectFit: "contain", filter: filterCss(filter) }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={draft.url}
                alt=""
                className="h-full w-full rounded-2xl"
                style={{ objectFit: "contain", filter: filterCss(filter) }}
              />
            )}
          </div>

          <div className="shrink-0 px-4 pb-8">
            {error ? (
              <p role="alert" className="mb-2 text-center text-[12px]" style={{ color: "#ff9c85" }}>
                {error}
              </p>
            ) : null}

            <div className="no-bar mb-3 flex gap-2 overflow-x-auto">
              {FILTERS.map((item) => {
                const on = filter === item.key;
                return (
                  <button
                    key={item.key || "none"}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold"
                    style={{
                      background: on ? "#fff" : "rgba(255,255,255,.14)",
                      color: on ? "#0b1219" : "#fff",
                    }}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={pending}
              onClick={publish}
              className="brand-gradient w-full rounded-xl text-[15px] font-bold disabled:opacity-50"
              style={{ height: 52, color: "var(--color-on-brand)" }}
            >
              {pending ? "ننشر…" : "انشر القصة"}
            </button>
          </div>
        </div>
      ) : null}

      {error && !draft ? (
        <p role="alert" className="mt-1 text-center text-[10px]" style={{ color: "var(--color-live)" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
