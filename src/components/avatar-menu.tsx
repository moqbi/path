"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, itemPaint, type Charm } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { useSwipeDown } from "@/components/nav";
import { riyals } from "@/lib/format";

/** صنفٌ يلبسه صاحب الملف — إطارٌ أو تميمة — كما يُعرض في المتجر. */
export type WornItem = {
  id: string;
  name: string;
  kind: string;
  spec: string;
  mediaId: string | null;
  priceHalalas: number;
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
}: {
  name: string;
  size: number;
  mediaId: string | null;
  frameSpec?: string | null;
  charm?: Charm;
  frame: WornItem;
  charmItem: WornItem;
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
      ) : null}

      {view === "charm" && charmItem ? (
        <ItemSheet item={charmItem} onClose={close} />
      ) : null}
      {view === "frame" && frame ? <ItemSheet item={frame} onClose={close} /> : null}
    </>
  );
}

/** بطاقة الصنف كما في المتجر: شكله واسمه وسعره، وبابٌ إليه. */
function ItemSheet({ item, onClose }: { item: NonNullable<WornItem>; onClose: () => void }) {
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
            {item.plusOnly ? " · لمشتركي أثر+" : ""}
          </p>
          <p className="mt-1 text-[14px] font-semibold text-clay-ink">
            {item.priceHalalas > 0 ? riyals(item.priceHalalas) : "يُكتسب بالوقت"}
          </p>
        </div>
      </div>

      <Link
        href="/store"
        className="mt-3 flex items-center justify-center rounded-xl text-[14px] font-bold"
        style={{ height: 48, background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        افتحه في المتجر
      </Link>
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
  );
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
