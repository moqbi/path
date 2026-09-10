"use client";

import { useEffect, useRef, useState } from "react";
import { editMessage } from "@/app/actions";
import { Ticks, receiptOf } from "@/components/receipt";
import { timeOfDay } from "@/lib/format";

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
            )}

            <span className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-faint">
              {timeOfDay(line.createdAt)}
              {line.editedAt && <span>معدّلة</span>}
              {mine && <Ticks state={receiptOf(line)} />}
              {mine && shown === line.id && !open && (
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
