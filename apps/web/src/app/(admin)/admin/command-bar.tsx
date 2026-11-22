"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminFind } from "@/app/actions";
import { ar } from "@/lib/format";

/**
 * سطرُ الأوامر فوق كلّ أقسام اللوحة (القاعدة ٤٧٧) — **بقرار المالك**: حقلٌ واحد يجد الحسابَ
 * والصنفَ والقسم، والسهمان يتنقّلان وEnter يفتح، و`/` أو Ctrl+K يركّز عليه من أيّ مكان.
 * لا يفعل شيئاً بنفسه: كلُّ نتيجةٍ بابٌ إلى صفحتها حيث الإجراءُ ودرجتُه (القاعدة ١٣).
 */
type Row = { key: string; group: string; title: string; sub: string; href: string; badge?: string };

const KIND: Record<string, string> = {
  FRAME: "إطار",
  CHARM: "تشارم",
  THEME: "ثيم",
  BACKGROUND: "ثيم",
  BUNDLE: "حزمة",
  GALLERY: "معرض",
  BOOK: "تصميم كتاب",
};

const fold = (s: string) =>
  s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();

export function CommandBar({ sections }: { sections: { key: string; label: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [found, setFound] = useState<Awaited<ReturnType<typeof adminFind>>>({ people: [], items: [] });
  const [pending, start] = useTransition();
  const asked = useRef("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
      if ((event.key === "/" && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setFound({ people: [], items: [] });
      return;
    }
    const timer = setTimeout(() => {
      asked.current = text;
      start(async () => {
        const result = await adminFind(text);
        // جوابٌ متأخّرٌ عن حرفٍ أحدث يُرمى.
        if (asked.current === text) setFound(result);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const text = fold(q);
  const rows: Row[] = [
    ...found.people.map((p) => ({
      key: `u${p.id}`,
      group: "حسابات",
      title: p.name,
      sub: `عضوية ${ar(p.memberNo)}${p.email ? ` · ${p.email}` : ""}`,
      href: `/admin/u/${p.id}`,
      badge: p.isPlus ? "آثار+" : undefined,
    })),
    ...found.items.map((item) => ({
      key: `i${item.id}`,
      group: "المتجر",
      title: item.name,
      sub: `${KIND[item.kind] ?? item.kind}${item.hidden ? " · مخفيّ" : ""}`,
      href: `/admin?s=store&open=${item.id}#item-${item.id}`,
    })),
    ...(text
      ? sections
          .filter((s) => fold(s.label).includes(text))
          .map((s) => ({ key: `s${s.key}`, group: "أقسام", title: s.label, sub: "قسم في اللوحة", href: `/admin?s=${s.key}` }))
      : []),
  ];
  const current = Math.min(at, Math.max(0, rows.length - 1));

  const go = (row: Row | undefined) => {
    if (!row) return;
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(row.href);
  };

  let lastGroup = "";
  return (
    <div className="relative mb-5" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAt(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt(Math.min(rows.length - 1, current + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt(Math.max(0, current - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(rows[current]);
            } else if (e.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            }
          }}
          placeholder="رقم عضوية، اسم، بريد، @معرّف، صنف، أو قسم…"
          aria-label="ابحث في اللوحة"
          className="h-11 min-w-0 grow bg-transparent text-[14px] outline-none"
        />
        {pending ? <span className="text-[11px] text-muted">…</span> : null}
        <kbd className="hidden rounded-md border border-line px-1.5 text-[11px] text-muted sm:inline">/</kbd>
      </div>

      {open && q.trim() ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-line bg-card shadow-lg">
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-center text-[12.5px] text-muted">
              {pending ? "يبحث…" : "لا شيء يطابق. جرّب رقم العضوية كاملاً أو جزءاً من الاسم."}
            </p>
          ) : (
            rows.map((row, index) => {
              const head = row.group !== lastGroup;
              lastGroup = row.group;
              return (
                <div key={row.key}>
                  {head ? <p className="px-4 pb-0.5 pt-2 text-[11px] font-semibold text-faint">{row.group}</p> : null}
                  <button
                    type="button"
                    onMouseEnter={() => setAt(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(row)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-start"
                    style={{ background: index === current ? "var(--color-clay-soft)" : undefined }}
                  >
                    <span className="min-w-0 grow">
                      <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">
                        {row.title}
                        {row.badge ? (
                          <span className="rounded-full border border-gold-line bg-gold-soft px-2 text-[10.5px] text-gold-ink">
                            {row.badge}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">{row.sub}</span>
                    </span>
                    {index === current ? <span className="text-[11px] text-muted">Enter</span> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
