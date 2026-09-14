"use client";

import { useEffect, useState, useTransition } from "react";
import { giftItem } from "@/app/actions";
import { CloseIcon, SparkIcon, GiftIcon } from "@/components/icons";
import { itemPaint } from "@/components/ui";
import { ar, riyals } from "@/lib/format";

/**
 * الإهداء: المتجر يُفتح في نافذة فوق ملف صاحبك، لا في صفحة تُغادر مكانك.
 *
 * تختار الإطار فيُخصم من رصيدك ويصل إليه في لحظته — بلا سلّة ولا خطوات.
 * وما يملكه أصلاً يُعرض مطفأً: لا نبيعك ما لن ينفعه.
 */
type Item = {
  id: string;
  name: string;
  spec: string;
  priceHalalas: number;
  plusOnly: boolean;
  earnedAfterDays: number | null;
  mediaId: string | null;
};

export function GiftButton({
  items,
  owned,
  friendId,
  friendName,
  friendIsPlus,
  credit,
  isPlus,
}: {
  items: Item[];
  owned: string[];
  friendId: string;
  friendName: string;
  friendIsPlus: boolean;
  credit: number;
  isPlus: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ ok?: string; error?: string } | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
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

  const has = new Set([...owned, ...sent]);
  const price = (item: Item) =>
    isPlus ? Math.round(item.priceHalalas * 0.8) : item.priceHalalas;

  function send(item: Item) {
    setNote(null);
    setBusy(item.id);
    start(async () => {
      const result = await giftItem(item.id, friendId);
      setBusy(null);
      setNote(result);
      if (result.ok) setSent((list) => [...list, item.id]);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-[13px] font-semibold text-ink-2"
        style={{ height: 42 }}
      >
        <GiftIcon size={16} />
        إهداء
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-label="إهداء">
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            style={{ background: "rgba(14,26,36,.55)", animation: "athr-veil 220ms ease both" }}
          />

          <div
            className="relative w-full rounded-t-3xl bg-card px-5 pb-8 pt-4"
            style={{ animation: "athr-sheet 320ms cubic-bezier(.18,1.2,.4,1) both", maxHeight: "82vh", overflowY: "auto" }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[15.5px] font-bold">أهدِ {friendName}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  يُخصم من رصيدك ويصله في لحظته
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

            <p
              className="mb-3 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold"
              style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)", color: "var(--color-gold-ink)" }}
            >
              <SparkIcon size={14} />
              رصيدك {riyals(credit)}
            </p>

            {note?.error ? (
              <p role="alert" className="mb-3 rounded-xl bg-clay-soft px-4 py-3 text-[12.5px] font-medium text-clay">
                {note.error}
              </p>
            ) : null}
            {note?.ok ? (
              <p role="status" className="mb-3 rounded-xl px-4 py-3 text-[12.5px] font-medium"
                 style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}>
                {note.ok}
              </p>
            ) : null}

            <div className="grid grid-cols-3 gap-3 pb-2">
              {items.map((item) => {
                const already = has.has(item.id);
                const locked =
                  item.earnedAfterDays !== null || (item.plusOnly && !friendIsPlus);

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={already || locked || busy !== null}
                    onClick={() => send(item)}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-paper px-2 pb-3 pt-3.5 disabled:opacity-55"
                  >
                    <span
                      className="rounded-full"
                      style={{
                        width: 58,
                        height: 58,
                        ...itemPaint(item),
                        padding: item.mediaId ? 0 : 3,
                      }}
                    >
                      {item.mediaId ? null : (
                        <span
                          className="block h-full w-full rounded-full"
                          style={{ background: "var(--color-card)" }}
                        />
                      )}
                    </span>
                    <span className="text-[11.5px] font-medium">{item.name}</span>
                    <span className="text-[10.5px] font-semibold text-clay">
                      {already
                        ? "عنده"
                        : item.earnedAfterDays !== null
                          ? `يُكتسب بـ${ar(item.earnedAfterDays)} يوم`
                          : item.plusOnly && !friendIsPlus
                            ? "لمشتركي أثر+"
                            : busy === item.id
                              ? "…"
                              : riyals(price(item))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
