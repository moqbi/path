import "server-only";
import { prisma } from "@/lib/db";

/**
 * فلترة المحتوى في الويب — نسخةٌ من `apps/api/src/lib/moderation.ts`.
 *
 * القائمة واحدة في القاعدة، فما يمنعه المشرف يُمنع في البابين. والويب
 * يبقى يعمل حتى يتقاعد (الخطوة ٩ في `MIGRATION.md`)، فلا يُترك بلا
 * فلترة لأنّ خليفته مفلتَر.
 */
const TTL = 60_000;
let cache: { at: number; words: { word: string; hard: boolean }[] } = { at: 0, words: [] };

async function words() {
  if (Date.now() - cache.at < TTL) return cache.words;
  const rows = await prisma.bannedWord.findMany({ select: { word: true, hard: true } });
  cache = { at: Date.now(), words: rows };
  return rows;
}

/** التطبيع قبل المطابقة: الهمزات والتاء المربوطة والتشكيل والتطويل تُسوّى. */
export function normalize(text: string): string {
  return text
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export async function screen(
  text: string | null | undefined,
): Promise<{ blocked: boolean; flagged: boolean; word: string | null }> {
  const clean = normalize(text ?? "");
  if (!clean) return { blocked: false, flagged: false, word: null };

  for (const row of await words()) {
    const needle = normalize(row.word);
    if (!needle) continue;
    const bounded = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "u");
    if (bounded.test(clean)) return { blocked: row.hard, flagged: true, word: row.word };
  }

  return { blocked: false, flagged: false, word: null };
}

/** يرمي حين تُمنع الكلمة — والإجراء يردّها رسالةً لمن يستدعيه من زرّ. */
export async function guard(text: string | null | undefined): Promise<void> {
  const verdict = await screen(text);
  if (verdict.blocked) throw new Error("فيه كلمة ما تنفع هنا. عدّلها ونشرها.");
}
