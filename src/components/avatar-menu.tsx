"use client";

import { ZoomImage } from "@/components/zoom-image";
import { useEffect, useState, useTransition } from "react";
import { buyNow } from "@/app/actions";
import { Avatar, itemPaint, TagPill, type Charm, type Frame } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { Portal, Sheet } from "@/components/sheet";
import { coinText } from "@/lib/format";
import { BASE } from "@/lib/base";

/** صنفٌ يلبسه صاحب الملف — إطارٌ أو تشارم — كما يُعرض في المتجر. */
export type WornItem = {
  id: string;
  name: string;
  kind: string;
  spec: string;
  mediaId: string | null;
  priceCoins: number;
  plusOnly: boolean;
  /** يُكتسب بالأيّام لا يُشترى — `null` لما يُشترى. */
  earnedAfterDays?: number | null;
  /** مُدَدُ الشراء (القاعدة ٤٤ج): صنفٌ بمُددٍ سعرُه المفرد صفر. */
  plans?: { days: number; priceCoins: number }[];
  /** تشارمٌ حصريٌّ لوسم (القاعدة ٤٧٩) — لا يُباع، ويُقال لمن رآه لمن هو. */
  exclusiveTag?: { name: string; bg: string; fg: string } | null;
} | null;

const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  CHARM: "تشارم",
  THEME: "ثيم",
  BACKGROUND: "خلفية",
};

/**
 * صورة العرض تُضغط فتُسأل: أيّها تريد؟
 *
 * الصورة نفسها، أو الصنف الذي يلبسه صاحبها — فالإطار والتشارم يُريان على
 * الناس قبل أن يُريا في المتجر، ومن أعجبه ما رأى يعرف اسمه وسعره من
 * مكانه. وما لا يلبسه لا يُعرض سطراً فارغاً.
 */
export function AvatarMenu({
  name,
  size,
  mediaId,
  frame,
  charm,
  frameItem,
  charmItem,
  owned = [],
}: {
  name: string;
  size: number;
  mediaId: string | null;
  frame?: Frame;
  charm?: Charm;
  frameItem: WornItem;
  charmItem: WornItem;
  /** ما تملكه أنت من الأصناف — فلا يُعرض شراءُ ما اشتريته. */
  owned?: string[];
}) {
  const [view, setView] = useState<"none" | "menu" | "photo" | "frame" | "charm">("none");
  const close = () => setView("none");

  return (
    <>
      <button
        type="button"
        aria-label={`صورة ${name}`}
        onClick={() => setView("menu")}
        className="block rounded-full"
      >
        <Avatar name={name} size={size} frame={frame} charm={charm} mediaId={mediaId} />
      </button>

      {view === "menu" ? (
        <Sheet onClose={close} title={name}>
          <Row label="عرض صورة الملف الشخصي" onClick={() => setView("photo")} />
          {charmItem ? (
            <Row
              label="عرض معلومات التشارم"
              hint={charmItem.name}
              art={charmItem}
              onClick={() => setView("charm")}
            />
          ) : null}
          {frameItem ? (
            <Row
              label="عرض معلومات الإطار"
              hint={frameItem.name}
              art={frameItem}
              onClick={() => setView("frame")}
            />
          ) : null}
        </Sheet>
      ) : null}

      {view === "photo" ? (
        <Portal>
        <div
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(8,14,20,.94)", animation: "athr-veil 160ms ease both" }}
        >
          {mediaId ? (
            <ZoomImage src={`${BASE}/api/media/${mediaId}`} onClose={close} />
          ) : (
            <Avatar name={name} size={220} />
          )}
          <button
            type="button"
            aria-label="إغلاق"
            onClick={close}
            className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        </Portal>
      ) : null}

      {view === "charm" && charmItem ? (
        <ItemSheet item={charmItem} owned={owned.includes(charmItem.id)} onClose={close} />
      ) : null}
      {view === "frame" && frameItem ? (
        <ItemSheet item={frameItem} owned={owned.includes(frameItem.id)} onClose={close} />
      ) : null}
    </>
  );
}

/**
 * بطاقة الصنف: شكله واسمه وسعره — ويُشترى من مكانه.
 *
 * «افتحه في المتجر» كان يرمي صاحبه إلى واجهةٍ فيها عشرات الأصناف ليبحث
 * عمّا رآه قبل لحظة. الشراء هنا، ثم يُلبَس من الإكسسوارات.
 */
