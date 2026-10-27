import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";

/**
 * معاينةُ رابطٍ في لحظةٍ أو رسالة (القاعدة ٣٦٦): عنوانٌ ووصفٌ واسمُ الموقع
 * وصورةٌ مصغّرة، تُقرأ من وسوم Open Graph في صفحته.
 *
 * **النداءُ من خادمنا لا من الجهاز** كالأماكن (القاعدة ١٢٨): جهازٌ يجلب
 * صفحةَ الرابط بنفسه يُعطي عنوانَ صاحبه لكلّ موقعٍ أرسله أحدٌ في محادثة.
 * **والصورةُ تُصغَّر هنا وتُرسل في الردّ نفسه** (`data:` بنحو عشرة كيلو)
 * لا رابطاً إليها: رابطٌ خارجيّ يجلبه الجهاز يعيد التسريب نفسه.
 *
 * **والخادمُ لا يُسأل عن شبكته**: الرابطُ يكتبه المستخدم، فبلا حارسٍ يصير
 * بابُ المعاينة طريقاً إلى ما خلف الجدار (`127.0.0.1`، شبكةُ الخادم
 * الداخليّة، عنوانُ بيانات السحابة). فـhttp وhttps وحدهما، والمنفذان
 * المعتادان، وكلُّ عنوانٍ يُحلّ قبل الطلب ويُردّ إن كان خاصّاً — وكذلك كلُّ
 * تحويلةٍ تُتبَع بيدنا لا بـ`fetch`. ومهلةٌ وسقفُ بايتات: صفحةٌ لا تنتهي
 * لا تحبس خيطاً.
 */
export type LinkPreview = {
  url: string;
  site: string;
  title: string | null;
  description: string | null;
  image: string | null;
};

const TIMEOUT_MS = 6000;
const HTML_CAP = 512 * 1024;
const IMAGE_CAP = 4 * 1024 * 1024;
const MAX_HOPS = 4;
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 800;

const cache = new Map<string, { at: number; value: LinkPreview | null }>();

/** أوّلُ رابطٍ في نصّ — المعاينةُ لواحد، كما في الرسائل. */
export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const hit = text.match(/https?:\/\/[^\s<>"'«»]+/i);
  if (!hit) return null;
  // علامةُ ترقيمٍ في آخر الجملة ليست من الرابط.
  return hit[0].replace(/[).,!?؛،:]+$/u, "");
}

export async function linkPreview(raw: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!safeShape(url)) return null;
  url.hash = "";
  const key = url.toString();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let value: LinkPreview | null = null;
  try {
    value = await build(url);
  } catch {
    value = null;
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function build(start: URL): Promise<LinkPreview | null> {
  const page = await fetchSafe(start, "text/html,application/xhtml+xml", HTML_CAP);
  if (!page) return null;
  const type = page.type.toLowerCase();

  // رابطٌ إلى صورةٍ مباشرة: الصورةُ هي المعاينة.
  if (type.startsWith("image/")) {
    return { url: page.url.toString(), site: hostOf(page.url), title: null, description: null, image: await thumb(page.bytes) };
  }
  if (!type.includes("html")) return null;

  const html = decode(page.bytes, type);
  const meta = readMeta(html);
  const title = clean(meta["og:title"] ?? meta["twitter:title"] ?? titleTag(html), 140);
  const description = clean(meta["og:description"] ?? meta["twitter:description"] ?? meta["description"], 220);
  const site = clean(meta["og:site_name"], 60) ?? hostOf(page.url);

  let image: string | null = null;
  const imageRef = meta["og:image:secure_url"] ?? meta["og:image"] ?? meta["twitter:image"] ?? meta["twitter:image:src"];
  if (imageRef) {
    try {
      const imageUrl = new URL(imageRef, page.url);
      if (safeShape(imageUrl)) {
        const got = await fetchSafe(imageUrl, "image/*", IMAGE_CAP);
        if (got && got.type.toLowerCase().startsWith("image/")) image = await thumb(got.bytes);
      }
    } catch {
      image = null;
    }
  }

  if (!title && !description && !image) return null;
  return { url: page.url.toString(), site, title, description, image };
}

/** مصغّرةٌ ٣٢٠ على الأطول JPEG — تُرسم في قرصٍ صغير، فما فوقها وزنٌ بلا فائدة. */
async function thumb(bytes: Buffer): Promise<string | null> {
  try {
    const out = await sharp(bytes, { animated: false, limitInputPixels: 40_000_000 })
      .rotate()
      .resize(320, 320, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 70 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

function safeShape(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "80" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  return true;
}

/** يُحلّ الاسمُ ويُردّ إن كان أيٌّ من عناوينه خاصّاً — قبل كلّ طلبٍ وكلّ تحويلة. */
async function publicHost(host: string): Promise<boolean> {
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return !privateIp(bare);
  try {
    const all = await lookup(bare, { all: true, verbatim: true });
    return all.length > 0 && all.every((one) => !privateIp(one.address));
  } catch {
    return false;
  }
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const low = ip.toLowerCase();
  if (low === "::" || low === "::1") return true;
  const mapped = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateIp(mapped[1]);
  return low.startsWith("fc") || low.startsWith("fd") || low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb") || low.startsWith("ff");
}

type Got = { url: URL; type: string; bytes: Buffer };

async function fetchSafe(start: URL, accept: string, cap: number): Promise<Got | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (!safeShape(url) || !(await publicHost(url.hostname))) return null;
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept,
        "accept-language": "ar,en;q=0.8",
        // بعضُ المواقع لا تُعطي وسومَها إلا لزاحفٍ معروف الاسم.
        "user-agent": "Mozilla/5.0 (compatible; AtharLinkPreview/1.0; +https://atharmts.com)",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!next) return null;
      url = new URL(next, url);
      continue;
    }
    if (!res.ok || !res.body) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > cap) {
      await res.body.cancel().catch(() => {});
      return null;
    }
    const bytes = await readCapped(res.body, cap);
    return { url, type: res.headers.get("content-type") ?? "", bytes };
  }
  return null;
}

/** يقرأ حتى السقف ويقطع — رأسُ الصفحة فيه الوسوم، وما بعده لا يلزم. */
async function readCapped(body: ReadableStream<Uint8Array>, cap: number): Promise<Buffer> {
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    parts.push(value);
    size += value.length;
    if (size >= cap) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return Buffer.concat(parts).subarray(0, cap);
}

function decode(bytes: Buffer, type: string): string {
  const charset = type.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
  try {
    return new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function readMeta(html: string): Record<string, string> {
  const head = html.slice(0, 200_000);
  const out: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attr(tag, "property") ?? attr(tag, "name");
    const content = attr(tag, "content");
    if (!name || content == null) continue;
    const key = name.toLowerCase();
    if (!(key in out)) out[key] = content;
  }
  return out;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return null;
  return entities(m[2] ?? m[3] ?? m[4] ?? "");
}

function titleTag(html: string): string | undefined {
  const m = html.slice(0, 200_000).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? entities(m[1]) : undefined;
}

function entities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => safeChar(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => safeChar(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function safeChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function clean(text: string | undefined, max: number): string | null {
  if (!text) return null;
  const one = text.replace(/\s+/g, " ").trim();
  if (!one) return null;
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}
