"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buyStickerPack, stickerPacks } from "@/app/actions";
import { BASE } from "@/lib/base";
import { ar } from "@/lib/format";
import { LockIcon, SparkIcon } from "@/components/icons";
import type { StickerPack } from "@/lib/stickers";

/** ثمانيةٌ في الصفحة: صفّان بأربعة (القاعدة ٢٩١). */
const PER_PAGE = 8;

/** قفلُ الصفحة: «plus» مجموعةٌ مع آثار+ لغير مشترك، و«buy» مجموعةٌ مدفوعة لم تُشترَ. */
type Lock = "plus" | "buy" | null;

type Page = {
  key: string;
  packId: string;
  pack: string;
  price: number;
  owned: boolean;
  lock: Lock;
  index: number;
  count: number;
  /** ترتيبُ المجموعة بين المجموعات — لنقاطها في أسفل اللوحة. */
  packIndex: number;
  stickers: StickerPack["stickers"];
};

// المجموعاتُ تُجلب مرّةً في الصفحة: اللوحةُ تُفتح وتُغلق كثيراً.
let cached: Promise<{ allowed: boolean; packs: StickerPack[]; coins: number }> | null = null;

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
 * والقفلُ لكلّ مجموعةٍ لا للّوحة (القاعدة ٢٩٤): مجموعةٌ مع آثار+ خلف حجابٍ بزرِّ
 * اشتراك لغير المشترك، ومجموعةٌ مدفوعة خلف حجابٍ بسعرها وزرِّ شرائها. والإجراءُ
 * يردّ الإرسال (`assertSticker`)، فالحجابُ دعوةٌ لا حارس.
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
  const [coins, setCoins] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ packId: string; text: string } | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    load()
      .then((said) => {
        if (!live) return;
        setPacks(said.packs);
        setCoins(said.coins);
      })
      .catch(() => live && setPacks([]));
    return () => {
      live = false;
    };
  }, []);

  const buy = async (packId: string) => {
    if (buying) return;
    setBuying(packId);
    setProblem(null);
    try {
      const said = await buyStickerPack(packId);
      if (said.error) return setProblem({ packId, text: said.error });
      // الملكيّةُ والرصيدُ تغيّرا: تُعاد القائمةُ من الإجراء لا من المخبأ.
      cached = null;
      const fresh = await load();
      setPacks(fresh.packs);
      setCoins(fresh.coins);
    } catch {
      setProblem({ packId, text: "تعذّر الشراء" });
    } finally {
      setBuying(null);
    }
  };

  const pages = useMemo<Page[]>(() => {
    const out: Page[] = [];
    for (const [packIndex, pack] of (packs ?? []).entries()) {
      const count = Math.ceil(pack.stickers.length / PER_PAGE);
      const price = pack.priceCoins;
      const lock: Lock = pack.owned ? null : price > 0 ? "buy" : isPlus ? null : "plus";
      for (let index = 0; index < count; index++) {
        out.push({
          key: `${pack.id}:${index}`,
          packId: pack.id,
          pack: pack.name,
          price,
          owned: pack.owned,
          lock,
          index,
          count,
          packIndex,
          stickers: pack.stickers.slice(index * PER_PAGE, (index + 1) * PER_PAGE),
        });
      }
    }
    return out;
  }, [packs, isPlus]);

  const dark = tone === "dark";
  // على الورق اللوحةُ على الأرضية لا في بطاقة، فحبرُها حبرُ الأرضية (القاعدة ٢٦٢).
  const ink = dark ? "#fff" : "var(--color-ground-ink)";
  const soft = dark ? "rgba(255,255,255,.55)" : "var(--color-ground-muted)";
  const cell = dark ? "rgba(255,255,255,.06)" : "var(--color-paper)";
  const page = pages[current] ?? pages[0];
  // أوّلُ صفحةٍ لكلّ مجموعة: نقطتُها تقفز إليها.
  const firsts = pages.flatMap((one, at) => (one.index === 0 ? [at] : []));
  const dots = firsts.length > 1;

  const jump = (at: number) => {
    const box = strip.current;
    if (!box) return;
    // في RTL تمضي الإزاحةُ سالبةً.
    const sign = getComputedStyle(box).direction === "rtl" ? -1 : 1;
    box.scrollTo({ left: sign * at * box.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative overflow-hidden rounded-[18px]" style={{ height: dots ? 206 : 188 }}>
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
              <div key={item.key} className="relative w-full shrink-0 snap-start" style={{ height: 186 }}>
              <PageHead page={item} ink={ink} soft={soft} />
              <div className="grid grid-cols-4 gap-y-2.5">
                {item.stickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    aria-label="أرسل الملصق"
                    disabled={item.lock !== null}
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
              {item.lock ? (
                <PackLock
                  page={item}
                  coins={coins}
                  busy={buying === item.packId}
                  problem={problem?.packId === item.packId ? problem.text : null}
                  onBuy={() => buy(item.packId)}
                />
              ) : null}
              </div>
            ))}
          </div>

          {/* نقطةٌ لكلّ مجموعة: تقول إنّ بعد هذه مجموعاتٍ أخرى، وتقفز إليها. */}
          {dots ? (
            <div className="flex h-[18px] items-center justify-center gap-1.5">
              {firsts.map((at, packIndex) => {
                const on = page?.packIndex === packIndex;
                return (
                  <button
                    key={at}
                    type="button"
                    aria-label={`مجموعة ${pages[at]?.pack ?? ""}`}
                    onClick={() => jump(at)}
                    className="block h-1.5 rounded-full transition-all"
                    style={{ width: on ? 16 : 6, background: on ? ink : soft, opacity: on ? 1 : 0.6 }}
                  />
                );
              })}
            </div>
          ) : null}
        </>
      )}

    </div>
  );
}

