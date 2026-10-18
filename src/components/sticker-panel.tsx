"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stickerPacks } from "@/app/actions";
import { BASE } from "@/lib/base";
import { LockIcon, SparkIcon } from "@/components/icons";
import type { StickerPack } from "@/lib/stickers";

/** ثمانيةٌ في الصفحة: صفّان بأربعة (القاعدة ٢٩١). */
const PER_PAGE = 8;

type Page = { key: string; pack: string; index: number; count: number; stickers: StickerPack["stickers"] };

// المجموعاتُ تُجلب مرّةً في الصفحة: اللوحةُ تُفتح وتُغلق كثيراً.
let cached: Promise<{ allowed: boolean; packs: StickerPack[] }> | null = null;

function load() {
  cached ??= stickerPacks().catch((problem) => {
    cached = null;
    throw problem;
  });
  return cached;
}

/** هل يُرسم زرُّ الملصقات — من الإجراء نفسه، فلا يظهر لمن لا تُفتح له. */
export function useStickersAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let live = true;
    load()
      .then((said) => live && setAllowed(said.allowed))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return allowed;
}

/**
 * لوحةُ الملصقات تحت حقل الكتابة — نسخةُ `components/sticker-panel.tsx` في الجوّال:
 * ثمانيةٌ في الصفحة، والسحبُ يميناً ويساراً يقلّب الصفحات، واسمُ المجموعة في
 * أعلاها مع نقاط صفحاتها، والضغطةُ ترسل في الحال.
 *
 * ولغير مشترك آثار+ تُرسم الملصقاتُ نفسها خلف حجابٍ داكن بقفلٍ وزرِّ اشتراك:
 * يرى ما يفوته. والإجراءُ يردّ الإرسال لغير المشترك (`assertSticker`)، فالحجابُ
 * دعوةٌ لا حارس.
 */
export function StickerPanel({
  tone,
  isPlus,
  onPick,
}: {
  /** «dark» في نافذة التفاعل الزجاجيّة، و«light» على ورق الشاشات. */
  tone: "dark" | "light";
  isPlus: boolean;
  onPick: (stickerId: string) => void;
}) {
  const [packs, setPacks] = useState<StickerPack[] | null>(null);
  const [current, setCurrent] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    load()
      .then((said) => live && setPacks(said.packs))
      .catch(() => live && setPacks([]));
    return () => {
      live = false;
    };
  }, []);

  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [];
    for (const pack of packs ?? []) {
      const count = Math.ceil(pack.stickers.length / PER_PAGE);
      for (let index = 0; index < count; index++) {
        out.push({
          key: `${pack.id}:${index}`,
          pack: pack.name,
          index,
          count,
          stickers: pack.stickers.slice(index * PER_PAGE, (index + 1) * PER_PAGE),
        });
      }
    }
    return out;
  }, [packs]);

  const dark = tone === "dark";
  const ink = dark ? "#fff" : "var(--color-ink)";
  const soft = dark ? "rgba(255,255,255,.55)" : "var(--color-muted)";
  const cell = dark ? "rgba(255,255,255,.06)" : "var(--color-paper)";
  const page = pages[current] ?? pages[0];

  return (
    <div className="relative overflow-hidden rounded-[18px]" style={{ height: 196 }}>
      {packs === null ? (
        <p className="pt-16 text-center text-[12.5px]" style={{ color: soft }}>
          …
        </p>
      ) : pages.length === 0 ? (
        <p className="pt-16 text-center text-[12.5px]" style={{ color: soft }}>
          ما فيه ملصقات بعد
        </p>
      ) : (
        <>
          <div className="flex h-7 items-center gap-2 px-1">
            <span className="min-w-0 grow truncate text-[13px] font-bold" style={{ color: ink }}>
              {page?.pack}
            </span>
            {page && page.count > 1 ? (
              <span className="flex gap-1">
                {Array.from({ length: page.count }, (_, i) => (
                  <span
                    key={i}
                    className="block h-[5px] rounded-full"
                    style={{ width: i === page.index ? 14 : 5, background: i === page.index ? "var(--color-clay)" : soft }}
                  />
                ))}
              </span>
            ) : null}
          </div>

          {/* الصفحةُ الظاهرة من الإزاحة مطلقةً: في RTL تمضي سالبةً. */}
          <div
            ref={strip}
            onScroll={(event) => {
              const box = event.currentTarget;
              setCurrent(Math.round(Math.abs(box.scrollLeft) / Math.max(1, box.clientWidth)));
            }}
            className="no-bar flex snap-x snap-mandatory overflow-x-auto"
          >
            {pages.map((item) => (
              <div key={item.key} className="grid w-full shrink-0 snap-start grid-cols-4 gap-y-2.5">
                {item.stickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    aria-label="أرسل الملصق"
                    disabled={!isPlus}
                    onClick={() => onPick(sticker.id)}
                    className="flex h-[74px] items-center justify-center transition-transform active:scale-90"
                  >
                    <span className="flex h-[68px] w-[68px] items-center justify-center rounded-[14px]" style={{ background: cell }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${BASE}/api/media/${sticker.mediaId}`} alt="" width={60} height={60} className="object-contain" />
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {!isPlus ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5" style={{ background: "rgba(10,18,26,.82)" }}>
          <span style={{ color: "#fff" }}>
            <LockIcon size={26} />
          </span>
          <p className="text-[13.5px] font-bold" style={{ color: "#fff" }}>
            الملصقات لمشتركي آثار+
          </p>
          <a
            href={`${BASE}/subscribe`}
            className="flex h-[38px] items-center gap-1.5 rounded-full px-[18px] text-[13px] font-extrabold"
            style={{ background: "var(--color-gold)", color: "#fff" }}
          >
            <SparkIcon size={15} />
            اشترك في آثار+
          </a>
        </div>
      ) : null}
    </div>
  );
}
