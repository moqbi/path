"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { editComment, editMoment, setStoryAlert } from "@/app/actions";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { BellPlusIcon, PencilIcon } from "@/components/icons";
import { ar } from "@/lib/format";

type Target = { kind: "moment" | "comment"; id: string; text: string; required?: boolean };

/**
 * تعديلُ نصّ لحظةٍ أو تعليق (القاعدة ٣١٩) — نسخةُ الجوّال: يُفتح بسحب صاحبها من
 * اليسار إلى اليمين وقلمٍ لا كلمة، و«عُدّلت» يبقى ظاهراً بعده.
 */
export function EditSheet({ target, onClose }: { target: Target; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState(target.text);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const max = target.kind === "moment" ? 250 : 500;
  const clean = text.trim();
  const ready = clean !== target.text.trim() && (clean.length > 0 || !target.required);

  return (
    <Sheet title={target.kind === "moment" ? "عدّل لحظتك" : "عدّل تعليقك"} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, max))}
          autoFocus
          dir="auto"
          placeholder={target.kind === "moment" ? "اكتب شيئاً…" : "تعليقك…"}
          className="min-h-28 resize-none rounded-xl border border-line bg-card px-3.5 py-3 text-[14px] leading-relaxed text-ink outline-none focus:border-clay"
        />
        <p className="text-left text-[11px] text-faint">
          {ar(text.length)} / {ar(max)}
        </p>
        <p className="text-center text-[11.5px] text-muted">يظهر «عُدّلت» بجانبها لمن يراها</p>
        {error ? (
          <p role="alert" className="text-center text-[12px]" style={{ color: "var(--color-live)" }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!ready || pending}
          onClick={() =>
            start(async () => {
              const said = target.kind === "moment" ? await editMoment(target.id, clean) : await editComment(target.id, clean);
              if (said.error) return setError(said.error);
              router.refresh();
              onClose();
            })
          }
          className="h-12 rounded-xl text-[14px] font-bold disabled:opacity-50"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "نحفظ…" : "احفظ التعديل"}
        </button>
      </div>
    </Sheet>
  );
}

/** متنُ لحظتي يُسحب فيكشف القلم — المتنُ وحده لا البطاقة (القاعدة ٣١٩). */
export function MomentEditSwipe({
  momentId,
  text,
  required,
  gap = 0,
  children,
}: {
  momentId: string;
  text: string;
  required: boolean;
  gap?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SwipeRow
        onDelete={() => setOpen(true)}
        confirmLabel="عدّل اللحظة"
        icons
        tint="var(--color-clay)"
        mainIcon={<PencilIcon size={22} />}
        surface="var(--color-card)"
        gap={gap}
      >
        {children}
      </SwipeRow>
      {open ? <EditSheet target={{ kind: "moment", id: momentId, text, required }} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** جرسُ ملفّ الصديق (القاعدة ٣١٩): يُضيء بلون اللمسة مفعّلاً. */
export function AlertBell({
  friendId,
  name,
  initial,
  disc = false,
  avatar = null,
}: {
  friendId: string;
  name: string;
  initial: boolean;
  /** قرصٌ ٤٠ بجانب الاسم (القاعدة ٣٢٠) بدل زرّ صفّ الأزرار. */
  disc?: boolean;
  /** صورةُ الصديق في السطر الزجاجيّ. */
  avatar?: React.ReactNode;
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ on: boolean; at: number } | null>(null);
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `أوقف تنبيهات قصص ${name} ونوته` : `نبّهني بقصص ${name} ونوته`}
        title={on ? "تنبيهات قصصه ونوته مفعّلة" : "نبّهني بقصصه ونوته"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setOn(!on);
            const said = await setStoryAlert(friendId, !on);
            setOn(said.on);
            if (!said.error) setToast({ on: said.on, at: Date.now() });
          })
        }
        className={`flex shrink-0 items-center justify-center border disabled:opacity-60 ${disc ? "h-10 w-10 rounded-full" : "w-[46px] rounded-xl"}`}
        style={{
          height: disc ? 40 : 46,
          borderColor: on ? "var(--color-clay)" : "var(--color-line)",
          background: on ? "var(--color-clay)" : "var(--color-card)",
          color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
        }}
      >
        <BellPlusIcon size={18} on={on} />
      </button>
      {toast ? (
        <GlassToast key={toast.at} avatar={avatar} onDone={() => setToast(null)}>
          {toast.on ? "تم تفعيل إشعارات القصص والنوت لـ" : "تم إيقاف إشعارات القصص والنوت لـ"}
          <b dir="auto" className="font-extrabold">{name}</b>
        </GlassToast>
      ) : null}
    </>
  );
}

/**
 * سطرٌ زجاجيّ فوق الشريط السفليّ ثمّ يذهب — نسخةُ `SwitchToast` في الجوّال (القاعدة ٣٢٠).
 * على جسد الصفحة (القاعدة ٩٢)، ومثبّتٌ بـ`.shell-fixed` فلا يطير خارج الهيكل (القاعدة ٨).
 */
function GlassToast({ avatar, children, onDone }: { avatar: React.ReactNode; children: React.ReactNode; onDone: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const hide = setTimeout(() => setShown(false), 2000);
    const done = setTimeout(onDone, 2300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="status" className="shell-fixed z-[60] flex justify-center px-4" style={{ paddingBottom: 96 }}>
      <div
        className="flex max-w-[86%] items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13.5px] font-semibold text-white"
        style={{
          background: "rgba(20,24,28,.88)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 4px 10px rgba(0,0,0,.25)",
          opacity: shown ? 1 : 0,
          transform: shown ? "none" : "translateY(16px)",
          transition: "opacity 220ms ease-out, transform 220ms cubic-bezier(.2,.8,.3,1)",
        }}
      >
        {avatar}
        <span className="truncate">{children}</span>
      </div>
    </div>,
    document.body,
  );
}
