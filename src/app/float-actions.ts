"use server";

import { currentUser } from "@/lib/auth";
import { apiAs, BridgeError } from "@/lib/api-bridge";
import { canTryStickers } from "@/lib/stickers";

/**
 * ما يطفو على القصّة والنوت في الويب (القاعدة ٣٤٤) — من الخادم نفسه (`apiAs`) لا نسخةٌ هنا:
 * التعليقُ بلا اسمٍ واحدٌ في الوجهين، وشرطُ الرؤية والحدُّ والكلماتُ هناك. للمالك وممنوحي
 * اللوحة كلّها مقابلَ نسخة التطوير.
 */

export type FloatComment = { id: string; body: string; at: string; mine: boolean; canDelete: boolean };
export type Floats = { reactions: { kind: string; at: string }[]; comments: FloatComment[] };
type Kind = "story" | "note";

const path = (kind: Kind, id: string) => (kind === "story" ? `/v1/stories/${id}` : `/v1/notes/${id}`);
const clean = (id: string) => /^[a-z0-9]{20,40}$/i.test(id);

async function allowed() {
  const user = await currentUser();
  return user && canTryStickers(user) ? user : null;
}

export async function readFloats(kind: Kind, id: string): Promise<Floats | null> {
  const user = await allowed();
  if (!user || !clean(id)) return null;
  try {
    return await apiAs<Floats>(user.id, `${path(kind, id)}/floats`);
  } catch {
    return null;
  }
}

export async function sendFloatComment(kind: Kind, id: string, body: string): Promise<FloatComment | { error: string }> {
  const user = await allowed();
  if (!user || !clean(id)) return { error: "غير متاح" };
  try {
    return await apiAs<FloatComment>(user.id, `${path(kind, id)}/comments`, { method: "POST", body: { body: body.slice(0, 200) } });
  } catch (error) {
    return { error: error instanceof BridgeError ? error.message : "تعذّر الإرسال" };
  }
}

export async function dropFloatComment(commentId: string): Promise<{ ok: true } | { error: string }> {
  const user = await allowed();
  if (!user || !clean(commentId)) return { error: "غير متاح" };
  try {
    await apiAs(user.id, `/v1/stories/comments/${commentId}`, { method: "DELETE" });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof BridgeError ? error.message : "تعذّر الحذف" };
  }
}
