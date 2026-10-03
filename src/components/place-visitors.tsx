"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { momentVisitors } from "@/app/actions";
import type { VisitorsView } from "@/lib/place-visitors";
import { Portal } from "@/components/sheet";
import { useSwipeDown } from "@/components/nav";
import { CloseIcon, PinIcon, WithIcon } from "@/components/icons";
import { Avatar, NameTag } from "@/components/ui";
import { ar, relative } from "@/lib/format";

const MUTED = "rgba(255,255,255,.6)";

/**
 * «من كان هنا» — نافذةٌ زجاجيّة لصاحب لحظة المكان (القاعدة ٢٣٠)، نسخةُ
 * الجوّال: أصدقاؤه بأسمائهم، وغيرُهم عددٌ لا يُقال تحت خمسة، والخرائطُ زرٌّ
 * في أسفلها.
 */
export function PlaceVisitors({
  momentId,
  place,
  mapsUrl,
  onClose,
}: {
  momentId: string;
  place: string;
  mapsUrl: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const box = useSwipeDown(onClose);
  const [data, setData] = useState<VisitorsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    momentVisitors(momentId)
      .then((result) => {
        if (!live) return;
        if ("error" in result) setError(result.error);
        else setData(result);
      })
      .catch(() => live && setError("تعذّر جلب الزوّار"));
    return () => {
      live = false;
    };
  }, [momentId]);

  const days = ar(data?.days ?? 10);
  const friends = data?.friends ?? [];
  const empty = data && friends.length === 0 && !data.others;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        style={{ background: "rgba(8,14,20,.38)", animation: "athr-veil 160ms ease both" }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" aria-label="إغلاق" onClick={onClose} className="grow" />
        <div
          ref={box}
          dir="rtl"
          className="mx-auto mb-3 w-[calc(100%-20px)] max-w-[520px] overflow-hidden rounded-[30px] text-white"
          style={{
            maxHeight: "70vh",
            display: "flex",
            flexDirection: "column",
            // الزجاجُ نفسه الذي في شريط الجوّال (القاعدة ٢٢٨).
            background: "rgba(20,24,28,.74)",
            backdropFilter: "blur(28px) saturate(1.4)",
            WebkitBackdropFilter: "blur(28px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,.16)",
            boxShadow: "0 12px 40px rgba(0,0,0,.35)",
            animation: "athr-sheet 220ms cubic-bezier(.2,.8,.2,1) both",
          }}
        >
          <span aria-hidden="true" className="mx-auto mt-2.5 block h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,.3)" }} />

          <div className="flex items-center gap-3 px-[18px] pb-3.5 pt-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,122,90,.22)", color: "var(--color-live)" }}>
              <PinIcon size={20} />
            </span>
            <div className="min-w-0 grow">
              <p dir="auto" className="truncate text-[17px] font-bold">{place}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>{`من كان هنا خلال ${days} أيام`}</p>
            </div>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={onClose}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,.12)" }}
            >
              <CloseIcon size={16} />
            </button>
          </div>

          <div className="mx-[18px] h-px" style={{ background: "rgba(255,255,255,.1)" }} />

          <div className="min-h-0 overflow-y-auto px-3 py-2.5">
            {error ? (
              <p className="my-6 text-center text-[14px]" style={{ color: MUTED }}>{error}</p>
            ) : !data ? (
              <p className="my-7 text-center text-[13px]" style={{ color: MUTED }}>…</p>
            ) : empty ? (
              <div className="flex flex-col items-center gap-1.5 px-5 py-5 text-center">
                <span style={{ color: "rgba(255,255,255,.55)" }}><WithIcon size={22} /></span>
                <p className="text-[14px] font-semibold">ما زاره أحدٌ من دائرتك مؤخّراً</p>
                <p className="text-[12px]" style={{ color: "rgba(255,255,255,.55)" }}>
                  {`أوّلُ من يزوره منهم خلال ${days} أيام يظهر هنا`}
                </p>
              </div>
            ) : (
              <>
                {friends.length > 0 ? (
                  <p className="mx-2 mb-1 text-[11.5px] font-bold" style={{ color: "rgba(255,255,255,.55)" }}>
                    {`من دائرتك · ${ar(friends.length)}`}
                  </p>
                ) : null}
                {friends.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push(`/u/${person.id}`);
                    }}
                    className="flex w-full items-center gap-3 rounded-[18px] px-2 py-2.5 text-right transition-colors hover:bg-white/10"
                  >
                    <Avatar name={person.name} size={42} mediaId={person.avatarMediaId} frame={person.frame} charm={person.charm} />
                    <span className="min-w-0 grow">
                      <span className="flex items-center gap-1.5">
                        <span dir="auto" className="truncate text-[14.5px] font-bold">{person.name}</span>
                        <NameTag isPlus={person.isPlus} tag={person.tag} size={10} />
                      </span>
                      <span className="mt-0.5 block text-[12px]" style={{ color: MUTED }}>
                        {`زاره ${relative(new Date(person.visitedAt))}`}
                      </span>
                    </span>
                  </button>
                ))}

                {/* والباقون عددٌ بلا أسماء، ولا يُقال تحت خمسة. */}
                {data.others ? (
                  <div
                    className={`flex items-center gap-2.5 rounded-[18px] px-3 py-3 text-[13px] ${friends.length > 0 ? "mt-1.5" : ""}`}
                    style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.85)" }}
                  >
                    <span style={{ color: "var(--color-gold, #F6B93B)" }}><WithIcon size={18} /></span>
                    {friends.length > 0
                      ? `و${ar(data.others)} غيرهم من مستخدمي آثار زاروه`
                      : `${ar(data.others)} من مستخدمي آثار زاروه`}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {mapsUrl ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                window.open(mapsUrl, "_blank", "noopener,noreferrer");
              }}
              className="mx-4 mb-4 mt-1 flex h-12 shrink-0 items-center justify-center gap-2 rounded-full text-[14px] font-bold transition-colors hover:bg-white/20"
              style={{ background: "rgba(255,255,255,.14)" }}
            >
              <PinIcon size={15} />
              افتح في الخرائط
            </button>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
