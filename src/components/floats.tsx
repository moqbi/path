"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ReactionGlyph } from "@/components/reactions";
import { dropFloatComment, readFloats, sendFloatComment, type FloatComment, type Floats } from "@/app/float-actions";

/**
 * التفاعلاتُ والتعليقاتُ تطفو على القصّة والنوت (القاعدة ٣٤٤) — نسخةُ `components/floats.tsx`
 * في الجوّال: وجوهٌ وسطورٌ بلا أسماء تصعد وتتمايل وتذوب، مرّةً لكلّ فتح، وما يصل بعدها يطير
 * لحظتَه. والحركةُ CSS (`.float-up`)، ومن طلب «قلّل الحركة» لا يرى شيئاً يطير.
 */

type Target = { kind: "story" | "note"; id: string };
type Flyer = { key: string; face?: string; body?: string; mine?: boolean; x: number; ms: number };

const listeners = new Set<(target: Target, row: FloatComment) => void>();
const announce = (target: Target, row: FloatComment) => listeners.forEach((fn) => fn(target, row));

export function useFloats(target: Target | null) {
  const [data, setData] = useState<Floats | null>(null);
  useEffect(() => {
    if (!target) return;
    let live = true;
    const pull = () => void readFloats(target.kind, target.id).then((res) => live && res && setData(res));
    pull();
    const tick = setInterval(pull, 15_000);
    const mine = (at: Target, row: FloatComment) => {
      if (at.kind === target.kind && at.id === target.id) {
        setData((old) => (old ? { ...old, comments: [...old.comments, row] } : { reactions: [], comments: [row] }));
      }
    };
    listeners.add(mine);
    return () => {
      live = false;
      clearInterval(tick);
      listeners.delete(mine);
    };
  }, [target?.kind, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, setData] as const;
}

export function FloatLayer({
  target,
  top = 22,
  bottom = 78,
  data: given,
  fixed = false,
}: {
  target: Target;
  top?: number;
  bottom?: number;
  /** ما جلبه أبٌ يعرضه أيضاً — فلا يُسأل الخادمُ مرّتين. */
  data?: Floats | null;
  /** بملء الشاشة فوق نافذةٍ لا داخل أبيه — النوت. */
  fixed?: boolean;
}) {
  const [own] = useFloats(given === undefined ? target : null);
  const data = given === undefined ? own : given;
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const seen = useRef(new Set<string>());
  const queue = useRef<Flyer[]>([]);

  useEffect(() => {
    if (!data) return;
    const faces: Flyer[] = [];
    const texts: Flyer[] = [];
    data.reactions.forEach((row, at) => {
      const key = `r-${row.kind}-${row.at}-${at}`;
      if (!seen.current.has(key)) faces.push({ key, face: row.kind, x: 8 + Math.random() * 74, ms: 4200 + Math.random() * 800 });
    });
    for (const row of data.comments) {
      const key = `c-${row.id}`;
      if (!seen.current.has(key)) texts.push({ key, body: row.body, mine: row.mine, x: 12 + Math.random() * 26, ms: 5200 });
    }
    const mixed: Flyer[] = [];
    while (faces.length || texts.length) {
      if (texts.length) mixed.push(texts.shift()!);
      if (faces.length) mixed.push(faces.shift()!);
      if (faces.length) mixed.push(faces.shift()!);
    }
    for (const one of mixed) seen.current.add(one.key);
    queue.current.push(...mixed);
  }, [data]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const tick = setInterval(() => {
      const next = queue.current.shift();
      if (next) setFlyers((now) => [...now.slice(-9), next]);
    }, 650);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className={`pointer-events-none ${fixed ? "fixed z-[80]" : "absolute z-[15]"} inset-0 overflow-hidden`} aria-hidden>
      {flyers.map((one) => (
        <span
          key={one.key}
          className="float-up absolute"
          style={
            {
              left: `${one.x}%`,
              top: `${bottom}%`,
              animationDuration: `${one.ms}ms`,
              "--rise": `${bottom - top}vh`,
              "--sway": `${(Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 18)}px`,
            } as React.CSSProperties
          }
          onAnimationEnd={() => setFlyers((now) => now.filter((x) => x.key !== one.key))}
        >
          {one.face ? (
            <ReactionGlyph kind={one.face} size={34} />
          ) : (
            <span
              dir="auto"
              className="block max-w-[60vw] rounded-2xl border px-3 py-1.5 text-[13.5px] font-semibold"
              style={{
                background: one.mine ? "rgba(246,185,59,.85)" : "rgba(14,26,36,.62)",
                color: one.mine ? "#0E1A24" : "#fff",
                borderColor: "rgba(255,255,255,.16)",
              }}
            >
              {one.body}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** حقلُ التعليق داخل صندوق التفاعل (القاعدة ٣٤٤). */
export function CommentField({ target, onFocus, onBlur }: { target: Target; onFocus?: () => void; onBlur?: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setProblem(null);
    const res = await sendFloatComment(target.kind, target.id, body);
    setBusy(false);
    if ("error" in res) return setProblem(res.error);
    setText("");
    announce(target, res);
    field.current?.blur();
  };

  return (
    <div className="flex flex-col gap-1" onClick={(event) => event.stopPropagation()}>
      <form
        className="flex h-10 items-center gap-1.5 rounded-full pe-1 ps-3.5"
        style={{ background: "rgba(255,255,255,.12)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          ref={field}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          maxLength={80}
          placeholder="علّق بدون اسم…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/50"
        />
        <button
          type="submit"
          aria-label="أرسل"
          disabled={!text.trim() || busy}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold disabled:opacity-40"
          style={{ background: "#F6B93B", color: "#0E1A24" }}
        >
          {busy ? "…" : "↑"}
        </button>
      </form>
      {problem ? <p className="text-center text-[11.5px]" style={{ color: "#FF9C82" }}>{problem}</p> : null}
    </div>
  );
}

/** تعليقاتُ ما نشرتُه بلا أسماء، ولكلٍّ حذف. */
export function OwnerComments({ target, light = false }: { target: Target; light?: boolean }) {
  const [data, setData] = useFloats(target);
  if (!data?.comments.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5" onClick={(event) => event.stopPropagation()}>
      <p className={`text-[12px] font-bold ${light ? "text-muted" : "text-white/60"}`}>تعليقات بلا أسماء</p>
      {data.comments.map((row) => (
        <div key={row.id} className={`flex items-center gap-2 rounded-xl p-2.5 ${light ? "bg-paper" : "bg-white/10"}`}>
          <p dir="auto" className={`min-w-0 flex-1 text-[13.5px] ${light ? "text-ink" : "text-white"}`}>
            {row.body}
          </p>
          {row.canDelete ? (
            <button
              type="button"
              className="text-[12px] font-bold"
              style={{ color: "#FF7A5A" }}
              onClick={() => {
                setData((old) => (old ? { ...old, comments: old.comments.filter((c) => c.id !== row.id) } : old));
                void dropFloatComment(row.id);
              }}
            >
              حذف
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * ما يطفو على النوت ومعه حقلُها أو تعليقاتُها لصاحبها — بسؤالٍ واحد. ومن لا يُتاح له
 * (`readFloats` يردّ فارغاً) لا يرى شيئاً.
 */
export function NoteFloats({ noteId, mine }: { noteId: string; mine: boolean }) {
  const target = { kind: "note" as const, id: noteId };
  const [data] = useFloats(target);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  if (!data) return null;
  return (
    <div className="w-full">
      {host ? createPortal(<FloatLayer target={target} data={data} top={6} bottom={42} fixed />, host) : null}
      {mine ? <OwnerComments target={target} /> : <CommentField target={target} />}
    </div>
  );
}
