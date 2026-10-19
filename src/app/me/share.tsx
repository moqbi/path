"use client";

import { useMemo, useState } from "react";
// النواةُ وحدها: الحزمةُ كاملةً تجرّ رسمَ canvas، والرمزُ هنا مسارُ SVG.
import { create } from "qrcode/lib/core/qrcode";
import { ShareIcon } from "@/components/icons";
import { AthrMark } from "@/components/brand";
import { Sheet } from "@/components/sheet";
import { ar } from "@/lib/format";

/** رمزُ QR بمسارٍ واحد وفي وسطه العلامة — تصحيحُ «H» يحتمل ما تغطّيه. */
export function Qr({ value, size }: { value: string; size: number }) {
  const { d, count } = useMemo(() => {
    const { modules } = create(value, { errorCorrectionLevel: "H" });
    const n = modules.size;
    let path = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
    }
    return { d: path, count: n };
  }, [value]);
  const quiet = 2;
  const box = count + quiet * 2;
  const logo = Math.round(size * 0.22);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${box} ${box}`} shapeRendering="crispEdges">
        <rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
        <path d={d} fill="var(--color-night)" />
      </svg>
      <span
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[14px] bg-white"
        style={{ width: logo + 12, height: logo + 12 }}
      >
        <AthrMark size={logo} />
      </span>
    </div>
  );
}

/**
 * مشاركة الملف: رابطٌ أو رمز QR برقم العضوية (القاعدة ٨٧).
 *
 * لا اكتشاف عام في آثار، فرابط الملف ليس دعوةً لغريب — هو ما تعطيه من
 * تعرفه ليجدك بلا بحثٍ بالاسم. والرمزُ لمن يقف أمامك يمسحه بكاميرته.
 * والرابطُ بمشاركة النظام حين توجد، وإلا نُسخ — ويُقال أيّهما حدث.
 */
export function ShareProfile({
  name,
  memberNo,
  trigger,
}: {
  name: string;
  memberNo: number;
  /** زرٌّ آخر يفتح النافذة نفسها — خطوةُ «ادعُ أوّل صديق» في بطاقة الترحيب. */
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  function tell(message: string) {
    setSaid(message);
    setTimeout(() => setSaid(null), 1800);
  }

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/u/${memberNo}`;
  const text = `${name} · عضوية رقم ${ar(memberNo)} في آثار`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "آثار", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      tell("نُسخ الرابط");
    } catch {
      // إلغاء المستخدم للمشاركة ليس خطأً يُعرض.
    }
  }

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="شارك ملفك"
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "var(--color-chrome-2)", color: "var(--color-chrome-ink)" }}
      >
        <ShareIcon size={18} />
      </button>
      )}

      {open ? (
        <Sheet title="شارك ملفك" onClose={() => setOpen(false)}>
          <div className="mx-auto mt-1 flex w-fit flex-col items-center rounded-3xl border border-line bg-white p-4">
            <Qr value={url} size={208} />
            <b className="mt-2.5 text-[17px]">{name}</b>
            <span className="text-[12.5px] text-muted">عضوية رقم {ar(memberNo)} · امسح الرمز بالكاميرا</span>
          </div>
          <button
            type="button"
            onClick={() => void share()}
            className="mt-4 h-12 w-full rounded-full text-[15px] font-extrabold"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            {said ?? "شارك الرابط"}
          </button>
        </Sheet>
      ) : null}
    </>
  );
}
