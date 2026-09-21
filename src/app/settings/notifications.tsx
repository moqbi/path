"use client";

import { useState } from "react";
import { saveNotifications } from "@/app/actions";

/** بنودُ التنبيهات: مفتاحُها عمودٌ في القاعدة، ونصُّها ما يقرأه صاحبها. */
const ITEMS: { name: string; label: string; hint: string }[] = [
  { name: "notifyDm", label: "محادثة جديدة", hint: "رسالةٌ تصلك من صديق" },
  { name: "notifyFriend", label: "طلبات صداقة جديدة", hint: "من أراد الدخول في دائرتك" },
  { name: "notifyOnTag", label: "إشارات «مع فلان»", hint: "حين يذكرك أحدٌ في لحظته" },
  { name: "notifyReaction", label: "تفاعلات على اللحظات", hint: "وجهٌ أو إيموجي على ما نشرت" },
  { name: "notifyComment", label: "تعليق على لحظة", hint: "كلامٌ يُكتب تحت لحظتك" },
  { name: "notifyStoreNew", label: "من آثار: محتوى جديد في المتجر", hint: "إطارٌ أو ثيمٌ أو تميمة" },
  { name: "notifyStoreDeals", label: "من آثار: عروض وخصومات", hint: "ما يُخفَّض سعره أو يُعرض لمدّة" },
];

/** دقائقُ منتصف الليل ← «٢٢:٣٠» لحقل الوقت. */
function clock(minutes: number | null): string {
  if (minutes === null) return "";
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** ما تحمله الشاشة: مفتاحٌ لكل بند، وطرفا الوضع الهادئ. */
export type Prefs = {
  on: Record<string, boolean>;
  quietFrom: number | null;
  quietTo: number | null;
};

export function Notifications({ prefs }: { prefs: Prefs }) {
  // الوضع الهادئ يُطوى حين يُطفأ: حقلا وقتٍ بلا معنى ضجيجٌ في الشاشة.
  const [quiet, setQuiet] = useState(prefs.quietFrom !== null && prefs.quietTo !== null);

  const time =
    "h-11 rounded-xl border border-line bg-paper px-3 text-[13px] text-ink outline-none";

  return (
    <form action={saveNotifications} className="flex flex-col gap-3">
      <p className="text-[11.5px] leading-relaxed text-muted">
        هذه تنبيهات جهازك. وتبويب الإشعارات يبقى كما هو — سجلُّ ما جرى، لا يُمحى بإطفاء تنبيه.
      </p>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        {ITEMS.map((item, index) => (
          <label
            key={item.name}
            className={`flex items-center justify-between gap-3 p-4 ${
              index === 0 ? "" : "border-t border-line"
            }`}
          >
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold">{item.label}</span>
              <span className="block text-[11.5px] text-muted">{item.hint}</span>
            </span>
            <input
              name={item.name}
              type="checkbox"
              defaultChecked={prefs.on[item.name] !== false}
              className="h-6 w-6 shrink-0 accent-[#f6b93b]"
            />
          </label>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <label className="flex items-center justify-between gap-3 p-4">
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold">الوضع الهادئ</span>
            <span className="block text-[11.5px] text-muted">
              لا يصلك تنبيهٌ بين الوقتين — ويبقى كلُّ شيء في مكانه حتى تفتح التطبيق
            </span>
          </span>
          <input
            name="quiet"
            type="checkbox"
            checked={quiet}
            onChange={(event) => setQuiet(event.target.checked)}
            className="h-6 w-6 shrink-0 accent-[#f6b93b]"
          />
        </label>

        {quiet ? (
          <div className="flex items-center gap-3 border-t border-line p-4">
            <label className="min-w-0 grow">
              <span className="mb-1.5 block text-[11.5px] text-muted">من</span>
              <input
                name="quietFrom"
                type="time"
                required
                defaultValue={clock(prefs.quietFrom) || "22:00"}
                className={`${time} w-full`}
              />
            </label>
            <label className="min-w-0 grow">
              <span className="mb-1.5 block text-[11.5px] text-muted">إلى</span>
              <input
                name="quietTo"
                type="time"
                required
                defaultValue={clock(prefs.quietTo) || "07:00"}
                className={`${time} w-full`}
              />
            </label>
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        className="brand-gradient rounded-xl text-[14.5px] font-bold"
        style={{ height: 50, color: "var(--color-on-brand)" }}
      >
        احفظ التنبيهات
      </button>
    </form>
  );
}
