"use client";

import { useEffect, useState, useTransition } from "react";
import { GiftIcon, SparkIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { BASE } from "@/lib/base";
import { ar, coinText, daysLabel } from "@/lib/format";
import { giftFromSheet, giftPackFromSheet, giftShelf, type GiftItem, type GiftPack, type GiftShelf } from "./gift-actions";

/**
 * الإهداء: المتجر يُفتح في نافذة فوق ملف صاحبك، لا في صفحة تُغادر مكانك — نسخةُ
 * `apps/mobile/components/gift-sheet.tsx` (القاعدة ١٦٢): شرائحُ الأنواع وأقسامُها
 * بمجموعاتها، والضغطةُ تختار ثمّ «أهدِ» ومعها المدّة. وما يملكه أصلاً يُعرض مطفأً.
 * والخصمُ بسعرك أنت: أنت الدافع.
 */
const KINDS = [
  { key: "FRAME", label: "الإطارات", kinds: ["FRAME"] },
  { key: "CHARM", label: "التشارمز", kinds: ["CHARM"] },
  { key: "THEME", label: "الثيمات", kinds: ["THEME", "BACKGROUND"] },
  { key: "STICKER", label: "الملصقات", kinds: [] },
] as const;
type Kind = (typeof KINDS)[number]["key"];

const media = (id: string) => `${BASE}/api/media/${id}`;
/** أوّلُ لونٍ في تدرّج الصنف — أرضيةُ رسمٍ بلا صورة. */
const firstColor = (spec: string) => /#[0-9a-f]{3,8}/i.exec(spec)?.[0] ?? "var(--color-chip)";

export function GiftButton({
  friendId,
  friendName,
  friendIsPlus,
  friendOwned,
  grow = false,
}: {
  friendId: string;
  friendName: string;
  friendIsPlus: boolean;
  friendOwned: string[];
  /** يملأ مكانه في صفّ أزرار الملف بمقاس أزرار «أنا» (القاعدة ٢٣٣). */
  grow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3.5 font-semibold ${
          grow ? "grow text-[13.5px] text-ink" : "text-[13px] text-ink-2"
        }`}
        style={{ height: grow ? 46 : 42 }}
      >
        <GiftIcon size={16} />
        إهداء
      </button>
      {open ? (
        <GiftSheet
          friendId={friendId}
          friendName={friendName}
          friendIsPlus={friendIsPlus}
          friendOwned={friendOwned}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function GiftSheet({
  friendId,
  friendName,
  friendIsPlus,
  friendOwned,
  onClose,
}: {
  friendId: string;
  friendName: string;
  friendIsPlus: boolean;
  friendOwned: string[];
  onClose: () => void;
}) {
  const [shelf, setShelf] = useState<GiftShelf | null>(null);
  const [note, setNote] = useState<{ ok?: string; error?: string } | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("FRAME");
  const [pick, setPick] = useState<GiftItem | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [pickPack, setPickPack] = useState<GiftPack | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    let alive = true;
    void giftShelf(friendId).then((res) => {
      if (!alive) return;
      if ("error" in res) setNote({ error: res.error });
      else setShelf(res);
    });
    return () => {
      alive = false;
    };
  }, [friendId]);

  const isPlus = shelf?.isPlus ?? false;
  const coins = shelf?.coins ?? 0;
  const price = (priceCoins: number) => (isPlus ? Math.round(priceCoins * 0.8) : priceCoins);

  const tabs = KINDS.filter((row) => row.key !== "STICKER" || (shelf?.packs.length ?? 0) > 0);
  const tab = KINDS.find((row) => row.key === kind)!;
  const kinds = tab.kinds as readonly string[];
  const items = (shelf?.items ?? []).filter((item) => kinds.includes(item.kind));
  const collections = (shelf?.collections ?? []).filter((one) => !one.kind || kinds.includes(one.kind));
  const known = new Set(collections.map((one) => one.id));
  const sections = [
    ...collections.map((one) => ({ title: one.name, items: items.filter((item) => item.collectionId === one.id) })),
    {
      title: collections.length ? `${tab.label} الأخرى` : "",
      items: items.filter((item) => !item.collectionId || !known.has(item.collectionId)),
    },
  ].filter((row) => row.items.length > 0);
  const has = new Set([...friendOwned, ...sent]);
  const packOwned = new Set([...(shelf?.packsOwned ?? []), ...sent]);
  const plans = pick?.plans ?? [];
  const plan = plans.find((one) => one.id === planId) ?? plans[0] ?? null;
  const pickPrice = pick ? price(plan ? plan.priceCoins : pick.priceCoins) : 0;

  const gift = () =>
    pick &&
    start(async () => {
      const res = await giftFromSheet(pick.id, friendId, plan?.id);
      setNote(res);
      if (res.ok) {
        setSent((list) => [...list, pick.id]);
        setPick(null);
        setShelf((now) => (now ? { ...now, coins: now.coins - pickPrice } : now));
      }
    });
  const giftPack = () =>
    pickPack &&
    start(async () => {
      const res = await giftPackFromSheet(pickPack.id, friendId);
      setNote(res);
      if (res.ok) {
        setSent((list) => [...list, pickPack.id]);
        setShelf((now) => (now ? { ...now, coins: now.coins - (pickPack.priceCoins ?? 0) } : now));
        setPickPack(null);
      }
    });

  const tile = (on: boolean, dim: boolean) =>
    `flex flex-col items-center gap-2 rounded-2xl bg-paper px-2 pb-3 pt-3.5 ${dim ? "opacity-55" : ""}`;

  return (
    <Sheet title={`أهدِ ${friendName}`} onClose={onClose}>
      {note?.error ? (
        <p role="alert" className="mb-3 rounded-xl bg-clay-soft px-4 py-3 text-[12.5px] font-medium text-clay-ink">
          {note.error}
        </p>
      ) : null}
      {note?.ok ? (
        <p role="status" className="mb-3 rounded-xl px-4 py-3 text-[12.5px] font-medium" style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}>
          {note.ok}
        </p>
      ) : null}

      <p className="mb-2 text-[12.5px] font-semibold text-ink-2">إهداء التشارمز والإطارات والثيمات يُخصم من رصيد نقاطك</p>
      <p
        className="mb-3 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold"
        style={{ background: "var(--color-gold-soft)", borderColor: "var(--color-gold-line)", color: "var(--color-gold-ink)" }}
      >
        <SparkIcon size={14} />
        رصيدك {coinText(coins)}
      </p>

      <div className="no-bar mb-2.5 flex gap-2 overflow-x-auto">
        {tabs.map((row) => {
          const on = row.key === kind;
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => {
                setKind(row.key);
                setPick(null);
                setPickPack(null);
              }}
              className="shrink-0 rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold"
              style={{
                borderColor: on ? "var(--color-clay)" : "var(--color-line)",
                background: on ? "var(--color-clay)" : "var(--color-card)",
                color: on ? "var(--color-on-brand)" : "var(--color-ink-2)",
              }}
            >
              {row.label}
            </button>
          );
        })}
      </div>

      <div className="max-h-[42vh] overflow-y-auto pb-2">
        {!shelf && !note?.error ? <p className="py-6 text-center text-[12.5px] text-muted">…</p> : null}

        {kind === "STICKER" ? (
          <div className="grid grid-cols-3 gap-3">
            {(shelf?.packs ?? []).map((pack) => {
              const already = packOwned.has(pack.id);
              const chosen = pickPack?.id === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  disabled={already || busy}
                  onClick={() => {
                    setNote(null);
                    setPickPack(pack);
                  }}
                  className={tile(chosen, already)}
                  style={{ border: chosen ? "2px solid var(--color-clay)" : "1px solid var(--color-line)" }}
                >
                  <span className="grid h-[60px] w-[60px] grid-cols-2 gap-0.5">
                    {pack.stickers.slice(0, 4).map((one) => (
                      <img key={one.id} src={media(one.mediaId)} alt="" className="h-[29px] w-[29px] object-contain" />
                    ))}
                  </span>
                  <span className="max-w-full truncate text-[11.5px] font-medium text-ink">{pack.name}</span>
                  <span className="text-[10.5px] font-semibold text-clay-ink">{already ? "عنده" : coinText(pack.priceCoins ?? 0)}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {kind !== "STICKER" && shelf && sections.length === 0 ? (
          <p className="mt-4 text-center text-[12.5px] text-muted">ما فيه {tab.label} بعد.</p>
        ) : null}

        {kind !== "STICKER"
          ? sections.map((section) => (
              <div key={section.title || "all"} className="mb-3">
                {section.title ? <p className="mb-2 text-[13px] font-bold text-ink">{section.title}</p> : null}
                <div className="grid grid-cols-3 gap-3">
                  {section.items.map((item) => {
                    const already = has.has(item.id) && !item.plans?.length;
                    // ما يُكتسب بالوقت لا يُهدى، ولا صنفُ «آثار+» لمن ليس مشتركاً.
                    const locked = item.earnedAfterDays !== null || (item.plusOnly && !friendIsPlus);
                    const chosen = pick?.id === item.id;
                    const round = item.kind !== "CHARM";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={already || locked || busy}
                        onClick={() => {
                          setNote(null);
                          setPick(item);
                          setPlanId(item.plans?.[0]?.id ?? null);
                        }}
                        className={tile(chosen, already || locked)}
                        style={{ border: chosen ? "2px solid var(--color-clay)" : "1px solid var(--color-line)" }}
                      >
                        <span
                          className={`block h-[58px] w-[58px] overflow-hidden ${round ? "rounded-full" : ""}`}
                          style={{
                            padding: item.mediaId ? 0 : 3,
                            background: item.mediaId && !round ? "transparent" : firstColor(item.spec),
                          }}
                        >
                          {item.mediaId ? (
                            <img
                              src={media(item.mediaId)}
                              alt=""
                              className={`h-[58px] w-[58px] ${item.kind === "CHARM" || item.kind === "FRAME" ? "object-contain" : "object-cover"}`}
                            />
                          ) : (
                            <span className="block h-full w-full rounded-full bg-card" />
                          )}
                        </span>
                        <span className="max-w-full truncate text-[11.5px] font-medium text-ink">{item.name}</span>
                        <span className="text-[10.5px] font-semibold text-clay-ink">
                          {already
                            ? "عنده"
                            : item.earnedAfterDays !== null
                              ? `يُكتسب بـ${ar(item.earnedAfterDays)} يوم`
                              : item.plusOnly && !friendIsPlus
                                ? "لمشتركي آثار+"
                                : item.plans?.length
                                  ? `من ${coinText(price(Math.min(...item.plans.map((one) => one.priceCoins))))}`
                                  : coinText(price(item.priceCoins))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          : null}
      </div>

      {/* المجموعةُ المختارة: ملصقاتُها كلُّها ثمّ «أهدِ» — ما يُهدى يُرى قبل شرائه. */}
      {pickPack ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-[13.5px] font-bold text-ink">
            {pickPack.name} · {ar(pickPack.stickers.length)} ملصق
          </p>
          <div className="no-bar flex gap-1.5 overflow-x-auto">
            {pickPack.stickers.map((one) => (
              <img key={one.id} src={media(one.mediaId)} alt="" className="h-12 w-12 shrink-0 object-contain" />
            ))}
          </div>
          <button
            type="button"
            disabled={busy || coins < (pickPack.priceCoins ?? 0)}
            onClick={giftPack}
            className="h-[46px] rounded-xl text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            {busy ? "نُهدي…" : coins < (pickPack.priceCoins ?? 0) ? "رصيدك لا يكفي" : `أهدِ بـ${coinText(pickPack.priceCoins ?? 0)}`}
          </button>
        </div>
      ) : null}

      {/* الصنفُ المختار: مدّتُه إن كان له مُدَد، ثمّ «أهدِ». */}
      {pick ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-[13.5px] font-bold text-ink">{pick.name}</p>
          {plans.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {plans.map((one) => {
                const on = plan?.id === one.id;
                return (
                  <button
                    key={one.id}
                    type="button"
                    onClick={() => setPlanId(one.id)}
                    className="rounded-full border px-3 py-[7px] text-[12px] text-ink"
                    style={{
                      borderColor: on ? "var(--color-clay)" : "var(--color-line)",
                      background: on ? "var(--color-clay-soft)" : "var(--color-card)",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {daysLabel(one.days)} · {coinText(price(one.priceCoins))}
                  </button>
                );
              })}
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy || coins < pickPrice}
            onClick={gift}
            className="h-[46px] rounded-xl text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--color-clay)", color: "var(--color-on-brand)" }}
          >
            {busy ? "نُهدي…" : coins < pickPrice ? "رصيدك لا يكفي" : `أهدِ بـ${coinText(pickPrice)}`}
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
