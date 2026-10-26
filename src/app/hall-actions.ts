"use server";

import { currentUser } from "@/lib/auth";
import { apiAs, BridgeError } from "@/lib/api-bridge";
import { canTryStickers } from "@/lib/stickers";

/**
 * صدى اللوحة كاملاً لنافذة القاعة (القاعدة ٣٥٠): من تفاعل ومن علّق — من اللحظة نفسها في
 * الخادم (`/v1/moments/:id`) بشرط رؤيتها هناك، لا نسخةٌ هنا. الأرشيفُ يحمل اثني عشر وجهاً.
 */
export type HallReaction = { userId: string; kind: string; emoji: string | null; name: string; avatarMediaId: string | null; mine: boolean };
export type HallComment = {
  id: string;
  body: string;
  createdAt: string;
  sticker?: { mediaId: string } | null;
  user: { id: string; name: string; avatarMediaId: string | null };
};

export async function hallEcho(momentId: string): Promise<{ reactions: HallReaction[]; comments: HallComment[] } | { error: string }> {
  const user = await currentUser();
  if (!user) return { error: "سجّل الدخول" };
  if (!canTryStickers(user)) return { error: "غير متاح بعد" };
  if (!/^[\w-]{1,64}$/.test(momentId)) return { error: "غير موجودة" };
  try {
    const { moment } = await apiAs<{ moment: { reactions: HallReaction[]; comments: HallComment[] } }>(user.id, `/v1/moments/${momentId}`);
    return { reactions: moment.reactions ?? [], comments: moment.comments ?? [] };
  } catch (error) {
    if (error instanceof BridgeError) return { error: error.message };
    throw error;
  }
}
