"use server";

import { currentUser } from "@/lib/auth";
import { apiAs, BridgeError } from "@/lib/api-bridge";
import { requestFriend } from "@/app/actions";

/**
 * أبوابُ نافذة «إضافة صديق» في الويب (القاعدة ٢٨١). البحثُ و«من حولك» من الخادم
 * نفسه (`apiAs`) لا نسخةٌ هنا: المنارةُ في ذاكرته، ومن فتحها من الجوّال لا يُرى
 * من منارةٍ في ذاكرة الويب. وكلُّ إجراءٍ يفحص الجلسة بنفسه، ويردّ الخطأ نصّاً (القاعدة ٩٠).
 */

export type Found = {
  id: string;
  memberNo: number;
  name: string;
  handle: string | null;
  isPlus: boolean;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole: number | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
  tag: { name: string; bg: string; fg: string } | null;
  relation: "none" | "sent" | "incoming" | "friend";
};

type Result<T> = T | { error: string };

const said = (error: unknown) => ({ error: error instanceof BridgeError || error instanceof Error ? error.message : "تعذّر الطلب" });

export async function findFriends(q: string): Promise<Result<{ people: Found[] }>> {
  const user = await currentUser();
  if (!user) return { error: "سجّل الدخول" };
  try {
    return await apiAs<{ people: Found[] }>(user.id, "/v1/circle/find", { method: "POST", body: { q: q.slice(0, 60) } });
  } catch (error) {
    return said(error);
  }
}

export async function pingNearby(lat: number, lng: number): Promise<Result<{ people: Found[]; rang?: number }>> {
  const user = await currentUser();
  if (!user) return { error: "سجّل الدخول" };
  if (![lat, lng].every(Number.isFinite)) return { error: "موقعٌ غير صالح" };
  try {
    return await apiAs(user.id, "/v1/circle/nearby", { method: "POST", body: { lat, lng } });
  } catch (error) {
    return said(error);
  }
}

export async function leaveNearby(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await apiAs(user.id, "/v1/circle/nearby", { method: "DELETE" }).catch(() => undefined);
}

/** الإضافةُ من النافذة: طلبٌ يقبله صاحبُه، وطلبٌ مقابلٌ يُقبل بنفسه (القاعدة ٢٨٠). */
export async function addFromSheet(id: string): Promise<Result<{ ok: true }>> {
  try {
    await requestFriend(id);
    return { ok: true };
  } catch (error) {
    return said(error);
  }
}
