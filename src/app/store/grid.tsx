"use client";

import { useState, useTransition } from "react";
import { buyNow, equip, unequip } from "@/app/actions";
import { coinText, ar } from "@/lib/format";
import { LockIcon, CheckIcon } from "@/components/icons";
import { itemPaint } from "@/components/ui";
import { Portal, Sheet } from "@/components/sheet";

/**
 * شبكة أصناف المتجر.
 *
 * المعاينة تتبع نوع الصنف: الإطار حلقةٌ حول وجه، والثيم مساحةُ لون،
 * والتميمة قطعةٌ صغيرة. وما تملكه يُلبَس من هنا كما يُلبَس من ملفك.
 */
/** اسمُ النوع كما يُقرأ في بطاقته. */
const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  THEME: "ثيم",
  CHARM: "تميمة",
  BACKGROUND: "ثيم",
  BUNDLE: "باقة",
};

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
  const [error, setError] = useState<string | null>(null);
  /* البطاقة المفتوحة: الضغطة تعرض لا تشتري (القاعدة ٩٣ب). */
  const [open, setOpen] = useState<Item | null>(null);

  const ownedSet = new Set(owned);
  const price = (item: Item) =>
    isPlus ? Math.round(item.priceCoins * 0.8) : item.priceCoins;

  const wornId = (item: Item) =>
    item.kind === "FRAME" ? equipped.frame : item.kind === "CHARM" ? equipped.charm : equipped.theme;

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

      {open ? (
        <ItemCard
          item={open}
          owned={ownedSet.has(open.id)}
          worn={wornId(open) === open.id}
          price={price(open)}
          credit={credit}
          isPlus={isPlus}
          daysHere={daysHere}
          onClose={() => setOpen(null)}
        />
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
              onClick={() => {
                setError(null);
                setOpen(item);
              }}
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

/**
 * بطاقة الصنف: تُفتح بضغطة، وفيها عرضٌ وشراء.
 *
 * والضغطة كانت **تشتري أو تُلبِس في الحال**: صنفٌ بثمنٍ يذهب من الرصيد
 * بلمسةٍ واحدة بلا سؤال، وصنفٌ مملوكٌ يُلبَس بلا أن يُرى كبيراً. فصارت
 * الضغطة تفتح البطاقة، والفعلُ خلف زرٍّ يقول ما يفعل.
 *
 * و«عرض» يفتح الصورة كاملةً على جسد الصفحة: ما يُشترى يُرى أوّلاً —
 * رسمُ إطارٍ في مربّعٍ ٦٢ بكسلاً لا يُحكم عليه.
 *
 * والنتيجة تُقال نافذةً لا سطراً في الطرف: «تم الشراء» أو «رصيدك لا
 * يكفي» ومعها الطريق إلى الشحن.
 */
function ItemCard({
  item,
  owned,
  worn,
  price,
  credit,
  isPlus,
  daysHere,
  onClose,
}: {
  item: Item;
  owned: boolean;
  worn: boolean;
  price: number;
  credit: number;
  isPlus: boolean;
  daysHere: number;
  onClose: () => void;
}) {
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [showing, setShowing] = useState(false);
  const [pending, start] = useTransition();

  const earned = item.earnedAfterDays !== null;
  const locked =
    (item.plusOnly && !isPlus) || (earned && daysHere < (item.earnedAfterDays ?? 0));
  const bundle = item.kind === "BUNDLE";
  const poor = credit < price;

  const wear = () => {
    if (worn) {
      start(() =>
        void unequip(item.kind === "FRAME" ? "FRAME" : item.kind === "CHARM" ? "CHARM" : "BACKGROUND"),
      );
    } else {
      start(() => void equip(item.id));
    }
    onClose();
  };

  return (
    <>
      <Sheet onClose={onClose} title={KIND_LABEL[item.kind] ?? "صنف"}>
        <div className="flex items-center gap-4 px-1 py-2">
          {/*
            حاويةٌ `flex` لا `span` عاريةً: `Preview` يردّ عنصراً سطرياً
            (`span`)، فمقاسه لا يُطبَّق إلا إذا صار عنصرَ `flex` —
            وفي الشبكة يصير كذلك بحكم بطاقته، وهنا كان يختفي.
          */}
          <span className="flex h-20 w-20 shrink-0 items-center justify-center">
            <Preview item={item} />
          </span>
          <div className="min-w-0 grow">
            <p dir="auto" className="text-[16px] font-bold">
              {item.name}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {KIND_LABEL[item.kind] ?? "صنف"}
              {item.plusOnly ? " · لمشتركي آثار+" : ""}
              {bundle ? ` · ${ar(item.holds?.length ?? 0)} أصناف` : ""}
            </p>
            <p className="mt-1 text-[14px] font-semibold text-clay-ink">
              {earned ? `يُكتسب بعد ${ar(item.earnedAfterDays ?? 0)} يوم` : coinText(price)}
            </p>
          </div>
        </div>

        {/* خياران: عرضٌ يكبّر الرسم، وشراءٌ يفعل. */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setShowing(true)}
            className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-card px-4 text-[13.5px] font-semibold text-ink-2"
            style={{ height: 48 }}
          >
            عرض
          </button>

          {owned ? (
            bundle ? (
              <p
                className="flex grow items-center justify-center rounded-xl text-[13.5px] font-semibold"
                style={{ height: 48, background: "var(--color-chip)", color: "var(--color-ink-2)" }}
              >
                صارت لك — ما فيها في إكسسواراتك
              </p>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={wear}
                className="grow rounded-xl text-[14px] font-bold disabled:opacity-60"
                style={{
                  height: 48,
                  background: worn ? "var(--color-chip)" : "var(--color-clay)",
                  color: worn ? "var(--color-ink-2)" : "var(--color-on-brand)",
                }}
              >
                {worn ? "انزعه" : "ألبسه"}
              </button>
            )
          ) : locked ? (
            <p
              className="flex grow items-center justify-center rounded-xl text-[13px] font-semibold"
              style={{ height: 48, background: "var(--color-chip)", color: "var(--color-muted)" }}
            >
              {item.plusOnly && !isPlus
                ? "هذا الصنف لمشتركي آثار+"
                : `باقي ${ar((item.earnedAfterDays ?? 0) - daysHere)} يوم`}
            </p>
          ) : earned ? (
            <p
              className="flex grow items-center justify-center rounded-xl text-[13px] font-semibold"
              style={{ height: 48, background: "var(--color-chip)", color: "var(--color-ink-2)" }}
            >
              صار لك — البسه من إكسسواراتك
            </p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setSaid(await buyNow(item.id));
                })
              }
              className="grow rounded-xl text-[14px] font-bold disabled:opacity-60"
              style={{ height: 48, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
            >
              {pending ? "نشتري…" : `اشترِ بـ${coinText(price)}`}
            </button>
          )}
        </div>

        {/*
          والرصيدُ يُقال قبل الضغط لا بعده: من يرى «لا يكفي» وهو ينظر
          إلى السعر لا يضغط ليُقال له.
        */}
        {!owned && !locked && !earned && poor ? (
          <p className="mt-2 text-center text-[11.5px] text-muted">
            رصيدك {coinText(credit)} — ينقصك {coinText(price - credit)}
          </p>
        ) : null}
      </Sheet>

      {/* «عرض»: الرسم كاملاً على جسد الصفحة. */}
      {showing ? (
        <Portal>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setShowing(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-8"
            style={{ background: "rgba(14,26,36,.88)" }}
          >
            {item.mediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${item.mediaId}`}
                alt={item.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span
                className="rounded-3xl"
                style={{ width: 260, height: 260, ...itemPaint(item) }}
              />
            )}
          </button>
        </Portal>
      ) : null}

      {/* والنتيجة نافذةٌ تُقرأ، لا سطرٌ في طرف الشاشة. */}
      {said ? (
        <Portal>
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center px-8"
            style={{ background: "rgba(14,26,36,.5)" }}
          >
            <div
              className="w-full max-w-[300px] rounded-3xl p-6 text-center"
              style={{ background: "var(--color-card)" }}
            >
              <p
                className="text-[15px] font-bold"
                style={{ color: said.ok ? "var(--color-clay-ink)" : "var(--color-live)" }}
              >
                {said.ok ? "تمّ الشراء" : said.error}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                {said.ok
                  ? "صار لك — البسه من إكسسواراتك في «أنا»."
                  : "اشحن نقاطك من زرّ الرصيد في أعلى المتجر ثم أعِد المحاولة."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSaid(null);
                  onClose();
                }}
                className="mt-4 w-full rounded-xl text-[13.5px] font-bold"
                style={{ height: 46, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
              >
                تمام
              </button>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
