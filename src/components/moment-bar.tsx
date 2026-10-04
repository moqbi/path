"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { markSeenMany, react } from "@/app/actions";
import { LockIcon } from "@/components/icons";
import { ReactionGlyph } from "@/components/reactions";
import { ReactSheet } from "@/components/react-sheet";

type Mine = { kind: string; emoji: string | null } | null;

/**
 * شريط اللحظة: زرّ واحد في يسار المنشور. بالضغط عليه تُفتح نافذةٌ زجاجيّة
 * فيها الوجوه والتعليق والحذف أو البلاغ (القاعدة ٢٤٧، كالجوّال) — والبطاقةُ
 * لا تتحرّك. وتُغلق بعد اختيار وجه أو إرسال تعليق، وبالضغط خارجها.
 */
export function MomentBar({
  momentId,
  momentKind,
  mine,
  isPlus,
  author = false,
  moderate = false,
  head,
  extra,
  inset = false,
  media,
  footer,
  locked = false,
}: {
  momentId: string;
  /** نوع اللحظة: منه يُعرف هل يُعرض وجه النوم. */
  momentKind?: string;
  mine: Mine;
  /** صاحب اللحظة يرى «احذف اللحظة» في اللوحة نفسها. */
  author?: boolean;
  /**
   * صلاحية الإشراف: يرى الزرّ نفسه على لحظة غيره.
   *
   * البلاغ يصل على منشور، فيفتحه المشرف حيث يقرؤه الناس ويحكم في
   * مكانه — لا يحفظ معرّفاً ويبحث عنه في لوحة تحكّم. والبابان مختلفان
   * وإن تشابه الزرّان: صاحبُها `deleteMoment`، والمشرف
   * `removeMomentAsAdmin` خلف فحصِ صلاحيةٍ ومعه سجلّ.
   */
  moderate?: boolean;
  isPlus: boolean;
  /** سطر الحدث — يجلس الزرّ في طرفه الأيسر بدل أن يطفو تحته. */
  head?: React.ReactNode;
  /** ما يلي السطر: الصورة وقالب المتفاعلين. */
  extra?: React.ReactNode;
  /** داخل بطاقة: الزرّ واللوحة يأخذان حشوة البطاقة والصورة تبقى سائبة. */
  inset?: boolean;
  /** صورةُ البطاقة: فوق ركن الزرّ لا تحته — كان يطفو على الصورة نفسها. */
  media?: React.ReactNode;
  /**
   * ما تحت اللوحة: الوجوه والتعليقات. اللوحةُ تُفتح بين المتن وبينه —
   * **بقرار المالك**، كالجوّال: كانت فوق النصّ ويتكرّر صفُّ وجوهها تحتها.
   */
  footer?: React.ReactNode;
  /** التعليقاتُ مقفلة بيد صاحبها: يبقى التفاعل، ويذهب الحقل. */
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [popped, setPopped] = useState(false);
  // القفلُ هنا لا في لوحة صاحبها: يُرى على الزرّ نفسه قبل أن يُفتح.
  const [isLocked, setLocked] = useState(locked);
  useEffect(() => setLocked(locked), [locked]);
  const [, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  // ما ظهر نصفُه على الشاشة ثانيةً يُكتب «شافها» — منه لوحةُ صاحب اللحظة.
  useEffect(() => {
    if (author || !root.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer = setTimeout(() => {
            watch.disconnect();
            seenQueue(momentId);
          }, 1000);
        } else if (timer) clearTimeout(timer);
      },
      { threshold: 0.5 },
    );
    watch.observe(root.current);
    return () => {
      if (timer) clearTimeout(timer);
      watch.disconnect();
    };
  }, [author, momentId]);

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
    start(() => void react(momentId, kind, emoji));
  }

  return (
    <div ref={root} className={head ? "" : inset ? "relative" : "mt-2"} onClick={contain}>
      {inset ? (
        <>
          {/* الزرُّ في ركن البطاقة الأعلى، والصورةُ تنزل تحته ثمّ المتن — بقرار المالك. */}
          <div className="absolute left-3 top-2.5 z-10">
            <button
          type="button"
          aria-label={isLocked ? "تفاعل — التعليقات مقفلة" : "تفاعل"}
          aria-expanded={open}
          onClick={(event) => {
            stop(event);
            setOpen((v) => !v);
          }}
          // دائرة بحجم الوجه لا أكبر: الإطار الواسع كان يبدو زرّاً غريباً
          // ملتصقاً بالصورة تحته.
          className="flex items-center justify-center rounded-full border"
          style={{
            width: 30,
            height: 30,
            // أرضيةٌ صلبة لا شفافة: فوق صورة الثيم كان الزرّ يكاد يختفي.
            background: mine || isLocked ? "var(--color-clay-soft)" : "var(--color-card)",
            borderColor: mine || isLocked ? "var(--color-clay)" : "var(--color-line)",
            boxShadow: "0 1px 3px rgba(14,26,36,.10)",
          }}
        >
          {/* التعليقاتُ مقفلة: الزرّ نفسه يقولها — بقرار المالك. */}
          {isLocked ? (
            <span style={{ color: "var(--color-clay-ink)" }}>
              <LockIcon size={15} />
            </span>
          ) : (
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
          )}
        </button>
          </div>
          {media}
          {extra}
        </>
      ) : (
        /* في RTL يضع `justify-end` الزرَّ في الطرف الأيسر من المنشور. */
        <div className={head ? "flex items-start gap-2" : "flex justify-end"}>
          {head ? <div className="min-w-0 grow">{head}</div> : null}
        <button
          type="button"
          aria-label={isLocked ? "تفاعل — التعليقات مقفلة" : "تفاعل"}
          aria-expanded={open}
          onClick={(event) => {
            stop(event);
            setOpen((v) => !v);
          }}
          // دائرة بحجم الوجه لا أكبر: الإطار الواسع كان يبدو زرّاً غريباً
          // ملتصقاً بالصورة تحته.
          className="flex items-center justify-center rounded-full border"
          style={{
            width: 30,
            height: 30,
            // أرضيةٌ صلبة لا شفافة: فوق صورة الثيم كان الزرّ يكاد يختفي.
            background: mine || isLocked ? "var(--color-clay-soft)" : "var(--color-card)",
            borderColor: mine || isLocked ? "var(--color-clay)" : "var(--color-line)",
            boxShadow: "0 1px 3px rgba(14,26,36,.10)",
          }}
        >
          {/* التعليقاتُ مقفلة: الزرّ نفسه يقولها — بقرار المالك. */}
          {isLocked ? (
            <span style={{ color: "var(--color-clay-ink)" }}>
              <LockIcon size={15} />
            </span>
          ) : (
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
          )}
        </button>
        </div>
      )}

      {inset ? null : extra}

      {open ? (
        <ReactSheet
          momentId={momentId}
          momentKind={momentKind}
          mine={mine}
          isPlus={isPlus}
          author={author}
          moderate={moderate}
          locked={isLocked}
          onLocked={setLocked}
          onChoose={choose}
          onClose={() => setOpen(false)}
        />
      ) : null}

      {footer}
    </div>
  );
}

/*
  «شافها» دفعةً: تمريرةٌ تمرّ على عشر لحظات لا تُرسل عشرة إجراءات.
  وما أُرسل في هذه الصفحة لا يُعاد.
*/
const sentSeen = new Set<string>();
let seenBatch: string[] = [];
let seenTimer: ReturnType<typeof setTimeout> | null = null;
function seenQueue(id: string) {
  if (sentSeen.has(id)) return;
  sentSeen.add(id);
  seenBatch.push(id);
  if (seenTimer) return;
  seenTimer = setTimeout(() => {
    const batch = seenBatch.slice(0, 50);
    seenBatch = seenBatch.slice(50);
    seenTimer = null;
    void markSeenMany(batch).catch(() => batch.forEach((id) => sentSeen.delete(id)));
  }, 1200);
}
