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
  kind: string;
  name: string;
  priceCoins: number;
  spec: string;
  plusOnly: boolean;
  earnedAfterDays: number | null;
  limited: boolean;
  /** صورة الصنف — الثيم والتميمة صورتان، والإطار تدرّج. */
  mediaId: string | null;
  /**
   * ما تحمله الحزمة من أصناف — فارغٌ لما ليس حزمة.
   *
   * وبطاقةُ الحزمة ترسمه وتعدّه: باقةٌ تُشترى على غير علمٍ بما فيها
   * صندوقٌ عشوائيّ بلا عشوائية، والقاعدة ٦ تمنع الصناديق.
   */
  holds?: { id: string; name: string; spec: string; mediaId: string | null; kind: string }[];
};

function Preview({ item }: { item: Item }) {
  /*
    الحزمة تُعرض بما فيها: ثلاثةُ رسومٍ متداخلة وعددُ ما بقي — فما يُشترى
    يُرى قبل شرائه.
  */
  if (item.kind === "BUNDLE") {
    const inside = item.holds ?? [];
    const shown = inside.slice(0, 3);
    return (
      <span className="flex h-[62px] items-center justify-center">
        {shown.length === 0 ? (
          <span
            className="rounded-xl"
            style={{ width: 54, height: 54, background: "var(--color-chip)" }}
          />
        ) : (
          shown.map((one, index) => (
            <span
              key={one.id}
              className="rounded-xl border"
              style={{
                width: 44,
                height: 44,
                marginInlineStart: index === 0 ? 0 : -14,
                borderColor: "var(--color-card)",
                borderWidth: 2,
                ...itemPaint(one, one.kind === "CHARM" ? "contain" : "cover"),
              }}
            />
          ))
        )}
        {inside.length > shown.length ? (
          <span
            className="flex items-center justify-center rounded-xl text-[11px] font-bold"
            style={{
              width: 44,
              height: 44,
              marginInlineStart: -14,
              background: "var(--color-chip)",
              color: "var(--color-ink-2)",
              border: "2px solid var(--color-card)",
            }}
          >
            +{ar(inside.length - shown.length)}
          </span>
        ) : null}
      </span>
    );
  }

  if (item.kind === "FRAME") {
    /*
      الإطار المصوَّر يُرسم **فوق** قرصٍ محايد لا خلفه — كما يُرى على
      الوجه تماماً (`Avatar`). ودهنُه خلفيةً والقرصُ فوقه كان يُخفي
      حافّته الداخلية وزخرفتَها، فتختلف بطاقتُه في المتجر عن هيئته على
      الصورة.
    */
    if (item.mediaId) {
      return (
        <span className="relative block" style={{ width: 62, height: 62 }}>
          <span
            className="absolute rounded-full"
            style={{ inset: 5, background: "var(--color-chip)" }}
          />
          <span className="absolute inset-0 block" style={itemPaint(item, "contain")} />
        </span>
      );
    }

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

    // والحزمة لا تُلبَس: ما فيها يُلبَس من الملف أو من بطاقته هنا.
    if (item.kind === "BUNDLE" && ownedSet.has(item.id)) return;

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

              {item.kind === "BUNDLE" && have ? (
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-clay">
                  <CheckIcon size={12} /> صارت لك
                </span>
              ) : item.kind === "BUNDLE" ? (
                <>
                  <span className="text-[10px] text-faint">
                    {ar(item.holds?.length ?? 0)} أصناف
                  </span>
                  <span className="text-[11px] font-semibold text-clay">
                    {coinText(price(item))}
                  </span>
                </>
              ) : worn ? (
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