function ItemSheet({
  item,
  owned,
  onClose,
}: {
  item: NonNullable<WornItem>;
  owned: boolean;
  onClose: () => void;
}) {
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  /*
    صنفٌ بمُددٍ سعرُه المفرد صفر (القاعدة ٤٤ج): كان يُقرأ «يُكتسب بالوقت» ويُشترى بلا
    مدّةٍ فيردّه الخادم «حدّد المدّة». والويبُ لا يبيع ما له مُدَد — يُقال «من التطبيق».
  */
  const plans = item.plans ?? [];
  const timed = plans.length > 0;
  const free = !timed && (item.earnedAfterDays != null || item.priceCoins === 0);

  return (
    <Sheet onClose={onClose} title={KIND_LABEL[item.kind] ?? "صنف"}>
      <div className="flex items-center gap-4 px-1 py-2">
        <span
          className="h-20 w-20 shrink-0 rounded-2xl"
          style={itemPaint(item, item.kind === "CHARM" ? "contain" : "cover")}
        />
        <div className="min-w-0 grow">
          <p dir="auto" className="text-[16px] font-bold">
            {item.name}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {KIND_LABEL[item.kind] ?? "صنف"}
            {item.plusOnly ? " · لمشتركي آثار+" : ""}
          </p>
          {item.exclusiveTag ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-ink-2">
              {item.kind === "CHARM" ? "هذا التشارم خاص لـ" : "هذا الصنف خاص لـ"}
              <TagPill tag={item.exclusiveTag} size={12} />
            </p>
          ) : (
          <p className="mt-1 text-[14px] font-semibold text-clay-ink">
            {timed
              ? `من ${coinText(Math.min(...plans.map((one) => one.priceCoins)))}`
              : item.earnedAfterDays != null
                ? `يُكتسب بعد ${item.earnedAfterDays} يوم`
                : free
                  ? "يُكتسب بالوقت"
                  : coinText(item.priceCoins)}
          </p>
          )}
        </div>
      </div>

      {item.exclusiveTag && !owned ? (
        <p className="mt-3 text-center text-[12px] text-muted">لا يُباع في المتجر — يلبسه من يحمل هذا الوسم.</p>
      ) : owned || said?.ok ? (
        <p
          className="mt-3 flex items-center justify-center rounded-xl text-[13.5px] font-semibold"
          style={{ height: 48, background: "var(--color-chip)", color: "var(--color-ink-2)" }}
        >
          {said?.ok ?? "تملكه — البسه من إكسسواراتك"}
        </p>
      ) : timed ? (
        <p className="mt-3 text-center text-[12px] text-muted">
          له مُدَدٌ بأسعار — يُشترى من متجر التطبيق حيث تُختار المدّة.
        </p>
      ) : free ? (
        <p className="mt-3 text-center text-[12px] text-muted">هذا الصنف يُكتسب بالوقت لا يُشترى.</p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setSaid(await buyNow(item.id));
            })
          }
          className="mt-3 flex w-full items-center justify-center rounded-xl text-[14px] font-bold disabled:opacity-60"
          style={{ height: 48, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "نشتري…" : `اشترِ بـ${coinText(item.priceCoins)}`}
        </button>
      )}

      {said?.error ? (
        <p className="mt-2 text-center text-[12px]" style={{ color: "var(--color-live)" }}>
          {said.error}
        </p>
      ) : null}
    </Sheet>
  );
}

/** نافذةٌ من الأسفل تُغلق باللمس خارجها أو بسحبها إلى أسفل. */
function Row({
  label,
  hint,
  art,
  onClick,
}: {
  label: string;
  hint?: string;
  art?: NonNullable<WornItem>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-right"
    >
      {art ? (
        <span
          className="h-9 w-9 shrink-0 rounded-full"
          style={itemPaint(art, art.kind === "CHARM" ? "contain" : "cover")}
        />
      ) : null}
      <span className="min-w-0 grow">
        <span className="block text-[13.5px] font-semibold">{label}</span>
        {hint ? <span dir="auto" className="block text-[11.5px] text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}
