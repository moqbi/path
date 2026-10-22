"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { openingPromo, promoSeen, type PromoItem, type PromoPack } from "@/app/search-actions";
import { buyStickerPack } from "@/app/actions";
import { SparkIcon } from "@/components/icons";
import { ar, coinText } from "@/lib/format";
import { BASE } from "@/lib/base";

const media = (id: string) => `${BASE}/api/media/${id}`;

/**
 * بطاقةُ الإعلان عند الفتح — نسخةُ `store-promo.tsx` و`pack-promo.tsx` في الجوّال
 * (القاعدتان ٢٦٧ و٣٣٥): الصنفُ بصورته وسطره وسعره و«اعرضه في المتجر»، ومجموعةُ الملصقات
 * بملصقاتها — المجانيّةُ «حصرياً لمشتركي آثار+» وبابُ الاشتراك، والمدفوعةُ سعرُها وزرُّ
 * شرائها والنقصُ قبل الضغط. مرّةً لكل جلسة، والخادمُ يحفظ ما رُئي.
 */
export function OpeningPromo({ coins, isPlus }: { coins: number; isPlus: boolean }) {
  const [shown, setShown] = useState<{ item: PromoItem | null; pack: PromoPack | null } | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      if (sessionStorage.getItem("athr.promo")) return;
      sessionStorage.setItem("athr.promo", "1");
    } catch {}
    void openingPromo().then((res) => {
      if (res.item || res.pack) setShown(res);
    });
  }, []);

  if (!shown) return null;
  const close = () => {
    setShown(null);
    void promoSeen();
  };
  const { item, pack } = shown;
  const button = "mt-3.5 flex h-12 w-full items-center justify-center rounded-[14px] text-[14.5px] font-bold";

  let body: React.ReactNode = null;
  if (item) {
    const cheapest = item.plans?.length ? Math.min(...item.plans.map((one) => one.priceCoins)) : item.priceCoins;
    const image = item.promoMediaId ?? item.mediaId;
    body = (
      <>
        <div className="flex h-[220px] items-center justify-center" style={{ background: "var(--color-paper)" }}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media(image)} alt="" className="h-full w-full object-contain" />
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 p-[22px]">
          <span className="text-[11.5px] font-bold" style={{ color: "var(--color-clay-ink)" }}>جديد في المتجر</span>
          <span dir="auto" className="text-[19px] font-bold text-ink">{item.name}</span>
          {item.promoText ? <span className="text-[13.5px] leading-[23px] text-ink-2">{item.promoText}</span> : null}
          <span className="text-[12.5px] text-muted">
            {item.plans?.length ? `من ${coinText(cheapest)}` : coinText(cheapest)}
            {item.plusOnly ? " · لمشتركي آثار+" : ""}
          </span>
          <Link href="/store" onClick={close} className={button} style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}>
            اعرضه في المتجر
          </Link>
        </div>
      </>
    );
  } else if (pack) {
    const owned = pack.owned || said?.ok;
    const short = pack.priceCoins > 0 && !owned && coins < pack.priceCoins;
    const buy = () =>
      start(async () => {
        const res = await buyStickerPack(pack.id);
        setSaid(res.error ? { ok: false, text: res.error } : { ok: true, text: res.ok ?? "تمّ الشراء" });
      });
    body = (
      <>
        <div className="flex flex-wrap justify-center gap-2 p-[18px]" style={{ background: "var(--color-paper)" }}>
          {pack.stickers.slice(0, 8).map((one) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={one.id} src={media(one.mediaId)} alt="" className="h-16 w-16 object-contain" />
          ))}
        </div>
        <div className="flex flex-col gap-1.5 p-[22px]">
          <span className="text-[11.5px] font-bold" style={{ color: "var(--color-clay-ink)" }}>ملصقات جديدة</span>
          <span dir="auto" className="text-[19px] font-bold text-ink">{pack.name}</span>
          <span className="text-[12.5px] text-muted">{ar(pack.stickers.length)} ملصق للتعليقات والمحادثات</span>
          {pack.priceCoins > 0 ? (
            <span className="text-[13.5px] font-bold" style={{ color: "var(--color-clay-ink)" }}>
              {coinText(pack.priceCoins)} · تشتريها مرّة وتبقى لك
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: "var(--color-gold-ink)" }}>
              <SparkIcon size={14} /> حصرياً لمشتركي آثار+
            </span>
          )}
          {owned ? (
            <span className="mt-3.5 text-center text-[14px] font-bold" style={{ color: "var(--color-clay-ink)" }}>
              {said?.ok ? said.text : "عندك — تجدها بجانب الإرسال"}
            </span>
          ) : pack.priceCoins === 0 ? (
            isPlus ? (
              <span className="mt-3.5 text-center text-[13.5px] font-semibold" style={{ color: "var(--color-gold-ink)" }}>
                مفعّلة باشتراكك — تجدها بجانب الإرسال
              </span>
            ) : (
              <Link href="/subscribe" onClick={close} className={button} style={{ background: "var(--color-gold)", color: "#fff" }}>
                اشترك في آثار+
              </Link>
            )
          ) : short ? (
            <>
              <span className="mt-2.5 text-center text-[12.5px] text-faint">
                تحتاج {ar(pack.priceCoins)} نقطة — رصيدك {ar(coins)}
              </span>
              <Link href="/coins" onClick={close} className={button} style={{ background: "var(--color-gold)", color: "#fff" }}>
                اشحن نقاطك
              </Link>
            </>
          ) : (
            <button type="button" onClick={buy} disabled={pending} className={button} style={{ background: "var(--color-clay)", color: "var(--color-on-brand)", opacity: pending ? 0.7 : 1 }}>
              اشترِها بـ{coinText(pack.priceCoins)}
            </button>
          )}
          {said && !said.ok ? (
            <span role="alert" className="text-center text-[12.5px]" style={{ color: "var(--color-clay-ink)" }}>
              {said.text}
            </span>
          ) : null}
        </div>
      </>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-7" style={{ background: "rgba(14,26,36,.55)" }}>
      <button type="button" aria-label="إغلاق" onClick={close} className="absolute inset-0" />
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-3xl bg-card">
        {body}
        <button type="button" onClick={close} className="mb-3 block h-11 w-full text-[13.5px] font-semibold text-muted">
          إغلاق
        </button>
      </div>
    </div>,
    document.body,
  );
}
