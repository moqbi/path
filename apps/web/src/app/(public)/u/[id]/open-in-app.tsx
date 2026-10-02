"use client";

import { useState } from "react";

/**
 * «افتح في التطبيق» — رابطُ التطبيق نفسه (`athar://u/<id>`).
 *
 * ومن لم يُنزّله: المتصفّح لا يعرف `athar://` فيبقى في الصفحة. فإن بقيت
 * الصفحةُ ظاهرةً بعد لحظة — لم ينتقل شيء — **يُعرض** زرُّ المتجر ولا يُرسَل
 * إليه (القاعدة ٢٢٥): متصفّحُ واتساب وسناب الداخليّ يحجب `athar://` فتمضي
 * المهلةُ والتطبيقُ مثبَّت، وكان الإرسالُ الآليّ يأخذ من نزّله إلى المتجر.
 * والتطبيقُ إن فُتح أخفى الصفحةَ (`visibilitychange`) فلا يظهر شيء.
 *
 * والبابُ الأوّل اليوم الرابطُ نفسه: `https://…/u/<رقم>` يفتح التطبيق مباشرةً
 * بـUniversal Links لمن نزّله (`with-links.js` و`apple-app-site-association`)،
 * فلا تُرى هذه الصفحة أصلاً. وهي لمن لم ينزّله، أو لمتصفّحٍ داخليّ لا يمرّر
 * الروابط إلى النظام.
 */
export function OpenInApp({ userId, store }: { userId: string; store: string | null }) {
  const [said, setSaid] = useState<string | null>(null);
  const [offer, setOffer] = useState(false);

  function open() {
    setSaid(null);
    setOffer(false);
    let left = false;
    const gone = () => {
      if (document.hidden) left = true;
    };
    document.addEventListener("visibilitychange", gone);

    window.location.href = `athar://u/${userId}`;

    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", gone);
      if (left) return;
      setOffer(Boolean(store));
      setSaid(
        store
          ? "ما انفتح التطبيق؟ إن كان عندك، افتح الرابط في سفاري أو كروم (⋯ ← فتح في المتصفّح). وإن لم يكن، حمّله:"
          : "ما انفتح التطبيق؟ افتح الرابط في سفاري أو كروم، أو حمّله من متجر جهازك.",
      );
    }, 1400);
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={open}
        className="brand-gradient flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-bold"
        style={{ color: "var(--color-on-brand)" }}
      >
        افتح الملف في التطبيق
      </button>
      {said ? <p className="mt-2 text-center text-[12px] leading-relaxed text-muted">{said}</p> : null}
      {offer && store ? (
        <a
          href={store}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl border border-line bg-card text-[13px] font-bold text-ink"
        >
          حمّل التطبيق
        </a>
      ) : null}
    </div>
  );
}
