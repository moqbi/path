"use client";

import { fixAccount } from "@/app/actions";
import { Saver } from "../../saver";

/** زرُّ حلٍّ تحت المشكلة نفسها (القاعدة ٤٣٦) — نتيجتُه تُقرأ كبقيّة نماذج اللوحة. */
export function FixButton({ userId, act, label }: { userId: string; act: string; label: string }) {
  return (
    <Saver action={fixAccount.bind(null, userId)} className="inline-flex flex-col gap-1">
      <input type="hidden" name="do" value={act} />
      <button className="rounded-full px-3 py-1 text-[11.5px] font-bold" style={{ background: "var(--color-ink)", color: "var(--color-card)" }}>
        {label}
      </button>
    </Saver>
  );
}
