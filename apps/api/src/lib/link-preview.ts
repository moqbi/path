import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
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

/*
  الحارسُ في **الاتّصال نفسه** لا قبله: كان الاسمُ يُحلّ ويُفحص ثمّ يُطلب بـ`fetch`
  الذي يحلّه ثانيةً — واسمٌ يردّ عنواناً عامّاً للفحص وخاصّاً للطلب (DNS rebinding)
  كان يعبر إلى ما خلف الجدار. الآن `lookup` الطلبِ هو الذي يفحص، فما يُتّصل به هو
  ما فُحص. و`BlockList` يفهم صيغَ IPv6 كلَّها والمعيّنةَ من IPv4 (`::ffff:7f00:1`).
*/
const BLOCKED = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) BLOCKED.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) BLOCKED.addSubnet(net, bits, "ipv6");

export function privateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return BLOCKED.check(ip, "ipv4");
  if (kind === 6) {
    // المعيّنُ من IPv4 يُفحص بعنوانه الرباعيّ: `::ffff:8.8.8.8` عامٌّ لا خاصّ.
    const low = ip.toLowerCase();
    const dotted = low.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return BLOCKED.check(dotted[1], "ipv4");
    const hex = low.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return BLOCKED.check(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, "ipv4");
    }
    return BLOCKED.check(ip, "ipv6");
  }
  return true;
}

/** `lookup` للطلب: يحلّ ويرفض ما كان خاصّاً، فالاتّصالُ بما فُحص وحده. */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as unknown as LookupAddress[];
    if (!list.length || list.some((one) => privateIp(one.address))) {
      return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 0);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

type Got = { url: URL; type: string; bytes: Buffer };

async function fetchSafe(start: URL, accept: string, cap: number): Promise<Got | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (!safeShape(url)) return null;
    // عنوانٌ مكتوبٌ رقماً لا يمرّ بـ`lookup` أصلاً — فيُفحص هنا.
    const bare = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(bare) && privateIp(bare)) return null;
    const res = await request(url, accept, cap);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) return null;
      url = new URL(res.location, url);
      continue;
    }
    if (res.status < 200 || res.status >= 300) return null;
    return { url, type: res.type, bytes: res.bytes };
  }
  return null;
}

type Raw = { status: number; location: string | null; type: string; bytes: Buffer };

/** طلبٌ واحد بلا تحويلات، بمهلةٍ وسقفِ بايتات — والتحويلةُ يتبعها `fetchSafe` بحارسه. */
function request(url: URL, accept: string, cap: number): Promise<Raw | null> {
  return new Promise((resolve) => {
    const get = url.protocol === "https:" ? httpsGet : httpGet;
    let done = false;
    const finish = (value: Raw | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const req = get(
      url,
      {
        lookup: guardedLookup,
        headers: {
          accept,
          "accept-language": "ar,en;q=0.8",
          // بعضُ المواقع لا تُعطي وسومَها إلا لزاحفٍ معروف الاسم.
          "user-agent": "Mozilla/5.0 (compatible; AtharLinkPreview/1.0; +https://atharmts.com)",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        const type = String(res.headers["content-type"] ?? "");
        if (status < 200 || status >= 300 || Number(res.headers["content-length"] ?? 0) > cap) {
          res.destroy();
          return finish({ status, location, type, bytes: Buffer.alloc(0) });
        }
        const parts: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          parts.push(chunk);
          size += chunk.length;
          // رأسُ الصفحة فيه الوسوم، وما بعد السقف لا يلزم.
          if (size >= cap) {
            res.destroy();
            finish({ status, location, type, bytes: Buffer.concat(parts).subarray(0, cap) });
          }
        });
        res.on("end", () => finish({ status, location, type, bytes: Buffer.concat(parts) }));
        res.on("error", () => finish(null));
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      finish(null);
    }, TIMEOUT_MS);
    req.on("error", () => finish(null));
  });
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
