import "server-only";

/**
 * يستخرج عنوان الأغنية من رابطها عبر oEmbed.
 *
 * oEmbed واجهة عامة بلا مفاتيح، فتعمل قبل أي اعتماد من المزوّد — وهذا ما
 * يجعل «أرسل الرابط» ممكناً اليوم بينما ربط الحساب ينتظر التسجيل.
 * الفشل لا يمنع النشر: يُحفظ الرابط وحده ويظل قابلاً للفتح.
 */
export type ResolvedTrack = {
  title: string | null;
  artist: string | null;
  thumb: string | null;
};

const ENDPOINTS: { test: RegExp; build: (url: string) => string }[] = [
  {
    test: /(^|\.)spotify\.com$/i,
    build: (url) => `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  },
  {
    test: /(^|\.)(youtube\.com|youtu\.be)$/i,
    build: (url) =>
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    test: /(^|\.)soundcloud\.com$/i,
    build: (url) =>
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
];

/**
 * ثلاث خدماتٍ لا أكثر: يوتيوب وساوندكلاود وسبوتيفاي.
 *
 * كانت تقبل أيّ رابطٍ http، فكان أيّ عنوانٍ يُنشر «أغنية» بلا عنوانٍ ولا
 * فنان — لأن oEmbed لا يعرفه. والقبول هنا يساوي القدرة على القراءة.
 */
export function isSupportedMusicUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return ENDPOINTS.some((one) => one.test.test(url.hostname));
  } catch {
    return false;
  }
}

/**
 * الرابطُ من نصّ المشاركة لا النصُّ كلّه (القاعدة ٤١٩): تطبيقُ ساوندكلاود
 * يشارك «Listen to … on #SoundCloud» ثمّ الرابط، فكان الحقلُ كلُّه يُقرأ
 * رابطاً فيُردّ. يُؤخذ أوّلُ رابطٍ مدعوم، وما لصق بآخره من ترقيمٍ يُترك.
 */
export function pickMusicUrl(raw: string): string | null {
  const text = raw.trim();
  if (isSupportedMusicUrl(text)) return text;
  for (const found of text.match(/https?:\/\/[^\s<>"'«»]+/gi) ?? []) {
    const url = found.replace(/[.,;:!?)\]}،]+$/u, "");
    if (isSupportedMusicUrl(url)) return url;
  }
  return null;
}

/** روابطُ المشاركة القصيرة: oEmbed لا يعرفها، فتُتبَع إلى صفحة المقطع. */
const SHORT_HOSTS = /^on\.soundcloud\.com$/i;
const LONG_HOSTS = /(^|\.)soundcloud\.com$/i;

/**
 * يُبدّل الرابطَ القصير بصفحته: تحويلةٌ بعد تحويلة بيدنا (ثلاثٌ على الأكثر)،
 * ولا تُقبل وجهةٌ خارج ساوندكلاود — فلا يصير البابُ طريقاً إلى عنوانٍ آخر.
 * والفشلُ يُبقي الرابطَ كما هو: يُنشر ويُفتح ولو بلا عنوان.
 */
export async function expandMusicUrl(raw: string): Promise<string> {
  let current = raw;
  try {
    for (let hop = 0; hop < 3; hop++) {
      const url = new URL(current);
      if (!SHORT_HOSTS.test(url.hostname)) break;
      const response = await fetch(current, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(5000) });
      const next = response.headers.get("location");
      if (!next) break;
      const target = new URL(next, current);
      if (target.protocol !== "https:" || !LONG_HOSTS.test(target.hostname)) break;
      current = target.toString();
    }
  } catch {
    return raw;
  }
  const final = new URL(current);
  if (SHORT_HOSTS.test(final.hostname)) return raw;
  // ما بعد «?» من ساوندكلاود تتبّعٌ للمشاركة (utm وsi) لا جزءٌ من المقطع.
  if (LONG_HOSTS.test(final.hostname) && final.search) {
    final.search = "";
    return final.toString();
  }
  return current;
}

export async function resolveTrack(raw: string): Promise<ResolvedTrack> {
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    return { title: null, artist: null, thumb: null };
  }

  const endpoint = ENDPOINTS.find((e) => e.test.test(host));
  if (!endpoint) return { title: null, artist: null, thumb: null };

  try {
    const response = await fetch(endpoint.build(raw), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return LONG_HOSTS.test(host) ? await soundCloudPage(raw) : { title: null, artist: null, thumb: null };

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    // سبوتيفاي تعيد العنوان وحده؛ يوتيوب وساوندكلاود تعيدان اسم الحساب أيضاً.
    return {
      title: data.title?.trim() || null,
      artist: data.author_name?.trim() || null,
      thumb: data.thumbnail_url?.trim() || null,
    };
  } catch {
    return { title: null, artist: null, thumb: null };
  }
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * مقطعٌ منع صاحبُه تضمينَه يردّ oEmbed عليه ٤٠٣ — فيُقرأ من صفحته نفسها:
 * `og:title` و`og:image`، والفنانُ من «Stream … by X | Listen…» في العنوان.
 * الصفحةُ من ساوندكلاود وحدها (`LONG_HOSTS`)، وبلا تحويلات، ونصفُ ميغا حدّاً.
 */
async function soundCloudPage(raw: string): Promise<ResolvedTrack> {
  const empty = { title: null, artist: null, thumb: null };
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !LONG_HOSTS.test(url.hostname) || SHORT_HOSTS.test(url.hostname)) return empty;
    const response = await fetch(url, {
      redirect: "error",
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; AtharBot/1.0)" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return empty;
    const html = (await response.text()).slice(0, 512_000);
    const meta = (key: string) =>
      html.match(new RegExp(`<meta[^>]+property="${key}"[^>]+content="([^"]*)"`, "i"))?.[1] ?? null;
    const title = meta("og:title");
    const image = meta("og:image");
    const artist = html.match(/<title>Stream [\s\S]*? by ([^|<]+?) \| Listen/i)?.[1] ?? null;
    return {
      title: title ? decode(title) || null : null,
      artist: artist ? decode(artist) || null : null,
      thumb: image?.startsWith("https://") ? decode(image) : null,
    };
  } catch {
    return empty;
  }
}
