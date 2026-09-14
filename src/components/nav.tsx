"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BackIcon } from "@/components/icons";

/**
 * كم مرّة تنقّل المستخدم داخل التطبيق في هذه الجلسة.
 *
 * وحدةٌ على مستوى الملف لا حالةٌ في مكوّن: عميل Next يبقى حيّاً بين
 * الشاشات، فالعدّاد يبقى معه — بينما الحالة تموت مع كل شاشة تُغادر.
 */
let steps = 0;

/** يعدّ التنقّلات ليعرف زرّ الرجوع أفيه تاريخٌ يرجع إليه أم لا. */
export function NavProbe() {
  const pathname = usePathname();
  useEffect(() => {
    steps += 1;
  }, [pathname]);
  return null;
}

/**
 * الرجوع إلى ما جئتَ منه فعلاً، لا إلى وجهةٍ مكتوبة في الشاشة.
 *
 * «رجوع» من محادثةٍ فُتحت من الأصدقاء كان يذهب إلى المحادثات — لأن
 * الوجهة مكتوبة في الصفحة لا مقروءة من الطريق. والتاريخ يعرف الطريق:
 * من ملف صديقٍ إلى محادثته ثم رجوع = الملف نفسه.
 *
 * وحين لا تاريخ (فتحُ الرابط مباشرة أو تحديث الصفحة) تُستعمل الوجهة
 * المكتوبة — وهي حينئذٍ أفضل ما يُعرف.
 */
export function useGoBack(href?: string) {
  const router = useRouter();
  return useCallback(() => {
    if (steps > 1) router.back();
    else if (href) router.push(href);
  }, [href, router]);
}

export function BackButton({ href }: { href?: string }) {
  const back = useGoBack(href);
  return (
    <button
      type="button"
      aria-label="رجوع"
      onClick={back}
      className="-mr-2 flex h-10 w-10 items-center justify-center"
      style={{ color: "var(--color-chrome-muted)" }}
    >
      <BackIcon size={19} />
    </button>
  );
}

/** من حافة الشاشة إلى الداخل: مسافة البدء، والمسافة التي تعني «ارجع». */
const EDGE = 32;
const TRIGGER = 76;

/**
 * الرجوع بالسحب من الحافة.
 *
 * الحافتان كلتاهما: في RTL يُتوقَّع السحب من اليمين، ومن تعوّد اللاتينية
 * يسحب من اليسار — وقبول الاثنتين أرحم من تعليم الناس أيّهما الصحيحة.
 * والشرط أن تبدأ السحبة من الحافة نفسها: سحبةٌ من وسط الشاشة تخصّ
 * القائمة التي تحتها (كشفُ الحذف مثلاً) لا الرجوع.
 *
 * والشاشة تتبع الإصبع أثناء السحب: إيماءةٌ بلا أثرٍ يُرى تُقرأ عطلاً.
 */
export function BackSwipe({ href }: { href?: string }) {
  const back = useGoBack(href);

  useEffect(() => {
    const screen = () => document.querySelector<HTMLElement>(".screen");
    let from: { x: number; y: number; dir: 1 | -1 } | null = null;
    let travelled = 0;

    const paint = (dx: number) => {
      const el = screen();
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = dx ? `translateX(${dx}px)` : "";
    };

    const reset = (animate: boolean) => {
      const el = screen();
      if (el) {
        el.style.transition = animate ? "transform 180ms ease-out" : "none";
        el.style.transform = "";
      }
      from = null;
      travelled = 0;
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const width = window.innerWidth;
      // الهيكل موسَّط على الشاشات العريضة، فالحافة حافتُه لا حافة النافذة.
      const box = document.querySelector<HTMLElement>(".shell")?.getBoundingClientRect();
      const left = box?.left ?? 0;
      const right = box?.right ?? width;
      if (touch.clientX <= left + EDGE) from = { x: touch.clientX, y: touch.clientY, dir: 1 };
      else if (touch.clientX >= right - EDGE) from = { x: touch.clientX, y: touch.clientY, dir: -1 };
      else from = null;
    };

    const onMove = (event: TouchEvent) => {
      if (!from) return;
      const touch = event.touches[0];
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      // سحبةٌ رأسية تخصّ التمرير: تُترك لصاحبها.
      if (Math.abs(dy) > Math.abs(dx)) {
        reset(true);
        return;
      }
      const inward = dx * from.dir;
      if (inward <= 0) return;
      travelled = inward;
      paint(dx * 0.45);
    };

    const onEnd = () => {
      if (!from) return;
      const go = travelled >= TRIGGER;
      reset(true);
      if (go) back();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      reset(false);
    };
  }, [back]);

  return null;
}

/**
 * سحبٌ للأسفل يُغلق النافذة.
 *
 * النوافذ المنبثقة تُغلق بزرٍّ صغير في زاويتها، والإصبع أقرب إلى وسطها —
 * فالسحب إلى أسفل هو «رجوع» الطبيعي فيها.
 *
 * والعنصر يُمسك بـ`useState` لا بـ`useRef`: النافذة تُرسم في `portal`
 * فلا يوجد عنصرٌ عند أول تركيب، ومرجعٌ صامت لا يُخبر التأثير حين يظهر —
 * فتبقى المستمعات بلا عنصر. أما الحالة فتُعيد تشغيل التأثير حين يصل.
 */
export function useSwipeDown(onClose: () => void) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!el) return;

    let startY: number | null = null;
    let dy = 0;

    const paint = (value: number) => {
      el.style.transition = value ? "none" : "transform 180ms ease-out";
      el.style.transform = value ? `translateY(${value}px)` : "";
    };

    const start = (event: TouchEvent) => {
      startY = event.touches[0].clientY;
      dy = 0;
    };
    const move = (event: TouchEvent) => {
      if (startY === null) return;
      dy = event.touches[0].clientY - startY;
      if (dy > 0) paint(dy * 0.6);
    };
    const end = () => {
      const go = dy > 90;
      startY = null;
      dy = 0;
      paint(0);
      if (go) close.current();
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [el]);

  // دالّة `setState` ثابتة بين الرسمات، فتصلح مرجعاً لا يُعاد تركيبه.
  return setEl;
}
