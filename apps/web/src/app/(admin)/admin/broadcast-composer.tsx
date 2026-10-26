"use client";

import { useEffect, useState, useTransition } from "react";
import { sendBroadcast } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";

const FIELD =
  "w-full rounded-xl border border-line bg-card px-4 py-3 text-[13.5px] text-ink outline-none focus:border-clay";

/**
 * نموذجُ تنبيه المشرف (القاعدة ٣٦٣) ومعاينتُه: التنبيهُ كما يظهر على شاشة القفل،
 * والنافذةُ كما تُفتح بضغطه. والصورةُ تُحفظ في الحالة لا تُرفع ساعةَ تُختار —
 * تنبيهٌ لم يُرسل لا يترك ملفّاً بلا صاحب.
 */
export function BroadcastComposer() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cardTitle, setCardTitle] = useState("");
  const [cardBody, setCardBody] = useState("");
  const [image, setImage] = useState<{ file: Blob; width: number; height: number; url: string } | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => () => (image ? URL.revokeObjectURL(image.url) : undefined), [image]);

  const ready = title.trim() && body.trim() && cardTitle.trim() && cardBody.trim();

  const send = () =>
    start(async () => {
      const data = new FormData();
      data.set("title", title);
      data.set("body", body);
      data.set("cardTitle", cardTitle);
      data.set("cardBody", cardBody);
      if (image) {
        data.set("image", image.file);
        data.set("width", String(image.width));
        data.set("height", String(image.height));
      }
      const res = await sendBroadcast(data);
      setSure(false);
      if (res.error) return setSaid({ ok: false, text: res.error });
      setSaid({ ok: true, text: res.ok ?? "تمّ" });
      setTitle("");
      setBody("");
      setCardTitle("");
      setCardBody("");
      setImage(null);
    });

  return (
    <div className="grid gap-5 rounded-2xl border border-line bg-card p-4 lg:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-[12px] font-bold text-muted">التنبيه</p>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
          العنوان الرئيسي
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={FIELD} placeholder="مثال: جديد في آثار" />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
          النص تحته
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={180} rows={2} className={FIELD} placeholder="سطرٌ يُقرأ على شاشة القفل" />
        </label>

        <p className="mt-2 text-[12px] font-bold text-muted">النافذة عند فتح التنبيه</p>
        <div className="flex items-center gap-2.5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
          ) : null}
          <ImagePicker
            label={image ? "غيّر الصورة" : "اختر صورة (اختياري)"}
            maxSize={1600}
            onPicked={(file, width, height) => setImage({ file, width, height, url: URL.createObjectURL(file) })}
            className="grow"
          />
          {image ? (
            <button type="button" onClick={() => setImage(null)} className="shrink-0 text-[12px] font-semibold text-muted">
              إزالة
            </button>
          ) : null}
        </div>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
          العبارة الرئيسية
          <input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} maxLength={80} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
          النص تحتها
          <textarea value={cardBody} onChange={(e) => setCardBody(e.target.value)} maxLength={600} rows={4} className={FIELD} />
        </label>

        {sure ? (
          <div className="flex items-center gap-2 rounded-xl border border-line p-3">
            <p className="grow text-[12.5px] font-semibold">يصل إلى كلّ المستخدمين ولا تراجع بعده. أرسل؟</p>
            <button
              type="button"
              onClick={send}
              disabled={pending}
              className="h-10 rounded-xl px-4 text-[13px] font-bold disabled:opacity-60"
              style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
            >
              {pending ? "يُرسل…" : "نعم، أرسل"}
            </button>
            <button type="button" onClick={() => setSure(false)} className="h-10 px-2 text-[12.5px] font-semibold text-muted">
              تراجع
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              setSaid(null);
              setSure(true);
            }}
            className="h-11 rounded-xl text-[13.5px] font-bold disabled:opacity-50"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            أرسل للجميع
          </button>
        )}
        {said ? (
          <p role="status" className={`text-[12.5px] font-semibold ${said.ok ? "text-clay-ink" : "text-live"}`}>
            {said.text}
          </p>
        ) : null}
      </div>

      {/* المعاينة: التنبيهُ كما يظهر، ثمّ النافذةُ كما تُفتح. */}
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-[12px] font-bold text-muted">المعاينة</p>
        <div className="rounded-2xl p-3 text-[#f7f5ef]" style={{ background: "#0e1a24" }}>
          <p className="text-[10.5px] opacity-70">ATHAR Moments · الآن</p>
          <p className="truncate text-[13px] font-bold">{title || "العنوان الرئيسي"}</p>
          <p className="line-clamp-2 text-[12px] opacity-85">{body || "النص تحته"}</p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-line" style={{ background: "var(--color-card)" }}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt="" className="block w-full" style={{ aspectRatio: shape(image.width / image.height), objectFit: "cover" }} />
          ) : null}
          <div className="flex flex-col gap-1.5 p-5">
            <p className="text-[11px] font-bold text-clay-ink">من آثار</p>
            <p className="text-[17px] font-bold" dir="auto">{cardTitle || "العبارة الرئيسية"}</p>
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-2" dir="auto">{cardBody || "النص تحتها"}</p>
            <p className="mt-3 text-center text-[13px] font-semibold text-muted">إغلاق</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** نسبةُ الصورة في النافذة كما يرسمها الجوّال: بين ٠٫٧ و٢. */
function shape(ratio: number) {
  return String(Math.min(2, Math.max(0.7, ratio || 1.3)));
}
