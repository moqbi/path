"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addComment, deleteMoment, react } from "@/app/actions";
import { LockIcon } from "@/components/icons";
import { CUSTOM, facesFor, ReactionGlyph } from "@/components/reactions";

type Mine = { kind: string; emoji: string | null } | null;

/**
 * شريط اللحظة: زرّ واحد في يسار المنشور. بالضغط عليه تُفتح الوجوه
 * ومساحة التعليق معاً.
 *
 * ويُغلق نفسه بعد اختيار وجه أو إرسال تعليق، وبالضغط خارجه بلا شيء —
 * فالصندوق المفتوح على كل منشور ضجيج، والعودة إليه ضغطةٌ واحدة.
 */
export function MomentBar({
  momentId,
  momentKind,
  mine,
  isPlus,
  author = false,
  head,
  extra,
  inset = false,
  panelFirst = false,
}: {
  momentId: string;
  /** نوع اللحظة: منه يُعرف هل يُعرض وجه النوم. */
  momentKind?: string;
  mine: Mine;
  /** صاحب اللحظة يرى «احذف اللحظة» في اللوحة نفسها. */
  author?: boolean;
  isPlus: boolean;
  /** سطر الحدث — يجلس الزرّ في طرفه الأيسر بدل أن يطفو تحته. */
  head?: React.ReactNode;
  /** ما يلي السطر: الصورة وقالب المتفاعلين. */
  extra?: React.ReactNode;
  /** داخل بطاقة: الزرّ واللوحة يأخذان حشوة البطاقة والصورة تبقى سائبة. */
  inset?: boolean;
  /** اللوحة تحت الزرّ مباشرة لا تحت المحتوى — حين يكون الزرّ في الأعلى. */
  panelFirst?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState(false);
  const [asking, setAsking] = useState(false);
  const [popped, setPopped] = useState(false);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const faces = facesFor(momentKind);

  // ضغطةٌ خارج الشريط تطويه — ما لم يكن هناك تعليق نصف مكتوب يضيع.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      if (body.trim().length > 0) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, body]);

  // البطاقة قد تكون رابطاً، فيجب أن يقف الحدث هنا وإلا فُتحت اللحظة.
  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  /**
   * على الحاوية: يقف الصعود فقط بلا `preventDefault`.
   * منعُ الافتراضي هنا كان يبتلع إرسال النموذج نفسه — فزرّ «إرسال» لا
   * يفعل شيئاً وإن ظهر.
   */
  const contain = (event: React.SyntheticEvent) => event.stopPropagation();

  function choose(kind: string, emoji?: string) {
    setPopped(true);
    setTimeout(() => setPopped(false), 420);
    // الوجه فعلٌ كامل بنفسه: يُختار فيُطوى الشريط، ويُفتح ثانيةً لمن أراد
    // أن يكتب بعده.
    setOpen(false);
    setBoard(false);
    setAsking(false);
    start(() => void react(momentId, kind, emoji));
  }

  return (
    <div ref={root} className={head ? "" : "mt-2"} onClick={contain}>
      {/* في RTL يضع `justify-end` الزرَّ في الطرف الأيسر من المنشور. */}
      <div
        className={`${head ? "flex items-start gap-2" : "flex justify-end"} ${
          inset ? "px-3 pb-2 pt-2.5" : ""
        }`}
      >
        {head ? <div className="min-w-0 grow">{head}</div> : null}
        <button
          type="button"
          aria-label="تفاعل"
          aria-expanded={open}
          onClick={(event) => {
            stop(event);
            setBoard(false);
            setOpen((v) => !v);
          }}
          // دائرة بحجم الوجه لا أكبر: الإطار الواسع كان يبدو زرّاً غريباً
          // ملتصقاً بالصورة تحته.
          className="flex items-center justify-center rounded-full border"
          style={{
            width: 30,
            height: 30,
            // أرضيةٌ صلبة لا شفافة: فوق صورة الثيم كان الزرّ يكاد يختفي.
            background: mine ? "var(--color-clay-soft)" : "var(--color-card)",
            borderColor: mine ? "var(--color-clay)" : "var(--color-line)",
            boxShadow: "0 1px 3px rgba(14,26,36,.10)",
          }}
        >
          <span
            style={{
              transform: popped ? "scale(1.4)" : "scale(1)",
              transition: "transform 400ms cubic-bezier(.18,1.5,.4,1)",
              opacity: mine ? 1 : 0.72,
              filter: mine ? "none" : "grayscale(.7)",
            }}
          >
            <ReactionGlyph kind={mine?.kind ?? "SMILE"} emoji={mine?.emoji} size={20} />
          </span>
        </button>
      </div>

      {panelFirst ? null : extra}

      {open ? (
        <div className={`mt-2 flex flex-col gap-2 ${inset ? "px-3" : ""}`}>
          <div className="flex items-center gap-0.5">
            {faces.map((kind, index) => (
              <button
                key={kind}
                type="button"
                aria-label={kind}
                onClick={(event) => {
                  stop(event);
                  choose(kind);
                }}
                className="flex h-10 w-9 items-center justify-center rounded-xl hover:bg-chip"
                style={{
                  animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                  animationDelay: `${index * 34}ms`,
                }}
              >
                <ReactionGlyph kind={kind} size={25} />
              </button>
            ))}

            <span className="mx-0.5 h-6 w-px bg-line" />

            {isPlus ? (
              <>
                {CUSTOM.slice(0, 2).map((emoji, index) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(event) => {
                      stop(event);
                      choose("CUSTOM", emoji);
                    }}
                    className="flex h-10 w-9 items-center justify-center rounded-xl text-[21px] leading-none hover:bg-chip"
                    style={{
                      animation: "athr-pop 320ms cubic-bezier(.18,1.4,.4,1) both",
                      animationDelay: `${(faces.length + index) * 34}ms`,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                {/* «＋» يفتح الكيبورد كاملاً — الاشتراك يَعِد بكل الإيموجي لا باثنين. */}
                <button
                  type="button"
                  aria-label="كل الإيموجي"
                  aria-expanded={board}
                  onClick={(event) => {
                    stop(event);
                    setBoard((v) => !v);
                  }}
                  className="flex h-10 w-9 items-center justify-center rounded-xl text-[18px] font-bold leading-none hover:bg-chip"
                  style={{ color: "var(--color-clay-ink)" }}
                >
                  {board ? "×" : "＋"}
                </button>
              </>
            ) : (
              <a
                href="/subscribe"
                aria-label="الإيموجي الحر لمشتركي أثر+"
                className="flex h-10 w-9 items-center justify-center rounded-xl"
                style={{ color: "var(--color-gold-ink)" }}
              >
                <LockIcon size={16} />
              </a>
            )}
          </div>

          {board ? (
            <div
              className="no-bar grid grid-cols-8 gap-0.5 overflow-y-auto rounded-2xl border border-line bg-card p-1.5"
              style={{ maxHeight: 168 }}
            >
              {CUSTOM.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(event) => {
                    stop(event);
                    choose("CUSTOM", emoji);
                  }}
                  className="flex h-9 items-center justify-center rounded-lg text-[20px] leading-none hover:bg-chip"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          {author ? (
            <div className="flex items-center justify-end">
              {asking ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={(event) => {
                      stop(event);
                      setOpen(false);
                      setAsking(false);
                      start(() => void deleteMoment(momentId));
                    }}
                    className="h-8 rounded-full px-3 text-[11.5px] font-bold disabled:opacity-60"
                    style={{ background: "var(--color-live)", color: "#fff" }}
                  >
                    أحذفها
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      stop(event);
                      setAsking(false);
                    }}
                    className="h-8 rounded-full px-2.5 text-[11.5px] font-semibold text-muted"
                  >
                    تراجع
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    stop(event);
                    setAsking(true);
                  }}
                  className="h-8 rounded-full px-2.5 text-[11.5px] font-semibold"
                  style={{ color: "var(--color-live)" }}
                >
                  احذف اللحظة
                </button>
              )}
            </div>
          ) : null}

          <form
            action={() => {
              const text = body.trim();
              if (!text) return;
              const data = new FormData();
              data.set("body", text);
              setBody("");
              setOpen(false);
              start(() => void addComment(momentId, data));
            }}
            className="flex items-center gap-2"
          >
            <input
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="علّق…"
              maxLength={500}
              aria-label="تعليق"
              autoFocus
              className="h-9 min-w-0 grow rounded-full border border-line bg-paper px-3.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-clay"
            />
            {body.trim() ? (
              <button
                type="submit"
                disabled={pending}
                className="h-9 shrink-0 rounded-full px-3.5 text-[12px] font-bold disabled:opacity-60"
                style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
              >
                إرسال
              </button>
            ) : null}
          </form>
        </div>
      ) : null}

      {panelFirst ? extra : null}
    </div>
  );
}
