"use client";

import { useActionState, useState } from "react";
import {
  clearSiteImage,
  createSocialLink,
  deleteSocialLink,
  saveSiteText,
  setSiteImage,
  updateSocialLink,
  type AdminResult,
} from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";
import { CameraIcon, CloseIcon } from "@/components/icons";
import { SocialIcon } from "@/components/social";
import { PLATFORMS } from "@/lib/platforms";

const FIELD =
  "w-full rounded-xl border border-line bg-paper px-3 text-[13px] text-ink outline-none placeholder:text-faint";

/**
 * حقلُ نصٍّ في الموقع: يُحفظ بنفسه ويقول ما حدث.
 *
 * وكلٌّ بنموذجه لا نموذجٌ واحد بثلاثين حقلاً: خطأٌ في حقلٍ يردّ التسعةَ
 * والعشرين معه، وتعديلُ سطرٍ يُعيد كتابة ما لم يُمسّ فيضيع تمييزُ ما
 * تغيّر. والرسالة تحت الحقل نفسه، فيُعرف أيّها حُفظ.
 */
function TextField({
  siteKey,
  label,
  note,
  value,
  multiline,
  changed,
}: {
  siteKey: string;
  label: string;
  note?: string;
  value: string;
  multiline?: boolean;
  /** هل يخالف الافتراضيّ؟ — الشارة تقول ما حُرّر دون فتح كل حقل. */
  changed: boolean;
}) {
  const [state, run, pending] = useActionState<AdminResult, FormData>(
    saveSiteText.bind(null, siteKey),
    null,
  );

  return (
    <form action={run} className="rounded-2xl border border-line bg-card p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <label className="text-[12px] font-bold" htmlFor={`f-${siteKey}`}>
          {label}
        </label>
        {changed ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-clay-ink)" }}
          >
            مُعدّل
          </span>
        ) : null}
      </div>
      {note ? <p className="mb-1.5 text-[11px] leading-relaxed text-faint">{note}</p> : null}

      {multiline ? (
        <textarea
          id={`f-${siteKey}`}
          name="value"
          defaultValue={value}
          rows={4}
          className={`${FIELD} py-2.5 leading-relaxed`}
        />
      ) : (
        <input id={`f-${siteKey}`} name="value" defaultValue={value} className={`${FIELD} h-11`} />
      )}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-xl px-3.5 text-[12px] font-bold"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "…" : "احفظ"}
        </button>
        <span className="text-[11px] text-faint">أفرغه ليرجع النصّ الأصليّ.</span>
        {state?.ok ? <span className="text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</span> : null}
        {state?.error ? (
          <span role="alert" className="text-[11.5px]" style={{ color: "var(--color-live)" }}>
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** صورة الرأس: تُرفع وتُنزع، وبلا صورةٍ يرسم الموقع لوحته المرسومة. */
function HeroImage({ mediaId }: { mediaId: string | null }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-5 rounded-2xl border border-line bg-card p-3">
      <p className="mb-1 text-[12px] font-bold">صورة الرأس</p>
      <p className="mb-2.5 text-[11px] leading-relaxed text-faint">
        تُعرض خلف الشعار في أعلى صفحة الهبوط، وفوقها درعٌ داكن يُبقي النصّ
        مقروءاً. وبلا صورة تُرسم اللوحة الافتراضية. الأفضل عريضةٌ ومظلمة
        الأطراف — ٢٠٠٠×٦٠٠ فما فوق.
      </p>

      <div
        className="mb-2.5 h-28 w-full rounded-xl"
        style={{
          background: mediaId
            ? `center / cover no-repeat url(/api/media/${mediaId})`
            : "linear-gradient(135deg,#0e1a24,#7a4a3e,#c9743f)",
        }}
      />

      <div className="flex items-center gap-2">
        <ImagePicker
          label="صورة الرأس"
          maxSize={1920}
          onError={setError}
          onPicked={async (file, width, height) => {
            const body = new FormData();
            body.append("image", file);
            body.append("width", String(width));
            body.append("height", String(height));
            await setSiteImage("hero", body);
          }}
          className="flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-[12px] font-semibold"
        >
          <CameraIcon size={16} />
          {mediaId ? "بدّلها" : "ارفع صورة"}
        </ImagePicker>

        {mediaId ? (
          <button
            type="button"
            onClick={() => void clearSiteImage("hero")}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-[12px] font-semibold text-muted"
          >
            <CloseIcon size={14} />
            انزعها
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** صفُّ رابطِ تواصل: تعديلٌ في مكانه، وحذفٌ بنموذجٍ منفصل لا يتداخل. */
function SocialRow({
  link,
}: {
  link: { id: string; platform: string; url: string; sortOrder: number; hidden: boolean };
}) {
  const [state, run, pending] = useActionState<AdminResult, FormData>(
    updateSocialLink.bind(null, link.id),
    null,
  );

  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <form action={run} className="flex flex-wrap items-end gap-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--color-chip)", color: "var(--color-ink-2)" }}
        >
          <SocialIcon platform={link.platform} />
        </span>

        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-faint">المنصّة</span>
          <select
            name="platform"
            defaultValue={link.platform}
            className={`${FIELD} h-10 w-[120px]`}
          >
            {PLATFORMS.map((one) => (
              <option key={one.key} value={one.key}>
                {one.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[180px] grow flex-col gap-1">
          <span className="text-[10.5px] text-faint">الرابط</span>
          <input name="url" dir="ltr" defaultValue={link.url} className={`${FIELD} h-10 text-left`} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-faint">الترتيب</span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={link.sortOrder}
            className={`${FIELD} h-10 w-[74px]`}
          />
        </label>

        <label className="flex h-10 shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-muted">
          <input
            type="checkbox"
            name="hidden"
            defaultChecked={link.hidden}
            className="h-4 w-4 accent-[var(--color-clay)]"
          />
          مخفيّ
        </label>

        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
          style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
        >
          {pending ? "…" : "احفظ"}
        </button>
      </form>

      <div className="mt-2 flex items-center gap-3">
        <form action={deleteSocialLink.bind(null, link.id)}>
          <button
            type="submit"
            className="text-[11.5px] font-semibold"
            style={{ color: "var(--color-live)" }}
          >
            احذف
          </button>
        </form>
        {state?.ok ? <span className="text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</span> : null}
        {state?.error ? (
          <span role="alert" className="text-[11.5px]" style={{ color: "var(--color-live)" }}>
            {state.error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function NewSocial() {
  const [state, run, pending] = useActionState<AdminResult, FormData>(createSocialLink, null);

  return (
    <form action={run} className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-faint">المنصّة</span>
        <select name="platform" className={`${FIELD} h-10 w-[120px]`}>
          {PLATFORMS.map((one) => (
            <option key={one.key} value={one.key}>
              {one.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[180px] grow flex-col gap-1">
        <span className="text-[10.5px] text-faint">الرابط</span>
        <input
          name="url"
          dir="ltr"
          required
          placeholder="https://…"
          className={`${FIELD} h-10 text-left`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-faint">الترتيب</span>
        <input name="sortOrder" type="number" min={0} defaultValue={0} className={`${FIELD} h-10 w-[74px]`} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-10 shrink-0 rounded-xl px-3.5 text-[12px] font-bold"
        style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
      >
        {pending ? "…" : "أضِف"}
      </button>

      {state?.error ? (
        <p role="alert" className="w-full text-[11.5px]" style={{ color: "var(--color-live)" }}>
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="w-full text-[11.5px] font-semibold text-clay-ink">{state.ok} ✓</p> : null}
    </form>
  );
}

/** أقسام الصفحة كما تُقرأ من أعلى إلى أسفل — لا كما تُخزَّن مفاتيحُها. */
const GROUPS: { title: string; note?: string; fields: { key: string; label: string; note?: string; multiline?: boolean }[] }[] = [
  {
    title: "الرأس",
    note: "أوّل ما يُرى: الشعار ثم العبارة ثم المتن.",
    fields: [
      { key: "hero.line", label: "العبارة الكبرى" },
      { key: "hero.latin", label: "سطرٌ لاتينيّ تحتها", note: "اتركه فارغاً ليختفي." },
      { key: "hero.body", label: "المتن", multiline: true },
    ],
  },
  {
    title: "المزايا",
    fields: [
      { key: "features.title", label: "عنوان القسم" },
      { key: "features.sub", label: "سطرٌ تحته" },
      { key: "feature.moments.title", label: "اللحظات — العنوان" },
      { key: "feature.moments.body", label: "اللحظات — المتن", multiline: true },
      { key: "feature.stories.title", label: "القصص — العنوان" },
      { key: "feature.stories.body", label: "القصص — المتن", multiline: true },
      { key: "feature.circle.title", label: "الدائرة — العنوان" },
      { key: "feature.circle.body", label: "الدائرة — المتن", multiline: true },
      { key: "feature.chat.title", label: "المحادثات — العنوان" },
      { key: "feature.chat.body", label: "المحادثات — المتن", multiline: true },
    ],
  },
  {
    title: "من داخل التطبيق",
    fields: [
      { key: "shots.title", label: "عنوان القسم" },
      { key: "shots.sub", label: "سطرٌ تحته" },
    ],
  },
  {
    title: "الخصوصية",
    fields: [
      { key: "privacy.title", label: "العنوان" },
      { key: "privacy.body", label: "المتن", multiline: true },
      { key: "privacy.no", label: "قائمة «لا»", note: "سطرٌ لكل بند.", multiline: true },
      { key: "privacy.yes", label: "قائمة «نعم»", note: "سطرٌ لكل بند.", multiline: true },
    ],
  },
  {
    title: "التحميل",
    fields: [
      { key: "download.title", label: "العنوان" },
      { key: "download.body", label: "المتن", multiline: true },
      { key: "download.cta", label: "نصّ الزرّ" },
    ],
  },
  {
    title: "الذيل",
    note: "يظهر في كل صفحات الموقع.",
    fields: [
      { key: "foot.tagline", label: "الشعار تحت العلامة" },
      { key: "foot.follow", label: "عنوان «تابعنا»" },
      { key: "foot.rights", label: "سطر الحقوق" },
    ],
  },
];

export function SitePanel({
  text,
  defaults,
  heroMediaId,
  links,
}: {
  text: Record<string, string>;
  defaults: Record<string, string>;
  heroMediaId: string | null;
  links: { id: string; platform: string; url: string; sortOrder: number; hidden: boolean }[];
}) {
  return (
    <>
      <h2 className="mb-1 text-[15px] font-bold">الموقع</h2>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        كل نصٍّ في صفحة الهبوط وذيلِ الموقع يُحرَّر من هنا بلا نشر نسخة. وما
        لم يُعدَّل يتبع الأصل المكتوب في الكود — فحذفُ ما كتبتَه يردّه، ولا
        يتجمّد الموقع على نسخةٍ قديمة.
      </p>

      <HeroImage mediaId={heroMediaId} />

      {GROUPS.map((group) => (
        <section key={group.title} className="mb-6">
          <h3 className="mb-1 text-[13px] font-bold text-clay-ink">{group.title}</h3>
          {group.note ? <p className="mb-2 text-[11px] text-faint">{group.note}</p> : null}
          <div className="flex flex-col gap-2">
            {group.fields.map((field) => (
              <TextField
                key={field.key}
                siteKey={field.key}
                label={field.label}
                note={field.note}
                multiline={field.multiline}
                value={text[field.key] ?? ""}
                changed={text[field.key] !== defaults[field.key]}
              />
            ))}
          </div>
        </section>
      ))}

      <h3 className="mb-1 text-[13px] font-bold text-clay-ink">تابعنا</h3>
      <p className="mb-2 text-[11px] leading-relaxed text-faint">
        تظهر في ذيل الموقع وفي شاشة الخصوصية بالتطبيق معاً — مكانٌ واحد
        يُدار منه الاثنان. و«مخفيّ» يُبقي الصفّ ولا يعرضه.
      </p>
      <NewSocial />
      <div className="mb-7 flex flex-col gap-2">
        {links.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-5 text-center text-[12.5px] text-muted">
            لا روابط بعد.
          </p>
        ) : (
          links.map((link) => <SocialRow key={link.id} link={link} />)
        )}
      </div>
    </>
  );
}
