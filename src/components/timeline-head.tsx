"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshIcon } from "@/components/icons";
import { timeOfDay } from "@/lib/format";

const COVER = 148;
/** أقصى ما يتمدّد الغلاف بالسحب، وحدّ الإفلات الذي يعني «حدّث». */
const MAX_PULL = 96;
const TRIGGER = 58;

/**
 * رأس الخط الزمني: الغلاف، وصورة العرض جالسة عليه وعلى خط المخطط اليومي،
 * والساعة يمينها وزر التحديث يساره.
 *
 * السحب من الأعلى يمدّ الغلاف وحده — الشريط العلوي ثابت لا يتحرّك —
 * وبالإفلات يُعاد جلب الخط الزمني. هذه حركة Path نفسها: الصفحة تتنفّس
 * تحت الإصبع بدل أن يبحث المستخدم عن زر.
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
  const from = useRef<number | null>(null);
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

  function refresh() {
    start(() => router.refresh());
  }

  function down(event: React.PointerEvent<HTMLDivElement>) {
    if ((scroll.current?.scrollTop ?? 0) > 0) return;
    from.current = event.clientY;
    setDragging(true);
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (from.current === null) return;
    if ((scroll.current?.scrollTop ?? 0) > 0) {
      from.current = null;
      setDragging(false);
      setPull(0);
      return;
    }
    const delta = event.clientY - from.current;
    // مقاومة: نصف المسافة تقريباً، فالسحب يُحسّ ثقيلاً كالورق لا كالمطاط.
    setPull(delta <= 0 ? 0 : Math.min(MAX_PULL, delta * 0.55));
  }

  function up() {
    if (from.current === null) return;
    from.current = null;
    setDragging(false);
    if (pull >= TRIGGER) refresh();
    setPull(0);
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
        className="shrink-0 overflow-hidden"
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
      />

      <div className="relative flex items-start gap-3 px-5" style={{ marginTop: -30 }}>
        {/* العمود نفسه الذي تجلس عليه صور اللحظات، فالخط ينزل مستقيماً. */}
        <div className="flex w-14 shrink-0 flex-col items-center">
          {avatar}
          <span className="mt-1.5 block w-px bg-line" style={{ height: 22 }} />
        </div>

        <div className="min-w-0 grow pt-8">
          <p className="truncate text-[14px] font-semibold">{name}</p>
          <p className="text-[11.5px] text-muted" suppressHydrationWarning>
            {clock}
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          aria-label="تحديث الخط الزمني"
          className="mt-8 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line disabled:opacity-60"
          style={{ background: "var(--color-card)", color: "var(--color-muted)" }}
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

      <main className="relative px-5 pt-2">{children}</main>
    </div>
  );
}
