"use client";

import { addToBundle, dropFromBundle } from "@/app/actions";
import { itemPaint } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { coinText } from "@/lib/format";

type Slim = { id: string; name: string; kind: string; spec: string; mediaId: string | null; priceCoins: number };

const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  THEME: "ثيم",
  CHARM: "تميمة",
  BACKGROUND: "خلفية",
};

/**
 * ما تحمله الحزمة.
 *
 * الحزمة صنفٌ لا يُلبَس: شراؤها يملّك ما بداخلها دفعةً واحدة، وسعرُها
 * سعرُها هي — لا مجموعَ ما فيها. فالمجموع مكتوبٌ هنا ليعرف المشرف كم
 * يُعطي.
 *
 * ولا تحمل حزمةٌ حزمةً: عشٌّ يُحسب بلا قاع.
 */
export function BundleItems({
  bundleId,
  holds,
  all,
}: {
  bundleId: string;
  holds: Slim[];
  /** كل الأصناف التي يصلح أن تُضاف — بلا الحزم. */
  all: Slim[];
}) {
  const inside = new Set(holds.map((one) => one.id));
  const left = all.filter((one) => one.id !== bundleId && !inside.has(one.id));
  const sum = holds.reduce((total, one) => total + one.priceCoins, 0);

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 flex items-center justify-between text-[12px] font-semibold text-muted">
        ما في الحزمة
        {holds.length > 0 ? (
          <span className="text-[11px] font-normal text-faint">
            مجموع أسعارها {coinText(sum)}
          </span>
        ) : null}
      </p>

      {holds.length === 0 ? (
        <p className="mb-2 rounded-xl border border-line p-3 text-center text-[11.5px] text-muted">
          حزمةٌ فارغة لا تُشترى بشيء. أضِف إليها أصنافاً.
        </p>
      ) : (
        <div className="mb-2 flex flex-col gap-1.5">
          {holds.map((one) => (
            <div key={one.id} className="flex items-center gap-2.5 rounded-xl border border-line p-2">
              <span
                className="h-9 w-9 shrink-0 rounded-lg"
                style={itemPaint(one, one.kind === "CHARM" ? "contain" : "cover")}
              />
              <span className="min-w-0 grow truncate text-[12.5px] font-semibold">{one.name}</span>
              <span className="shrink-0 text-[11px] text-faint">{KIND_LABEL[one.kind] ?? one.kind}</span>
              <form action={dropFromBundle.bind(null, bundleId, one.id)}>
                <button
                  type="submit"
                  aria-label={`أخرج ${one.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line"
                  style={{ color: "var(--color-live)" }}
                >
                  <CloseIcon size={14} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {left.length > 0 ? (
        <form action={addToBundle.bind(null, bundleId)} className="flex gap-2">
          <select
            name="itemId"
            defaultValue=""
            className="h-10 min-w-0 grow rounded-xl border border-line bg-paper px-2 text-[12px] text-ink outline-none"
          >
            <option value="" disabled>
              اختر صنفاً…
            </option>
            {left.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name} — {KIND_LABEL[one.kind] ?? one.kind}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            أضِف
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-faint">لا أصناف أخرى تُضاف.</p>
      )}

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        سعرُ الحزمة سعرُها هي لا مجموعَ ما فيها — وهذا هو مكسبُ من يشتريها.
        ومن اشتراها وهو يملك بعضها لا يُخصَم منه ثانيةً.
      </p>
    </div>
  );
}
