"use client";

import { useState, useTransition } from "react";
import { buyItem, equip, unequip } from "@/app/actions";
import { coinText, ar } from "@/lib/format";
import { LockIcon, CheckIcon } from "@/components/icons";
import { itemPaint } from "@/components/ui";

/**
 * شبكة أصناف المتجر.
 *
 * المعاينة تتبع نوع الصنف: الإطار حلقةٌ حول وجه، والثيم مساحةُ لون،
 * والتميمة قطعةٌ صغيرة. وما تملكه يُلبَس من هنا كما يُلبَس من ملفك.
 */
export type Item = {
  id: string;
  kind: "FRAME" | "BACKGROUND" | "THEME" | "CHARM";
  name: string;
  priceCoins: number;
  spec: string;
  plusOnly: boolean;
  earnedAfterDays: number | null;
  limited: boolean;
  /** صورة الصنف — الثيم والتميمة صورتان، والإطار تدرّج. */
  mediaId: string | null;
};

function Preview({ item }: { item: Item }) {
  if (item.kind === "FRAME") {
    return (
      <span
        className="rounded-full"
        style={{ width: 62, height: 62, ...itemPaint(item), padding: 3 }}
      >
        <span className="block h-full w-full rounded-full" style={{ background: "var(--color-card)" }} />
      </span>
    );
  }

  if (item.kind === "CHARM") {
    return (
      <span
        style={{ width: 52, height: 52, ...itemPaint(item, "contain"), marginBlock: 5 }}
      />
    );
  }

  return (
    <span className="w-full rounded-xl" style={{ height: 62, ...itemPaint(item) }} />
  );
}

export function StoreGrid({
  items,
  owned,
  isPlus,
  credit,
  daysHere,
  equipped,
}: {
  items: Item[];
  owned: string[];
  isPlus: boolean;
  credit: number;
  daysHere: number;
  /** ما هو ملبوس الآن: إطارٌ وثيمٌ وتميمة. */
  equipped: { frame: string | null; theme: string | null; charm: string | null };
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ownedSet = new Set(owned);
  const price = (item: Item) =>
    isPlus ? Math.round(item.priceCoins * 0.8) : item.priceCoins;

  const wornId = (item: Item) =>
    item.kind === "FRAME" ? equipped.frame : item.kind === "CHARM" ? equipped.charm : equipped.theme;

  function act(item: Item) {
    setError(null);

    if (ownedSet.has(item.id)) {
      if (wornId(item) === item.id) {
        start(() =>
          void unequip(
            item.kind === "FRAME" ? "FRAME" : item.kind === "CHARM" ? "CHARM" : "BACKGROUND",
          ),
        );
        return;
      }
      start(() => void equip(item.id));
      return;
    }

    if (item.plusOnly && !isPlus) return setError("هذا الصنف لمشتركي آثار+");
    if (item.earnedAfterDays !== null && daysHere < item.earnedAfterDays) {
      return setError(
        `يُكتسب بعد ${ar(item.earnedAfterDays)} يوم — باقي ${ar(item.earnedAfterDays - daysHere)}`,
      );
    }
    if (credit < price(item)) return setError("رصيدك لا يكفي");
    start(() => void buyItem(item.id));
  }

  if (items.length === 0) {
    return (
      <p className="mb-6 rounded-2xl border border-line bg-card px-4 py-8 text-center text-[12.5px] text-muted">
        ما فيه أصناف هنا بعد.
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-xl bg-clay-soft px-4 py-3 text-[12.5px] font-medium text-clay">
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {items.map((item) => {
          const have = ownedSet.has(item.id);
          const worn = have && wornId(item) === item.id;
          const locked =
            (item.plusOnly && !isPlus) ||
            (item.earnedAfterDays !== null && daysHere < item.earnedAfterDays);

          return (
            <button
              key={item.id}
              type="button"
              disabled={pending}
              onClick={() => act(item)}
              className="relative flex flex-col items-center gap-2.5 rounded-2xl border bg-card px-2 pb-3 pt-3.5 disabled:opacity-60"
              style={{
                borderColor: worn ? "var(--color-clay)" : "var(--color-line)",
                borderWidth: worn ? 1.5 : 1,
              }}
            >
              {item.earnedAfterDays !== null ? (
                <span
                  className="absolute -top-2 right-1/2 translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold text-card"
                  style={{ background: "var(--color-gold)" }}
                >
                  يُكتسب
                </span>
              ) : item.limited ? (
                <span
                  className="absolute -top-2 right-1/2 translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold"
                  style={{ background: "var(--color-live)", color: "#fff" }}
                >
                  محدودة
                </span>
              ) : null}

              <Preview item={item} />

              <span className="text-[11.5px] font-medium">{item.name}</span>

              {worn ? (
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-clay">
                  <CheckIcon size={12} /> ملبوس
                </span>
              ) : have ? (
                <span className="text-[10.5px] font-semibold text-clay">
                  ألبسه
                </span>
              ) : locked ? (
                <span className="flex items-center gap-1 text-[10.5px] text-faint">
                  <LockIcon size={11} />
                  {item.earnedAfterDays !== null ? `${ar(item.earnedAfterDays)} يوم` : "آثار+"}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-clay">{coinText(price(item))}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
