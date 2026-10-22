"use server";

import { currentUser } from "@/lib/auth";
import { apiAs, BridgeError } from "@/lib/api-bridge";
import { canTryStickers } from "@/lib/stickers";

/**
 * البحثُ الذكيّ في الويب (القاعدة ٣٣٥) — من الخادم نفسه (`apiAs` ← `/v1/search`) لا
 * نسخةٌ هنا: سطرٌ واحد يُفكّ بقاعدةٍ واحدة، فلا يجد الويبُ غيرَ ما يجده الجوّال. وشرطُ
 * الرؤية هناك (`visibleWhere`). وللمالك وممنوحي اللوحة كلّها مقابلَ نسخة التطوير.
 */

export type SearchMoment = {
  id: string;
  kind: string;
  text: string | null;
  placeName: string | null;
  placeCity: string | null;
  musicTitle: string | null;
  musicArtist: string | null;
  mediaId: string | null;
  createdAt: string;
  author: { name: string; avatarMediaId: string | null };
};

export type SearchResult = {
  friends: { id: string; name: string; avatarMediaId: string | null; together: number | null }[];
  places: { name: string; city: string | null; count: number }[];
  cities: { name: string; count: number }[];
  moments: SearchMoment[];
  suggest?: boolean;
};

export async function smartSearch(q: string): Promise<SearchResult | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "سجّل الدخول" };
  if (!canTryStickers(user)) return { error: "غير متاح بعد" };
  try {
    // الويبُ يرسم أنواعَ اللحظات كلَّها (القاعدة ٢٢٦).
    return await apiAs<SearchResult>(user.id, `/v1/search?q=${encodeURIComponent(q.slice(0, 120))}`, {
      method: "GET",
      headers: { "x-moment-kinds": "99" },
    });
  } catch (error) {
    return { error: error instanceof BridgeError || error instanceof Error ? error.message : "تعذّر البحث" };
  }
}

export type PromoItem = {
  id: string;
  name: string;
  kind: string;
  mediaId: string | null;
  promoMediaId?: string | null;
  promoText: string | null;
  priceCoins: number;
  plusOnly?: boolean;
  plans?: { priceCoins: number }[];
};
export type PromoPack = {
  id: string;
  name: string;
  priceCoins: number;
  owned: boolean;
  stickers: { id: string; mediaId: string }[];
};

/**
 * بطاقةُ الإعلان عند الفتح في الويب (القاعدتان ٢٦٧ و٣٣٥) — من الخادم نفسه، فما رُئي في
 * الجوّال لا يُعاد في المتصفّح (`promoSeenAt` واحد). ومجموعاتُ الملصقات لمن يجرّبها وحده.
 */
export async function openingPromo(): Promise<{ item: PromoItem | null; pack: PromoPack | null }> {
  const user = await currentUser();
  if (!user) return { item: null, pack: null };
  try {
    const packs = canTryStickers(user) ? "?packs=1" : "";
    const res = await apiAs<{ item: PromoItem | null; pack?: PromoPack | null }>(user.id, `/v1/store/promo${packs}`);
    return { item: res.item, pack: res.pack ?? null };
  } catch {
    return { item: null, pack: null };
  }
}

export async function promoSeen(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await apiAs(user.id, "/v1/store/promo/seen", { method: "POST" }).catch(() => {});
}
