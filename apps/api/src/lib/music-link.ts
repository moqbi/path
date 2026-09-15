

/**
 * يستخرج عنوان الأغنية من رابطها عبر oEmbed.
 *
 * نسخةٌ بلا حارس `server-only`: ذاك وسمُ Next، وهذه تعمل تحت node وحده.
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
    if (!response.ok) return { title: null, artist: null, thumb: null };

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
