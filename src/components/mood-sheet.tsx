"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listMoods, postMood, postQuestion } from "@/app/actions";
import { GlassSheet } from "@/components/glass-sheet";
import { MoodArt } from "@/components/mood-art";
import { asset } from "@/lib/base";
import { ar } from "@/lib/format";

type Mood = { id: string; emoji: string; name: string; color: string; mediaId: string | null };
type Kind = "MOOD" | "QUESTION";

const MOOD_MAX = 60;
const QUESTION_MAX = 250;

/** يفتح نافذة «مود» أو «سؤال» من قوس النشر — حدثٌ لا رابط: نافذةٌ لا صفحة (القاعدة ٤٨٤). */
export const openQuick = (kind: Kind) => window.dispatchEvent(new CustomEvent("athr:quick", { detail: kind }));

/**
 * نافذتا «مود» و«سؤال» (القاعدة ٤٨٤) — **بقرار المالك**، كالجوّال: زجاجٌ في وسط الشاشة
 * بعرضٍ أنيق، وفي أعلاها معاينةٌ حيّة لما سيُنشر. ومن ٦٤٠ عمودان: المعاينةُ والأدوات.
 */
export function MoodSheet() {
  const [open, setOpen] = useState<Kind | null>(null);
  useEffect(() => {
    const onOpen = (event: Event) => setOpen((event as CustomEvent<Kind>).detail);
    window.addEventListener("athr:quick", onOpen);
    return () => window.removeEventListener("athr:quick", onOpen);
  }, []);
  if (!open) return null;
  return open === "MOOD" ? <MoodBody close={() => setOpen(null)} /> : <QuestionBody close={() => setOpen(null)} />;
}

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return wide;
}

const FIELD =
  "w-full rounded-2xl border px-4 py-3 text-[14.5px] leading-[1.6] text-white outline-none placeholder:text-white/45 focus:border-white/40";
const FIELD_STYLE = { background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.12)" } as const;

function Layout({ wide, preview, controls }: { wide: boolean; preview: React.ReactNode; controls: React.ReactNode }) {
  return (
    <div className={wide ? "grid grid-cols-2 items-start gap-4 p-4" : "flex flex-col gap-3.5 p-4"}>
      <div className="min-w-0">{preview}</div>
      <div className="flex min-w-0 flex-col gap-3">{controls}</div>
    </div>
  );
}

function PostButton({ label, ready, pending, onClick }: { label: string; ready: boolean; pending: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={!ready || pending}
      onClick={onClick}
      className="h-12 rounded-2xl text-[14.5px] font-bold disabled:opacity-50"
      style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
    >
      {pending ? "…" : label}
    </button>
  );
}

function MoodBody({ close }: { close: () => void }) {
  const router = useRouter();
  const wide = useWide();
  const [moods, setMoods] = useState<Mood[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void listMoods().then((list) => {
      setMoods(list);
      setPicked((was) => was ?? list[0]?.id ?? null);
    });
  }, []);
  const mood = moods?.find((m) => m.id === picked) ?? null;

  // المختارُ يتوسّط الشريط فيُرى ما حوله يميناً ويساراً.
  useEffect(() => {
    strip.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [picked]);

  function submit() {
    if (!mood) return;
    const data = new FormData();
    data.set("moodId", mood.id);
    data.set("text", text.trim());
    start(async () => {
      const problem = await postMood(data);
      if (problem) return setError(problem);
      close();
      router.refresh();
    });
  }

  const preview = mood ? (
    <MoodArt mood={mood} text={text.trim() || null} className="rounded-[22px]" style={{ aspectRatio: wide ? 1.05 : 1.45 }} />
  ) : (
    <div className="rounded-[22px]" style={{ aspectRatio: wide ? 1.05 : 1.45, background: "rgba(255,255,255,.08)" }} />
  );

  const controls = (
    <>
      <div ref={strip} className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5" style={{ scrollbarWidth: "none", scrollSnapType: "x proximity" }}>
        {(moods ?? []).map((m) => {
          const on = m.id === picked;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              aria-label={m.name}
              onClick={() => setPicked(m.id)}
              className="flex w-[66px] shrink-0 flex-col items-center gap-0.5 rounded-[18px] border py-2 transition-transform"
              style={{
                scrollSnapAlign: "center",
                background: on ? "var(--color-clay)" : "rgba(255,255,255,.08)",
                borderColor: on ? "var(--color-clay)" : "rgba(255,255,255,.12)",
                color: on ? "var(--color-on-brand)" : "rgba(255,255,255,.85)",
                transform: on ? "scale(1.04)" : undefined,
              }}
            >
              <span className="text-[28px] leading-[34px]">{m.emoji}</span>
              <span className="truncate text-[11px] font-bold">{m.name}</span>
            </button>
          );
        })}
      </div>
      <div>
        <input
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MOOD_MAX))}
          placeholder="عبارة قصيرة (اختياري)…"
          aria-label="عبارة المود"
          className={FIELD}
          style={FIELD_STYLE}
        />
        <p className="latin mt-1 text-left text-[11px] text-white/50">
          {ar(text.length)} / {ar(MOOD_MAX)}
        </p>
      </div>
      {error ? <p className="text-center text-[12.5px] text-[#FF9C84]">{error}</p> : null}
      <PostButton label="انشر المود" ready={Boolean(mood)} pending={pending} onClick={submit} />
    </>
  );

  return (
    <GlassSheet title="وش مودك؟" subtitle="شارك مودك مع دائرتك" onClose={close} keep={text.length > 0} centered width={wide ? 720 : 400}>
      <Layout wide={wide} preview={preview} controls={controls} />
    </GlassSheet>
  );
}

