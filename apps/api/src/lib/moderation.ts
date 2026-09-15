import { prisma } from "@athar/db";

/**
 * فلترة المحتوى: قائمة كلماتٍ يكتبها المشرف، ومراجعةٌ يدويّة بعدها.
 *
 * لا نموذجَ يتعلّم ولا خدمةً خارجية: الجمهور عربيّ والسياق خليجيّ،
 * ونموذجٌ لا يعرفهما يمنع البريء ويمرّر ما لا يُقال. والقائمة تُدار من
 * اللوحة بلا نشر نسخة.
 *
 * درجتان: `hard` تمنع النشر في وجه صاحبه، وما دونها يمرّ ويُعلَّم
 * للمراجعة — لا نمنع كلمةً قد تُقال في سياقٍ بريء، ولا نترك ما لا يُقال.
 */
export type Verdict = { blocked: boolean; flagged: boolean; word: string | null };

/**
 * القائمة تُقرأ مرّةً كل دقيقة لا مع كل رسالة.
 *
 * كل حرفٍ يُكتب في محادثةٍ كان سيصير استعلاماً، ودقيقةٌ من التأخّر في
 * ظهور كلمةٍ جديدة لا تضرّ — المراجعة اليدوية خلفها على أي حال.
 */
let cache: { at: number; words: { word: string; hard: boolean }[] } = { at: 0, words: [] };
const TTL = 60_000;

async function words() {
  if (Date.now() - cache.at < TTL) return cache.words;
  const rows = await prisma.bannedWord.findMany({ select: { word: true, hard: true } });
  cache = { at: Date.now(), words: rows };
  return rows;
}

/** يُنسى المحفوظ فوراً بعد تعديل القائمة، فلا ينتظر المشرف دقيقة. */
export function forgetWords() {
  cache = { at: 0, words: [] };
}

/**
 * التطبيع قبل المطابقة.
 *
 * العربية تُكتب بألفٍ مهموزة وبلا همزة، وبتاءٍ مربوطة وهاء، وبتشكيلٍ
 * وتطويل — ومن أراد تجاوز القائمة كتب «الـكـلمة» بمدّات. فتُسوّى كلها
 * قبل البحث، وإلا صارت القائمة زينة.
 */
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

export async function screen(text: string | null | undefined): Promise<Verdict> {
  const clean = normalize(text ?? "");
  if (!clean) return { blocked: false, flagged: false, word: null };

  const list = await words();
  for (const row of list) {
    const needle = normalize(row.word);
    if (!needle) continue;
    // حدود الكلمة لا الاحتواء: «حسن» لا تُمنع لأنّ فيها حروف كلمةٍ أخرى.
    const bounded = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "u");
    if (bounded.test(clean)) {
      return { blocked: row.hard, flagged: true, word: row.word };
    }
  }

  return { blocked: false, flagged: false, word: null };
}

/** يرمي حين تُمنع الكلمة، فيقف النشر عند صاحبه لا بعد أن يُنشر. */
export async function guard(text: string | null | undefined): Promise<void> {
  const verdict = await screen(text);
  if (verdict.blocked) {
    const { badRequest } = await import("./errors");
    throw badRequest("فيه كلمة ما تنفع هنا. عدّلها ونشرها.");
  }
}
