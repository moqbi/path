"use client";

import { useState, useTransition } from "react";
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
  children,
}: {
  momentId: string;
  text: string;
  required: boolean;
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
      >
        {children}
      </SwipeRow>
      {open ? <EditSheet target={{ kind: "moment", id: momentId, text, required }} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** جرسُ ملفّ الصديق (القاعدة ٣١٩): يُضيء بلون اللمسة مفعّلاً. */
export function AlertBell({ friendId, name, initial }: { friendId: string; name: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
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
        })
      }
      className="flex w-[46px] shrink-0 items-center justify-center rounded-xl border disabled:opacity-60"
      style={{
        height: 46,
        borderColor: on ? "var(--color-clay)" : "var(--color-line)",
        background: on ? "var(--color-clay)" : "var(--color-card)",
        color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
      }}
    >
      <BellPlusIcon size={18} on={on} />
    </button>
  );
}
