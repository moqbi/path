"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { equip, unequip } from "@/app/actions";
import { CheckIcon, CloseIcon } from "@/components/icons";

/**
 * الإكسسوارات: ما تملكه يُلبَس من ملفك، لا من المتجر.
 *
 * المتجر يبيع، والملف يُلبِس — هكذا يعرف صاحبه أين يجد ما اشتراه أو ما
 * أُهدي إليه. والتمائم حين تأتي تجلس هنا بجانب الإطارات.
 */
export type Owned = {
  id: string;
  name: string;
  spec: string;
  kind: "FRAME" | "BACKGROUND";
  giftedBy: string | null;
};

export function Accessories({
  owned,
  equippedFrame,
}: {
  owned: Owned[];
  equippedFrame: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const frames = owned.filter((item) => item.kind === "FRAME");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-card px-3.5 text-[13.5px] font-semibold text-ink-2"
        style={{ height: 46 }}
      >
        إكسسواراتي
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-label="إكسسواراتي">
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            style={{ background: "rgba(14,26,36,.55)", animation: "athr-veil 220ms ease both" }}
          />

          <div
            className="relative w-full rounded-t-3xl bg-card px-5 pb-8 pt-4"
            style={{
              animation: "athr-sheet 320ms cubic-bezier(.18,1.2,.4,1) both",
              maxHeight: "82vh",
              overflowY: "auto",
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[15.5px] font-bold">إكسسواراتي</p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  ما اشتريته وما أُهدي إليك — اضغط لتلبسه
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <p className="mb-2 text-[12px] font-semibold text-muted">الإطارات</p>

            {frames.length === 0 ? (
              <div className="rounded-2xl border border-line bg-paper px-4 py-7 text-center">
                <p className="mb-2 text-[13px] text-muted">ما عندك إطارات بعد.</p>
                <Link href="/store" className="text-[12.5px] font-bold text-clay">
                  افتح المتجر
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {frames.map((item) => {
                  const on = equippedFrame === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        start(() => void (on ? unequip("FRAME") : equip(item.id)))
                      }
                      className="flex flex-col items-center gap-2 rounded-2xl border bg-paper px-2 pb-3 pt-3.5"
                      style={{
                        borderColor: on ? "var(--color-clay)" : "var(--color-line)",
                        borderWidth: on ? 1.5 : 1,
                      }}
                    >
                      <span
                        className="rounded-full"
                        style={{ width: 58, height: 58, background: item.spec, padding: 3 }}
                      >
                        <span
                          className="block h-full w-full rounded-full"
                          style={{ background: "var(--color-card)" }}
                        />
                      </span>
                      <span className="text-[11.5px] font-medium">{item.name}</span>
                      {item.giftedBy ? (
                        <span className="text-[10px] text-gold-ink">هدية من {item.giftedBy}</span>
                      ) : null}
                      <span
                        className="flex items-center gap-1 text-[10.5px] font-semibold"
                        style={{ color: on ? "var(--color-clay)" : "var(--color-muted)" }}
                      >
                        {on ? (
                          <>
                            <CheckIcon size={12} /> ملبوس — انزعه
                          </>
                        ) : (
                          "ألبسه"
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="mt-4 rounded-xl bg-paper px-3.5 py-3 text-[11.5px] text-muted">
              التمائم قريباً — ستجلس هنا بجانب إطاراتك.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
