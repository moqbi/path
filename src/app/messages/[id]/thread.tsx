"use client";

import { useEffect, useRef, useState } from "react";
import { editMessage } from "@/app/actions";
import { Ticks, receiptOf } from "@/components/receipt";
import { PauseIcon, PlayIcon } from "@/components/icons";
import { ar, timeOfDay } from "@/lib/format";

/**
 * سطور المحادثة: فقاعة لكلّ رسالة، وتحت رسائلي إيصالها.
 *
 * صحٌّ واحد: خرجت من عندي. صحّان: وصلت جهازه. وإذا قرأها تلوّن الصحّان
 * بلون العلامة — ثلاث حالات تُقرأ بلمحة بلا كلمة.
 *
 * ولمسة على فقاعتي تكشف «تعديل»: النصّ يُصحَّح مكانه، ويبقى أثر التعديل
 * مكتوباً للطرفين — لا نُخفي أنّ الكلام تغيّر.
 */
export type Line = {
  id: string;
  body: string;
  kind: "TEXT" | "VOICE" | "PHOTO";
  mediaId: string | null;
  seconds: number | null;
  senderId: string;
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
  editedAt: Date | null;
};

export function Thread({ lines, meId }: { lines: Line[]; meId: string }) {
  // الفقاعة المفتوحة للتعديل، والفقاعة التي كُشف زرّها بلمسة.
  const [editing, setEditing] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  if (lines.length === 0) {
    return (
      <p className="pb-6 text-center text-[13px] text-muted">
        لا رسائل بعد. اكتب أول سطر.
      </p>
    );
  }

  return (
    <>
      {lines.map((line) => {
        const mine = line.senderId === meId;
        const open = editing === line.id;

        return (
          <div
            key={line.id}
            data-message={line.id}
            className="flex flex-col"
            style={{ alignItems: mine ? "flex-start" : "flex-end" }}
          >
            {open ? (
              <form
                className="flex w-[86%] items-center gap-2"
                action={async (formData: FormData) => {
                  await editMessage(line.id, formData);
                  setEditing(null);
                  setShown(null);
                }}
              >
                <input
                  ref={field}
                  name="body"
                  required
                  maxLength={2000}
                  defaultValue={line.body}
                  autoComplete="off"
                  aria-label="تعديل الرسالة"
                  className="grow rounded-2xl border border-clay bg-card px-3.5 text-[13.5px] text-ink outline-none"
                  style={{ height: 40 }}
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full px-3 text-[12px] font-bold"
                  style={{
                    height: 34,
                    background: "var(--color-clay)",
                    color: "var(--color-on-brand)",
                  }}
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="shrink-0 text-[12px] text-muted"
                >
                  إلغاء
                </button>
              </form>
            ) : (
              line.kind === "PHOTO" && line.mediaId ? (
                <Shot mediaId={line.mediaId} />
              ) : line.kind === "VOICE" && line.mediaId ? (
                <Voice mediaId={line.mediaId} seconds={line.seconds ?? 0} mine={mine} />
              ) : (
                <button
                  type="button"
                  // لمسة على رسالتي تكشف التعديل؛ رسالة غيري لا تُلمس.
                  onClick={mine ? () => setShown((v) => (v === line.id ? null : line.id)) : undefined}
                  aria-label={mine ? "خيارات الرسالة" : undefined}
                  className="max-w-[78%] cursor-default rounded-2xl px-3.5 py-2.5 text-right"
                  style={{
                    background: mine ? "var(--color-clay)" : "var(--color-card)",
                    color: mine ? "var(--color-on-brand)" : "var(--color-ink)",
                    border: mine ? "none" : "1px solid var(--color-line)",
                  }}
                >
                  <p className="text-[13.5px] leading-relaxed">{line.body}</p>
                </button>
              )
            )}

            <span className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-faint">
              {timeOfDay(line.createdAt)}
              {line.editedAt && <span>معدّلة</span>}
              {mine && <Ticks state={receiptOf(line)} />}
              {mine && line.kind === "TEXT" && shown === line.id && !open && (
                <button
                  type="button"
                  onClick={() => setEditing(line.id)}
                  className="font-bold text-clay"
                >
                  تعديل
                </button>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** صورةٌ في المحادثة: تُفتح كاملةً بالضغط. */
function Shot({ mediaId }: { mediaId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="افتح الصورة"
        className="block max-w-[72%] overflow-hidden rounded-2xl border border-line"
        style={{ lineHeight: 0, background: "var(--color-chip)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/media/${mediaId}`} alt="" style={{ display: "block", maxHeight: 280 }} />
      </button>

      {open ? (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(8,14,20,.94)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${mediaId}`}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * فقاعة الصوت: زرّ تشغيل، وشريط يمشي مع الصوت، والمدّة.
 *
 * التشغيل بعنصر `audio` واحد لكل فقاعة — لا مشغّل عامّ في الصفحة: صوتان
 * يعملان معاً أسوأ من ضغطتين.
 */
function Voice({ mediaId, seconds, mine }: { mediaId: string; seconds: number; mine: boolean }) {
  const sound = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);

  const ink = mine ? "var(--color-on-brand)" : "var(--color-ink)";
  const done = seconds > 0 ? Math.min(1, at / seconds) : 0;

  return (
    <div
      className="flex max-w-[78%] items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{
        background: mine ? "var(--color-clay)" : "var(--color-card)",
        border: mine ? "none" : "1px solid var(--color-line)",
        minWidth: 180,
      }}
    >
      <audio
        ref={sound}
        src={`/api/media/${mediaId}`}
        preload="none"
        onTimeUpdate={(event) => setAt(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
      />
      <button
        type="button"
        aria-label={playing ? "إيقاف" : "تشغيل"}
        onClick={() => {
          const el = sound.current;
          if (!el) return;
          if (playing) {
            el.pause();
            setPlaying(false);
          } else {
            void el.play();
            setPlaying(true);
          }
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: mine ? "rgba(14,26,36,.16)" : "var(--color-chip)", color: ink }}
      >
        {playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
      </button>

      <span className="relative block h-1 grow overflow-hidden rounded-full" style={{ background: mine ? "rgba(14,26,36,.22)" : "var(--color-line)" }}>
        <span
          className="absolute inset-y-0 right-0 block rounded-full"
          style={{ width: `${done * 100}%`, background: ink }}
        />
      </span>

      <span className="shrink-0 text-[11px] font-semibold" style={{ color: ink }}>
        {ar(Math.max(0, Math.round(seconds - at)))}″
      </span>
    </div>
  );
}
