"use client";

import { useState } from "react";
import { pinConversation } from "@/app/actions";
import { SwipeRow } from "@/components/swipe-row";
import { StarIcon } from "@/components/icons";
import { Portal } from "@/components/sheet";

/**
 * صفُّ محادثةٍ يُسحب: سلّةٌ للحذف ونجمةٌ للمفضّلة (القاعدة ٢٢٠). وحين تمتلئ
 * المفضّلة تُقال في نافذةٍ بوسط الشاشة لا سطرٍ في طرفها — كالجوّال.
 */
export function PinRow({
  conversationId,
  pinned,
  onDelete,
  children,
}: {
  conversationId: string;
  pinned: boolean;
  onDelete: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [full, setFull] = useState<string | null>(null);
  return (
    <>
      <SwipeRow
        onDelete={onDelete}
        confirmLabel="حذف المحادثة"
        icons="trash"
        secondLabel={pinned ? "أزلها من المفضّلة" : "أضفها للمفضّلة"}
        secondIcon={<StarIcon size={22} filled={!pinned} />}
        onSecond={async () => {
          const said = await pinConversation(conversationId, !pinned);
          if (said.error) setFull(said.error);
        }}
      >
        {children}
      </SwipeRow>
      {full ? (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(14,26,36,.42)" }}>
            <div role="alertdialog" className="w-full max-w-[320px] rounded-3xl bg-card p-6 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-clay-ink" style={{ background: "var(--color-clay-soft)" }}>
                <StarIcon size={24} />
              </span>
              <p className="mb-1 text-[16px] font-bold">المفضّلة فلّت!</p>
              <p className="mb-4 text-[13px] leading-relaxed text-muted">{full.replace("المفضّلة فلّت! — ", "")} — أزل وحدة منها أوّل.</p>
              <button
                type="button"
                onClick={() => setFull(null)}
                className="brand-gradient h-11 w-full rounded-xl text-[14px] font-bold"
                style={{ color: "var(--color-on-brand)" }}
              >
                أبشر
              </button>
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
