"use client";

import { useState, useTransition } from "react";
import { buyItem, equip } from "@/app/actions";
import { riyals, ar } from "@/lib/format";
import { LockIcon, CheckIcon } from "@/components/icons";

type Item = {
  id: string;
  kind: "FRAME" | "BACKGROUND";
  name: string;
  priceHalalas: number;
  spec: string;
  plusOnly: boolean;
  earnedAfterDays: number | null;
};

export function StoreGrid({
  items,
  owned,
  isPlus,
  credit,
  daysHere,
}: {
  items: Item[];
  owned: string[];
  isPlus: boolean;
  credit: number;
  daysHere: number;
  equippedFrame: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ownedSet = new Set(owned);
  const frames = items.filter((i) => i.kind === "FRAME");
  const backgrounds = items.filter((i) => i.kind === "BACKGROUND");

  const price = (item: Item) =>
    isPlus ? Math.round(item.priceHalalas * 0.8) : item.priceHalalas;

  function act(item: Item) {
    setError(null);
    if (ownedSet.has(item.id)) {
      start(() => void equip(item.id));
      return;
    }
    if (item.plusOnly && !isPlus) return setError("هذا الصنف لمشتركي أثر+");
    if (item.earnedAfterDays !== null && daysHere < item.earnedAfterDays) {
      return setError(`يُكتسب بعد ${ar(item.earnedAfterDays)} يوم — باقي ${ar(item.earnedAfterDays - daysHere)}`);
    }
    if (credit < price(item)) return setError("رصيدك لا يكفي");
    start(() => void buyItem(item.id));
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-xl bg-clay-soft px-4 py-3 text-[12.5px] font-medium text-clay">
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {frames.map((item) => {
          const have = ownedSet.has(item.id);
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
                borderColor: have ? "var(--color-clay)" : "var(--color-line)",
                borderWidth: have ? 1.5 : 1,
              }}
            >
              {item.earnedAfterDays !== null ? (
                <span
                  className="absolute -top-2 right-1/2 translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9.5px] font-semibold text-card"
                  style={{ background: "var(--color-gold)" }}
                >
                  يُكتسب
                </span>
              ) : null}

              <span
                className="rounded-full"
                style={{ width: 62, height: 62, background: item.spec, padding: 3 }}
              >
                <span className="block h-full w-full rounded-full" style={{ background: "#e2dad0" }} />
              </span>

              <span className="text-[11.5px] font-medium">{item.name}</span>

              {have ? (
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-clay">
                  <CheckIcon size={12} /> ألبسه
                </span>
              ) : locked ? (
                <span className="flex items-center gap-1 text-[10.5px] text-faint">
                  <LockIcon size={11} />
                  {item.earnedAfterDays !== null ? `${ar(item.earnedAfterDays)} يوم` : "أثر+"}
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-clay">{riyals(price(item))}</span>
              )}
            </button>
          );
        })}
      </div>

      <h2 className="mb-1 text-[14.5px] font-semibold">خلفيات متحركة</h2>
      <p className="mb-3.5 text-[11.5px] text-muted">حركة خفيفة، تتوقف عند التمرير</p>

      <div className="mb-5 grid grid-cols-2 gap-3">
        {backgrounds.map((item) => {
          const have = ownedSet.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={pending}
              onClick={() => act(item)}
              className="overflow-hidden rounded-2xl border bg-card text-right disabled:opacity-60"
              style={{
                borderColor: have ? "var(--color-clay)" : "var(--color-line)",
                borderWidth: have ? 1.5 : 1,
              }}
            >
              <span className="block" style={{ height: 96, background: item.spec }} />
              <span className="flex items-center justify-between px-3 py-2.5">
                <span className="text-[12px] font-medium">{item.name}</span>
                <span className="text-[11px] font-semibold text-clay">
                  {have ? "ألبسها" : riyals(price(item))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
