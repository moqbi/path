"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { buyNow } from "@/app/actions";
import { Avatar, itemPaint, type Charm } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { useSwipeDown } from "@/components/nav";
import { coinText } from "@/lib/format";

/** صنفٌ يلبسه صاحب الملف — إطارٌ أو تميمة — كما يُعرض في المتجر. */
export type WornItem = {
  id: string;
  name: string;
  kind: string;
  spec: string;
  mediaId: string | null;
  priceCoins: number;
  plusOnly: boolean;
} | null;

const KIND_LABEL: Record<string, string> = {
  FRAME: "إطار",
  CHARM: "تميمة",
  THEME: "ثيم",
  BACKGROUND: "خلفية",
};

/**
 * صورة العرض تُضغط فتُسأل: أيّها تريد؟
 *
 * الصورة نفسها، أو الصنف الذي يلبسه صاحبها — فالإطار والتميمة يُريان على
 * الناس قبل أن يُريا في المتجر، ومن أعجبه ما رأى يعرف اسمه وسعره من
 * مكانه. وما لا يلبسه لا يُعرض سطراً فارغاً.
 */
export function AvatarMenu({
  name,
  size,
  mediaId,
  frameSpec,
  charm,
  frame,
  charmItem,
  owned = [],
}: {
  name: string;
  size: number;
  mediaId: string | null;
  frameSpec?: string | null;
  charm?: Charm;
  frame: WornItem;
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
        <Avatar name={name} size={size} frameSpec={frameSpec} charm={charm} mediaId={mediaId} />
      </button>

      {view === "menu" ? (
        <Sheet onClose={close} title={name}>
          <Row label="عرض صورة الملف الشخصي" onClick={() => setView("photo")} />
          {charmItem ? (
            <Row
              label="عرض معلومات التميمة"
              hint={charmItem.name}
              art={charmItem}
              onClick={() => setView("charm")}
            />
          ) : null}
          {frame ? (
            <Row
              label="عرض معلومات الإطار"
              hint={frame.name}
              art={frame}
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
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/media/${mediaId}`}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 18 }}
            />
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
      {view === "frame" && frame ? (
        <ItemSheet item={frame} owned={owned.includes(frame.id)} onClose={close} />
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
  const free = item.priceCoins === 0;

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
          <p className="mt-1 text-[14px] font-semibold text-clay-ink">
            {item.priceCoins > 0 ? coinText(item.priceCoins) : "يُكتسب بالوقت"}
          </p>
        </div>
      </div>

      {owned || said?.ok ? (
        <p
          className="mt-3 flex items-center justify-center rounded-xl text-[13.5px] font-semibold"
          style={{ height: 48, background: "var(--color-chip)", color: "var(--color-ink-2)" }}
        >
          {said?.ok ?? "تملكه — البسه من إكسسواراتك"}
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
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // المستمعات تُركَّب مع النافذة نفسها، فكلُّ نافذةٍ تُفتح تُسحب لتُغلق.
  const box = useSwipeDown(onClose);

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(14,26,36,.42)", animation: "athr-veil 160ms ease both" }}
    >
      <button type="button" aria-label="إغلاق" onClick={onClose} className="grow" />
      <div
        ref={box}
        className="rounded-t-3xl px-5 pb-8 pt-3"
        style={{ background: "var(--color-paper)", borderTop: "1px solid var(--color-line)" }}
      >
        {/* مقبضٌ يقول إنّ النافذة تُسحب. */}
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block rounded-full"
          style={{ width: 44, height: 4, background: "var(--color-line)" }}
        />
        <p dir="auto" className="mb-2 text-center text-[13px] font-bold text-ink-2">
          {title}
        </p>
        {children}
      </div>
    </div>
    </Portal>
  );
}

/**
 * يرسم النافذة على جسد الصفحة لا في مكانها من الشجرة.
 *
 * `position: fixed` داخل عنصرٍ عليه `transform` يُقاس من ذلك العنصر لا من
 * الشاشة — وصورة العرض في تبويب «أنا» داخل صندوقٍ يتقلّص بالتمرير
 * (`scale`)، فكانت النافذة تُحبس تحته وخلف شريط التبويبات.
 */
function Portal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return createPortal(children, document.body);
}

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
