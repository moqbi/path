/**
 * متنُ مقال المدونة كتلٌ لا HTML (القاعدة ٤٩٠).
 *
 * المحرّرُ في اللوحة يكتبها، والصفحةُ العامّة ترسمها عناصرَ React — فلا يصل إلى
 * صفحةٍ يقرؤها الناس وسمٌ لم نكتبه نحن، ولا حاجةَ إلى منظّف HTML يُحدَّث ويُخطئ.
 * والتنسيقُ داخل السطر ثلاثة: **عريض** و*مائل* و[رابط](https://…).
 * ملفٌّ بلا قاعدة: يقرؤه مكوّنُ العميل (المحرّر) والخادمُ معاً (القاعدة ١١٢).
 */
import { z } from "zod";

export const BLOG_TITLE_MAX = 120;
export const BLOG_EXCERPT_MAX = 220;
export const BLOG_CATEGORY_MAX = 40;
export const BLOG_BLOCKS_MAX = 300;
const TEXT_MAX = 6000;

const text = z.string().max(TEXT_MAX);
const id = z.string().regex(/^[a-z0-9]{10,40}$/i);

export const blockSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("p"), text }),
  z.object({ t: z.literal("h2"), text: z.string().max(200) }),
  z.object({ t: z.literal("h3"), text: z.string().max(200) }),
  z.object({ t: z.literal("quote"), text }),
  z.object({ t: z.literal("tip"), text }),
  z.object({ t: z.literal("ul"), items: z.array(z.string().max(1000)).max(50) }),
  z.object({ t: z.literal("ol"), items: z.array(z.string().max(1000)).max(50) }),
  z.object({ t: z.literal("img"), mediaId: id, caption: z.string().max(300) }),
  z.object({ t: z.literal("hr") }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockKind = Block["t"];

export const blocksSchema = z.array(blockSchema).max(BLOG_BLOCKS_MAX);

export const BLOCK_LABEL: Record<BlockKind, string> = {
  p: "فقرة",
  h2: "عنوان",
  h3: "عنوان فرعي",
  quote: "اقتباس",
  tip: "تنبيه",
  ul: "قائمة نقطية",
  ol: "قائمة مرقّمة",
  img: "صورة",
  hr: "فاصل",
};

/** يقرأ ما حُفظ في القاعدة: ما فسد يُترك ولا يُسقط الصفحة. */
export function readBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const one of raw) {
    const parsed = blockSchema.safeParse(one);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export type Inline =
  | { k: "text"; v: string }
  | { k: "b"; v: string }
  | { k: "i"; v: string }
  | { k: "a"; v: string; href: string };

/**
 * التنسيقُ داخل السطر. والرابطُ http/https وحدهما — `javascript:` نصٌّ يُقرأ لا رابط
 * (القاعدة ١١٠). والمسارُ داخل الموقع (`/…`) يُقبل.
 */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ k: "text", v: source.slice(last, at) });
    if (match[1]) out.push({ k: "b", v: match[1] });
    else if (match[2]) out.push({ k: "i", v: match[2] });
    else if (match[3] && match[4]) {
      const href = match[4];
      if (/^https?:\/\//i.test(href) || /^\/(?!\/)/.test(href)) out.push({ k: "a", v: match[3], href });
      else out.push({ k: "text", v: match[0] });
    }
    last = at + match[0].length;
  }
  if (last < source.length) out.push({ k: "text", v: source.slice(last) });
  return out;
}

/** نصُّ المقال خاماً بلا علامات — لوقت القراءة ولما يُستخرج سطراً. */
export function plainText(blocks: Block[]): string {
  const strip = (value: string) => parseInline(value).map((one) => one.v).join("");
  return blocks
    .map((block) => {
      if ("text" in block) return strip(block.text);
      if ("items" in block) return block.items.map(strip).join(" ");
      if (block.t === "img") return block.caption;
      return "";
    })
    .join(" ");
}

/** دقائقُ القراءة: مئتا كلمةٍ في الدقيقة للعربيّة، ودقيقةٌ على الأقلّ. */
export function readingMinutes(blocks: Block[]): number {
  const words = plainText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * عنوانُ المقال في الرابط: من عنوانه بحروفه — العربيّةُ تبقى عربيّة، والمتصفّحُ يرمّزها.
 * ما ليس حرفاً أو رقماً يصير شرطة، ولا شرطتان متتاليتان، وستّون حرفاً على الأكثر.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** معرّفاتُ الصور في المتن — ما سواها من صور المقال يُكنس عند الحفظ. */
export function blockImages(blocks: Block[]): string[] {
  return blocks.flatMap((block) => (block.t === "img" ? [block.mediaId] : []));
}