function QuestionBody({ close }: { close: () => void }) {
  const router = useRouter();
  const wide = useWide();
  const [text, setText] = useState("");
  const [mine, setMine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const data = new FormData();
    data.set("text", text.trim());
    if (mine) data.set("private", "on");
    start(async () => {
      const problem = await postQuestion(data);
      if (problem) return setError(problem);
      close();
      router.refresh();
    });
  }

  // معاينةُ بطاقة السؤال كما تراها الدائرة.
  const preview = (
    <div className="flex flex-col gap-2 rounded-[22px] border border-line bg-card p-4 text-ink">
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-clay-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/composer/question.png")} alt="" className="h-[18px] w-[18px] object-contain" />
        سؤال لدائرتك
      </p>
      <p dir="auto" className="text-[16px] font-semibold leading-relaxed" style={{ color: text.trim() ? undefined : "var(--color-faint)" }}>
        {text.trim() || "سؤالك يظهر هنا…"}
      </p>
      <p className="text-[11.5px] text-muted">
        {mine ? "الإجابات لك وحدك — كلٌّ يرى إجابته" : "الإجابات ظاهرة لكل من يرى السؤال"}
      </p>
      <span className="self-start rounded-full border border-clay bg-clay-soft px-3.5 py-1.5 text-[12px] font-bold text-clay-ink">
        أضف إجابتك
      </span>
    </div>
  );

  const controls = (
    <>
      <div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, QUESTION_MAX))}
          rows={3}
          autoFocus
          placeholder="وش تبي تسأل؟"
          aria-label="السؤال"
          className={`${FIELD} resize-none`}
          style={FIELD_STYLE}
        />
        <p className="latin mt-1 text-left text-[11px] text-white/50">
          {ar(text.length)} / {ar(QUESTION_MAX)}
        </p>
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-3" style={FIELD_STYLE}>
        <span className="min-w-0 grow">
          <span className="block text-[13.5px] font-bold">الإجابات لي وحدي</span>
          <span className="block text-[11.5px] text-white/60">كلٌّ يرى إجابته وأنت ترى الكل</span>
        </span>
        <input
          type="checkbox"
          checked={mine}
          onChange={(event) => setMine(event.target.checked)}
          className="h-5 w-5 accent-[var(--color-clay)]"
        />
      </label>
      {error ? <p className="text-center text-[12.5px] text-[#FF9C84]">{error}</p> : null}
      <PostButton label="انشر السؤال" ready={text.trim().length > 0} pending={pending} onClick={submit} />
    </>
  );

  return (
    <GlassSheet title="اسأل دائرتك" subtitle="الإجابات تُكتب في التعليقات" onClose={close} keep={text.length > 0} centered width={wide ? 720 : 400}>
      <Layout wide={wide} preview={preview} controls={controls} />
    </GlassSheet>
  );
}
