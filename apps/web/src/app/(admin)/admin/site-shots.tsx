"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { addSiteShot, deleteSiteShot, replaceSiteShot, updateSiteShot } from "@/app/actions";
import { measure, shrink } from "@/components/image-picker";

type Row = { id: string; label: string; mediaId: string; sortOrder: number; hidden: boolean };

const FIELD =
  "w-full min-w-0 rounded-xl border border-line bg-paper px-3 text-[12.5px] text-ink outline-none focus:border-clay";

/**
 * يجهّز الملف للرفع: المتحرّكة (GIF، وWebP كما هي) تُرفع بملفها — أيُّ
 * رسمٍ على `canvas` يُبقي إطارها الأوّل وحده — والساكنةُ تُصغَّر إلى ١٢٠٠
 * على الأطول: تُعرض في هاتفٍ عرضُه ٢٢٠، وما فوق ذلك بكسلاتٌ تُحمَّل عبثاً.
 */
async function prepare(file: File): Promise<FormData> {
  const moving = file.type === "image/gif" || file.type === "image/webp";
  const body = new FormData();
  if (moving) {
    const { width, height } = await measure(file);
    body.append("image", file);
    body.append("width", String(width));
    body.append("height", String(height));
  } else {
    const picked = await shrink(file, 1200, false);
    body.append("image", picked.file);
    body.append("width", String(picked.width));
    body.append("height", String(picked.height));
  }
  return body;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function NewShot() {
  const input = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [said, setSaid] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mb-3 rounded-2xl border border-dashed border-line bg-card p-3">
      <p className="mb-2 text-[12px] font-bold">أضف لقطة</p>
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="اسم الشاشة — مثل «المتجر»"
          maxLength={40}
          className={FIELD}
          style={{ height: 40 }}
        />
        <button
          type="button"
          disabled={pending || !label.trim()}
          onClick={() => input.current?.click()}
          className="h-10 shrink-0 rounded-xl px-4 text-[12.5px] font-bold disabled:opacity-50"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "نرفع…" : "اختر الصورة"}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setSaid(null);
          start(async () => {
            try {
              const body = await prepare(file);
              body.append("label", label);
              const result = await addSiteShot(body);
              setSaid(result ?? null);
              if (result?.ok) setLabel("");
            } catch (problem) {
              setSaid({ error: problem instanceof Error ? problem.message : "تعذّر قراءة الصورة" });
            }
          });
        }}
      />
      <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
        لقطةُ شاشةٍ من الجوّال بطولها، أو صورةٌ متحرّكة (GIF أو WebP) حتى ٨ ميغا.
      </p>
      {said?.error ? (
        <p role="alert" className="mt-1.5 text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {said.error}
        </p>
      ) : null}
      {said?.ok ? <p className="mt-1.5 text-[11.5px] text-clay-ink">{said.ok}</p> : null}
    </div>
  );
}

function ShotRow({ shot }: { shot: Row }) {
  const [state, action, saving] = useActionState(updateSiteShot.bind(null, shot.id), null);
  const input = useRef<HTMLInputElement>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-card p-3" style={{ opacity: shot.hidden ? 0.6 : 1 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/site-media/${shot.mediaId}`}
        alt=""
        className="h-[132px] w-[64px] shrink-0 rounded-lg border border-line object-cover object-top"
      />
      <div className="flex min-w-0 grow flex-col gap-2">
        <form action={action} className="flex flex-col gap-2">
          <input name="label" defaultValue={shot.label} maxLength={40} className={FIELD} style={{ height: 38 }} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
              الترتيب
              <input
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                defaultValue={shot.sortOrder}
                className={FIELD}
                style={{ height: 34, width: 64 }}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
              <input name="hidden" type="checkbox" defaultChecked={shot.hidden} />
              مخفيّة
            </label>
            <button
              type="submit"
              disabled={saving}
              className="ms-auto h-8 rounded-lg px-3 text-[11.5px] font-bold"
              style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
            >
              احفظ
            </button>
          </div>
          {state?.error ? (
            <p className="text-[11px]" style={{ color: "var(--color-live)" }}>{state.error}</p>
          ) : state?.ok ? (
            <p className="text-[11px] text-clay-ink">{state.ok}</p>
          ) : null}
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => input.current?.click()}
            className="h-8 rounded-lg border border-line px-3 text-[11.5px] font-semibold"
          >
            {pending ? "نرفع…" : "بدّل الصورة"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`تحذف لقطة «${shot.label}»؟`)) void deleteSiteShot(shot.id);
            }}
            className="h-8 rounded-lg border border-line px-3 text-[11.5px] font-semibold"
            style={{ color: "var(--color-live)" }}
          >
            احذف
          </button>
        </div>
        {said ? <p className="text-[11px]" style={{ color: "var(--color-live)" }}>{said}</p> : null}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setSaid(null);
            start(async () => {
              try {
                const result = await replaceSiteShot(shot.id, await prepare(file));
                if (result?.error) setSaid(result.error);
              } catch (problem) {
                setSaid(problem instanceof Error ? problem.message : "تعذّر قراءة الصورة");
              }
            });
          }}
        />
      </div>
    </div>
  );
}

/**
 * لقطاتُ «من داخل التطبيق» — تُضاف وتُبدَّل وتُرتَّب وتُخفى.
 * وما دام لا صفَّ هنا تعرض الصفحةُ اللقطاتِ الثلاث المحفوظة مع الكود.
 */
export function SiteShots({ shots }: { shots: Row[] }) {
  return (
    <section className="mb-6">
      <h3 className="mb-1 text-[13px] font-bold text-clay-ink">لقطات «من داخل التطبيق»</h3>
      <p className="mb-2 text-[11px] leading-relaxed text-faint">
        تُعرض في صفحة الهبوط بترتيبها، ومعها أسهمٌ للتنقّل حين لا تتّسع لها
        الشاشة. وما دامت القائمة فارغة تُعرض اللقطات الثلاث الأصلية.
      </p>
      <NewShot />
      <div className="flex flex-col gap-2">
        {shots.map((shot) => (
          <ShotRow key={shot.id} shot={shot} />
        ))}
      </div>
    </section>
  );
}
