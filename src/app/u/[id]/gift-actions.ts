"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { apiAs, BridgeError } from "@/lib/api-bridge";
import { canTryStickers } from "@/lib/stickers";

/**
 * نافذةُ الإهداء في الويب من الخادم نفسه (`apiAs`) — **بقرار المالك** (القاعدة ٢٩٩): المتجرُ
 * كلُّه بمُدَده ومجموعاته، والملصقاتُ المدفوعة (القاعدة ٢٩٨)، بشروط بابٍ واحد. كان الويبُ
 * يُهدي الإطاراتِ وحدها ويردّ ما له مُدَد «من التطبيق». وآثار+ هديةً بمالٍ من متجر آبل
 * (القاعدة ٢٣٤) لا يُفتح في متصفّح.
 */

export type GiftItem = {
  id: string;
  kind: "FRAME" | "BACKGROUND" | "THEME" | "CHARM" | "BUNDLE";
  name: string;
  priceCoins: number;
  spec: string;
  mediaId: string | null;
  plusOnly: boolean;
  earnedAfterDays: number | null;
  collectionId?: string | null;
  plans?: { id: string; days: number; priceCoins: number }[];
};
export type GiftPack = { id: string; name: string; priceCoins?: number; stickers: { id: string; mediaId: string }[] };
export type GiftShelf = {
  isPlus: boolean;
  coins: number;
  items: GiftItem[];
  collections: { id: string; name: string; kind: string | null }[];
  packs: GiftPack[];
  packsOwned: string[];
};

const said = (error: unknown) => ({ error: error instanceof BridgeError || error instanceof Error ? error.message : "تعذّر الإهداء" });

export async function giftShelf(friendId: string): Promise<GiftShelf | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "سجّل الدخول" };
  try {
    const store = await apiAs<{ isPlus: boolean; coins: number; items: GiftItem[]; collections?: GiftShelf["collections"] }>(user.id, "/v1/store");
    // الملصقاتُ في الويب لمن يجرّبها وحده (القاعدة ٢٩١) — كزرّها في المحادثة.
    let packs: GiftPack[] = [];
    let packsOwned: string[] = [];
    if (canTryStickers(user)) {
      const all = await apiAs<{ packs: GiftPack[] }>(user.id, "/v1/stickers").catch(() => ({ packs: [] }));
      packs = all.packs.filter((pack) => (pack.priceCoins ?? 0) > 0);
      if (packs.length) {
        packsOwned = (await apiAs<{ owned: string[] }>(user.id, `/v1/stickers/owned/${encodeURIComponent(friendId)}`).catch(() => ({ owned: [] }))).owned;
      }
    }
    return { isPlus: store.isPlus, coins: store.coins, items: store.items, collections: store.collections ?? [], packs, packsOwned };
  } catch (error) {
    return said(error);
  }
}

export async function giftFromSheet(itemId: string, friendId: string, plan?: string): Promise<{ ok?: string; error?: string }> {
  const user = await currentUser();
  if (!user) return { error: "سجّل الدخول" };
  try {
    const res = await apiAs<{ ok?: string }>(user.id, `/v1/store/${encodeURIComponent(itemId)}/gift`, {
      method: "POST",
      body: plan ? { to: friendId, plan } : { to: friendId },
    });
    revalidatePath(`/u/${friendId}`);
    revalidatePath("/me");
    revalidatePath("/");
    return { ok: res.ok ?? "وصلته الهدية" };
  } catch (error) {
    return said(error);
  }
}

export async function giftPackFromSheet(packId: string, friendId: string): Promise<{ ok?: string; error?: string }> {
  const user = await currentUser();
  if (!user) return { error: "سجّل الدخول" };
  if (!canTryStickers(user)) return { error: "غير موجودة" };
  try {
    const res = await apiAs<{ ok?: string }>(user.id, `/v1/stickers/packs/${encodeURIComponent(packId)}/gift`, {
      method: "POST",
      body: { to: friendId },
    });
    revalidatePath(`/u/${friendId}`);
    revalidatePath("/");
    return { ok: res.ok ?? "وصلته الهدية" };
  } catch (error) {
    return said(error);
  }
}