/** رأسُ الصفحة: اسمُ المجموعة في الوسط، والسعرُ أو «مملوكة» في طرفٍ ونقاطُ صفحاتها في الآخر. */
function PageHead({ page, ink, soft }: { page: Page; ink: string; soft: string }) {
  return (
    <div className="flex h-7 items-center gap-2 px-1">
      <span className="flex flex-1 basis-0">
        {page.price > 0 || page.owned ? (
          <span className="text-[11px] font-bold" style={{ color: page.owned ? soft : "var(--color-clay-ink)" }}>
            {page.owned ? "مملوكة" : `${ar(page.price)} نقطة`}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 truncate text-center text-[13px] font-bold" style={{ color: ink }}>
        {page.pack}
      </span>
      <span className="flex flex-1 basis-0 justify-end gap-1">
        {page.count > 1
          ? Array.from({ length: page.count }, (_, i) => (
              <span
                key={i}
                className="block h-1 rounded-full"
                style={{ width: i === page.index ? 12 : 4, background: i === page.index ? "var(--color-clay)" : soft }}
              />
            ))
          : null}
      </span>
    </div>
  );
}

/** حجابُ المجموعة المقفولة: اشتراكٌ لما مع آثار+، وشراءٌ بسعرها لما يُشترى. */
function PackLock({
  page,
  coins,
  busy,
  problem,
  onBuy,
}: {
  page: Page;
  coins: number;
  busy: boolean;
  problem: string | null;
  onBuy: () => void;
}) {
  // النقصُ يُقال قبل الضغط (القاعدة ٩٣ب).
  const short = page.lock === "buy" && coins < page.price;
  const pill = "flex h-[38px] items-center gap-1.5 rounded-full px-[18px] text-[13px] font-extrabold";
  return (
    <div
      className="absolute inset-x-0 bottom-0 top-7 flex flex-col items-center justify-center gap-2 rounded-[14px] px-4 text-center"
      style={{ background: "rgba(10,18,26,.82)", color: "#fff" }}
    >
      <LockIcon size={24} />
      {page.lock === "plus" ? (
        <>
          <p className="text-[13.5px] font-bold">مع اشتراك آثار+</p>
          <a href={`${BASE}/subscribe`} className={pill} style={{ background: "var(--color-gold)", color: "#fff" }}>
            <SparkIcon size={15} />
            اشترك في آثار+
          </a>
        </>
      ) : (
        <>
          <p className="text-[13.5px] font-bold">
            {short ? `تحتاج ${ar(page.price)} نقطة — رصيدك ${ar(coins)}` : "تشتريها مرّة وتبقى لك"}
          </p>
          {short ? (
            <a href={`${BASE}/coins`} className={pill} style={{ background: "var(--color-gold)", color: "#fff" }}>
              باقات النقاط
            </a>
          ) : (
            <button type="button" onClick={onBuy} disabled={busy} className={pill} style={{ background: "var(--color-clay)", color: "#fff", opacity: busy ? 0.7 : 1 }}>
              {busy ? "…" : `اشترِها بـ${ar(page.price)} نقطة`}
            </button>
          )}
          {problem ? <p className="text-[12px]" style={{ color: "#FFB4A2" }}>{problem}</p> : null}
        </>
      )}
    </div>
  );
}
