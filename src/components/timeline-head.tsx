"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshIcon } from "@/components/icons";
import { timeOfDay } from "@/lib/format";

const COVER = 176;
/** أقصى ما يتمدّد الغلاف بالسحب، وحدّ الإفلات الذي يعني «حدّث». */
const MAX_PULL = 96;
const TRIGGER = 56;
/** مركز عمود الصور من حافة الشاشة اليمنى: حشوة px-5 زائد نصف عمود w-14. */
const SPINE = 48;

/**
 * رأس الخط الزمني: الغلاف، وصورة العرض **داخله** جالسة على محور خط
 * المخطط، ومن أسفلها ينزل الخط إلى لحظات اليوم. الساعة إلى جانبها
 * وزر التحديث في الطرف المقابل.
 *
 * السحب من الأعلى يمدّ الغلاف وحده — الشريط العلوي ثابت — وبالإفلات
 * يُعاد جلب الصفحة. اللمس يُعالَج بمستمعات أصلية غير سالبة
 * (`passive: false`) لأن المتصفح يبتلع الإيماءة قبل أن تصل إلى React،
 * فيُلغي `pointer` ولا يتمدّد شيء تحت الإصبع.
 */
export function TimelineHead({
  coverMediaId,
  coverSpec,
  avatar,
  name,
  children,
}: {
  coverMediaId: string | null;
  coverSpec: string | null;
  avatar: ReactNode;
  name: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const scroll = useRef<HTMLDivElement>(null);
  const pulled = useRef(0);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const [clock, setClock] = useState("");

  // الساعة تُحسب بعد التركيب لا على الخادم، وإلا اختلف النصّان عند الترطيب.
  useEffect(() => {
    const tick = () => setClock(timeOfDay(new Date()));
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  function set(value: number) {
    pulled.current = value;
    setPull(value);
  }

  function refresh() {
    start(() => router.refresh());
  }

  function release() {
    setDragging(false);
    if (pulled.current >= TRIGGER) refresh();
    set(0);
  }

  // اللمس: المتصفح يملك الإيماءة ما لم نمنعه، فالمستمع أصليّ لا React.
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    let from: number | null = null;

    const onStart = (event: TouchEvent) => {
      from = el.scrollTop <= 0 ? event.touches[0].clientY : null;
    };
    const onMove = (event: TouchEvent) => {
      if (from === null) return;
      if (el.scrollTop > 0) {
        from = null;
        set(0);
        return;
      }
      const delta = event.touches[0].clientY - from;
      if (delta <= 0) {
        if (pulled.current !== 0) set(0);
        return;
      }
      event.preventDefault();
      setDragging(true);
      // مقاومة: نصف المسافة تقريباً، فالسحب يُحسّ ثقيلاً كالورق لا كالمطاط.
      set(Math.min(MAX_PULL, delta * 0.55));
    };
    const onEnd = () => {
      if (from === null) return;
      from = null;
      release();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // الفأرة: للمتصفح على الحاسب، حيث لا لمس أصلاً.
  const mouse = useRef<number | null>(null);

  function down(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    if ((scroll.current?.scrollTop ?? 0) > 0) return;
    mouse.current = event.clientY;
    setDragging(true);
  }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || mouse.current === null) return;
    const delta = event.clientY - mouse.current;
    set(delta <= 0 ? 0 : Math.min(MAX_PULL, delta * 0.55));
  }
  function up(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || mouse.current === null) return;
    mouse.current = null;
    release();
  }

  const spinning = pending || pull >= TRIGGER;

  return (
    <div
      ref={scroll}
      className="scroll-area"
      style={{
        overscrollBehaviorY: "contain",
        // السحب لا يجب أن يظلّل النصوص تحت الإصبع.
        userSelect: dragging ? "none" : undefined,
        WebkitUserSelect: dragging ? "none" : undefined,
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          height: COVER + pull,
          transition: dragging ? "none" : "height 260ms cubic-bezier(.2,.9,.3,1)",
          backgroundImage: coverMediaId ? `url(/api/media/${coverMediaId})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          background: coverMediaId
            ? undefined
            : (coverSpec ?? "linear-gradient(140deg,#f2e6d5,#e8cdb4 45%,#c9a68f)"),
        }}
      >
        {/* درع خفيف: الغلاف قد يكون صورة فاتحة أو خلفية داكنة من المتجر،
            فالنصّ أبيض دائماً ومعه تدرّج قصير وظلّ نصّ يضمنان قراءته. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{ height: 72, background: "linear-gradient(180deg,rgba(14,26,36,0),rgba(14,26,36,.46))" }}
        />

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-5 pb-2.5">
          <div className="flex w-14 shrink-0 justify-center">{avatar}</div>
          <div className="min-w-0 grow pb-1.5">
            <p
              className="truncate text-[14px] font-semibold"
              style={{ color: "#fff", textShadow: "0 1px 3px rgba(14,26,36,.45)" }}
            >
              {name}
            </p>
            <p
              className="text-[11.5px]"
              style={{ color: "rgba(255,255,255,.92)", textShadow: "0 1px 3px rgba(14,26,36,.45)" }}
              suppressHydrationWarning
            >
              {clock}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            aria-label="تحديث الخط الزمني"
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
            style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}
          >
            <span
              style={{
                display: "block",
                transform: `rotate(${pull * 3.4}deg)`,
                transition: dragging ? "none" : "transform 300ms ease",
                animation: spinning ? "athr-spin 900ms linear infinite" : undefined,
              }}
            >
              <RefreshIcon size={17} />
            </span>
          </button>
        </div>

        {/* الخط يبدأ من أسفل الصورة داخل الغلاف نفسه. */}
        <span
          className="absolute block w-px"
          style={{ right: SPINE, bottom: 0, height: 10, background: "rgba(255,255,255,.75)" }}
        />
      </div>

      {/* ثم يواصل نزوله حتى أول لحظة، فيصير خطاً واحداً متصلاً. */}
      <div className="relative shrink-0" style={{ height: 20 }}>
        <span className="absolute block w-px bg-line" style={{ right: SPINE, top: 0, bottom: 0 }} />
      </div>

      <main className="relative px-5">{children}</main>
    </div>
  );
}
