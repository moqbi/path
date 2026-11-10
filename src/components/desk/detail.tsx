"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AthrMark } from "@/components/brand";
import { BASE } from "@/lib/base";

const WIDE = "(min-width: 1200px)";
/** ما يُضغط لنفسه داخل البطاقة — لا يفتح اللحظة في اللوحة. */
const OWN_CLICK = "a,button,input,textarea,select,video,audio,label,summary,[role=button],[contenteditable]";

/** معرّفُ اللحظة من مسار `/m/<id>` (بالجذر `/app` أو بلاه)، وإلّا لا شيء. */
function momentIn(path: string): string | null {
  const hit = /\/m\/([A-Za-z0-9_-]+)\/?$/.exec(path);
  return hit ? hit[1] : null;
}

/** المعرّفُ يدخل عنوانَ إطارٍ ونمطاً مكتوباً: حروفُه وأرقامُه وحدها، وإلّا لا شيء. */
function safe(id: string | null): string | null {
  return id && /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

/**
 * لوحةُ اللحظة على سطح المكتب — **بقرار المالك** (القاعدة ٤٥٦): ضغطةٌ على أيّ
 * لحظةٍ في الهيكل تفتحها هنا بتفاعلها وتعليقاتها وحقلها، فيُقرأ ويُعلَّق جنباً
 * إلى جنب بلا نافذةٍ تطفو ولا صفحةٍ تُغادَر.
 *
 * **وهي صفحةُ اللحظة نفسها في إطار** (`/m/<id>`) لا نسخةٌ ثانية منها: التفاعلُ
 * والتعليقُ والملصقُ والإشارةُ والبلاغُ والحذفُ بابٌ واحد يُصان. والإطارُ من
 * نطاقنا وحده (`frame-ancestors 'self'` على `/m/*` في `next.config.ts`).
 */
export function DeskDetail() {
  const pathname = usePathname();
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  // داخل إطارٍ لا لوحةَ ثانية: الإطارُ هو اللوحة.
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    setFramed(window.self !== window.top);
  }, []);

  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const onClick = (event: MouseEvent) => {
      if (!wide.matches || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      if (!target?.closest?.(".desk > .shell")) return;

      // رابطٌ إلى صفحة اللحظة: تُفتح هنا بدل أن تأخذ مكان الخطّ.
      const link = target.closest<HTMLAnchorElement>("a[href]");
      const linked = link ? momentIn(link.pathname) : null;
      if (linked) {
        event.preventDefault();
        event.stopPropagation();
        setId(linked);
        return;
      }

      const row = target.closest("[data-moment]");
      if (!row || target.closest(OWN_CLICK)) return;
      // من يحدّد نصّاً لا يفتح شيئاً.
      if (window.getSelection()?.toString()) return;
      setId(safe(row.getAttribute("data-moment")));
    };
    // طورُ الالتقاط: قبل أن يصل الرابطَ معالجُ الموجّه.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // أوّلُ لحظةٍ في الخطّ تُفتح وحدها: لوحةٌ فارغة لا تقول ما تفعل.
  useEffect(() => {
    if (id || pathname !== "/" || !window.matchMedia(WIDE).matches) return;
    const timer = window.setTimeout(() => {
      const first = document.querySelector(".desk > .shell [data-moment]");
      if (first) setId(safe(first.getAttribute("data-moment")));
    }, 60);
    return () => window.clearTimeout(timer);
  }, [id, pathname]);

  // ما فُعل في اللوحة (تفاعلٌ، تعليق) يُرى في الخطّ حين يعود إليه الإصبع.
  useEffect(() => {
    let last = 0;
    const onFocus = () => {
      if (Date.now() - last < 4000) return;
      last = Date.now();
      router.refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  if (framed) return null;

  return (
    <aside className="desk-detail" aria-label="اللحظة المفتوحة">
      {id ? (
        <>
          {/* علامةُ المفتوحة في الخطّ نمطٌ لا سمةٌ تُكتب: يبقى مهما أُعيد رسمُ القائمة. */}
          <style>{`@media ${WIDE}{.desk .shell [data-moment="${id}"]{background:color-mix(in srgb,var(--color-clay) 13%,transparent);box-shadow:0 0 0 6px color-mix(in srgb,var(--color-clay) 13%,transparent)}}`}</style>
          <iframe key={id} src={`${BASE}/m/${id}`} title="اللحظة المفتوحة" />
        </>
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-3 text-center text-ground-ink">
          <AthrMark size={56} />
          <p className="text-[15px] font-semibold">اضغط لحظة لتقرأها وتعلّق عليها هنا</p>
        </div>
      )}
    </aside>
  );
}

/**
 * حارسُ الصفحة داخل اللوحة: يعلّم المستند (`html.embedded`) فيُرسم الهيكلُ وحده،
 * وما خرج عن صفحة اللحظة — ملفُّ صاحبها، المتجر، الرجوع — يُفتح في النافذة
 * الأمّ لا داخل الإطار: اللوحةُ للحظة لا متصفّحٌ ثانٍ.
 */
export function EmbedGuard() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.self === window.top) return;
    document.documentElement.classList.add("embedded");
    if (pathname.startsWith("/m/")) return;
    try {
      window.top?.location.assign(`${BASE}${pathname}${window.location.search}`);
    } catch {
      // إطارٌ في نطاقٍ آخر لا يكون: الترويسةُ تمنعه.
    }
  }, [pathname]);
  return null;
}
