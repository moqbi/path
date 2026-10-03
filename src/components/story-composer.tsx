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
export const FILTERS: { key: string; name: string; css: string; vignette?: number }[] = [
  { key: "", name: "بلا", css: "none" },
  { key: "warm", name: "دافئ", css: "sepia(.35) saturate(1.25) contrast(1.03)" },
  { key: "gold", name: "ذهبي", css: "sepia(.25) saturate(1.4) hue-rotate(-8deg) brightness(1.05) contrast(1.05)", vignette: 0.25 },
  { key: "dusk", name: "غروب", css: "sepia(.3) saturate(1.6) hue-rotate(-20deg) contrast(1.1)", vignette: 0.35 },
  { key: "desert", name: "صحراء", css: "sepia(.5) saturate(1.5) hue-rotate(-12deg) brightness(1.06)", vignette: 0.2 },
  { key: "sand", name: "رملي", css: "sepia(.6) saturate(1.1) brightness(1.05)" },
  { key: "vivid", name: "زاهي", css: "saturate(1.5) contrast(1.1)" },
  { key: "pop", name: "نابض", css: "saturate(1.8) contrast(1.2) brightness(1.03)" },
  { key: "chrome", name: "كروم", css: "contrast(1.25) saturate(1.3) brightness(.97)", vignette: 0.2 },
  { key: "noon", name: "ظهيرة", css: "brightness(1.12) contrast(1.05) saturate(1.15)" },
  { key: "cool", name: "بارد", css: "hue-rotate(-12deg) saturate(1.1) brightness(1.04)" },
  { key: "teal", name: "فيروزي", css: "hue-rotate(-25deg) saturate(1.3) contrast(1.1) brightness(1.02)" },
  { key: "ocean", name: "بحر", css: "hue-rotate(-40deg) saturate(1.2) brightness(1.04) contrast(1.05)" },
  { key: "rose", name: "وردي", css: "hue-rotate(12deg) saturate(1.2) brightness(1.03)" },
  { key: "candy", name: "حلوى", css: "hue-rotate(20deg) saturate(1.5) brightness(1.08) contrast(.95)" },
  { key: "fade", name: "باهت", css: "saturate(.75) brightness(1.08) contrast(.92)" },
  { key: "mist", name: "ضباب", css: "brightness(1.15) contrast(.8) saturate(.7)" },
  { key: "film", name: "فيلم", css: "contrast(1.2) saturate(.85) sepia(.15)", vignette: 0.3 },
  { key: "retro", name: "قديم", css: "sepia(.45) contrast(.9) brightness(1.1) saturate(.8)", vignette: 0.45 },
  { key: "night", name: "ليلي", css: "brightness(.9) contrast(1.15) hue-rotate(-8deg) saturate(.9)", vignette: 0.3 },
  { key: "mono", name: "رمادي", css: "grayscale(1) contrast(1.08)" },
  { key: "silver", name: "فضي", css: "grayscale(1) brightness(1.12) contrast(.95)" },
  { key: "ink", name: "حبر", css: "grayscale(1) contrast(1.35) brightness(.95)" },
  { key: "noir", name: "نوار", css: "grayscale(1) contrast(1.6) brightness(.9)", vignette: 0.5 },
];

/**
 * إعتامُ أطراف الفلتر — طبقةٌ فوق الصورة بالتدرّج نفسه الذي يرسمه الجوّال
 * (`Vignette` في `apps/mobile/components/filtered.tsx`): شفّافٌ حتى نصف القطر
 * ثمّ يدكن إلى الحافّة.
 */
export const vignetteCss = (key: string | null | undefined): string | null => {
  const amount = FILTERS.find((item) => item.key === (key ?? ""))?.vignette;
  return amount ? `radial-gradient(circle closest-corner at center, rgba(0,0,0,0) 50%, rgba(0,0,0,${amount}) 100%)` : null;
};

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
            {vignetteCss(filter) ? (
              <span className="pointer-events-none absolute inset-4 rounded-2xl" style={{ background: vignetteCss(filter)! }} />
            ) : null}
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
                // الصورةُ نفسها في كلّ قرص (القاعدة ٩٦): الاسمُ وحده تخمين.
                return (
                  <button
                    key={item.key || "none"}
                    type="button"
                    aria-label={`فلتر ${item.name}`}
                    onClick={() => setFilter(item.key)}
                    className="flex shrink-0 flex-col items-center gap-1"
                  >
                    <span
                      className="relative block overflow-hidden rounded-xl"
                      style={{ width: 56, height: 74, outline: on ? "2px solid #F6B93B" : "none", outlineOffset: 2, background: "#0b1219" }}
                    >
                      {draft.video ? null : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={draft.url} alt="" className="h-full w-full object-cover" style={{ filter: item.css }} />
                      )}
                      {item.vignette ? <span className="absolute inset-0" style={{ background: vignetteCss(item.key)! }} /> : null}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: on ? "#F6B93B" : "rgba(255,255,255,.8)" }}>
                      {item.name}
                    </span>
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
