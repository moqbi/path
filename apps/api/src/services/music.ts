import { badRequest, notFound } from "../lib/errors";

/**
 * الأغاني من دِيزر (القاعدة ٢٦٩) — من خادمنا لا من الجهاز.
 *
 * واجهتُهم العامّة بلا مفتاح، ومن هنا يُضبط الحدّ ولا تخرج طلباتُ الناس إلى
 * طرفٍ ثالث من أجهزتهم (كالأماكن — القاعدة ١٢٨). ومعاينةُ كلّ أغنيةٍ ثلاثون
 * ثانية برابطٍ موقَّعٍ لساعات، فلا يُحفظ الرابط: يُطلب طازجاً عند الاستماع.
 *
 * والقائمةُ الأولى «Top Arabic Trending» من Digster Arabia — عربيّةٌ كلُّها (بقرار
 * المالك): «Top Saudi Arabia» من Deezer Charts كان نصفُها أجنبياً. ويُبدَّل
 * بـ`DEEZER_TOP_PLAYLIST`.
 */

const API = "https://api.deezer.com";
const TOP = process.env.DEEZER_TOP_PLAYLIST || "11163315344";

/** طولُ المعاينة، وطولُ ما يُسمع منها في النوت. */
export const PREVIEW_SECONDS = 30;
export const NOTE_SECONDS = 20;

export type Track = {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  /** مدّة الأغنية كاملةً — تُكتب بجانبها في القائمة. */
  duration: number;
};

type Raw = {
  id: number;
  title?: string;
  title_short?: string;
  duration?: number;
  readable?: boolean;
  preview?: string;
  artist?: { name?: string };
  album?: { cover_medium?: string; cover_small?: string };
};

function shape(row: Raw): Track | null {
  // أغنيةٌ بلا معاينةٍ لا تُسمع في النوت، فلا تُعرض.
  if (!row.preview || row.readable === false) return null;
  return {
    id: String(row.id),
    title: row.title_short || row.title || "",
    artist: row.artist?.name ?? "",
    cover: row.album?.cover_medium ?? row.album?.cover_small ?? null,
    duration: row.duration ?? 0,
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw badRequest("الأغاني غير متاحة الآن — حاول بعد قليل");
  const body = (await res.json()) as T & { error?: unknown };
  if (body && typeof body === "object" && "error" in body && body.error) {
    throw badRequest("الأغاني غير متاحة الآن — حاول بعد قليل");
  }
  return body;
}

/** القائمةُ الأولى قبل البحث — تُخبّأ ساعةً: لا تتبدّل كلَّ دقيقة. */
let top: { at: number; tracks: Track[] } | null = null;
export async function topTracks(): Promise<Track[]> {
  if (top && Date.now() - top.at < 3_600_000) return top.tracks;
  const body = await get<{ data?: Raw[] }>(`/playlist/${TOP}/tracks?limit=50`);
  const tracks = (body.data ?? []).map(shape).filter((row): row is Track => row !== null);
  top = { at: Date.now(), tracks };
  return tracks;
}

export async function searchTracks(query: string): Promise<Track[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return topTracks();
  const body = await get<{ data?: Raw[] }>(`/search?q=${encodeURIComponent(q)}&limit=30`);
  return (body.data ?? []).map(shape).filter((row): row is Track => row !== null);
}

/** الأغنيةُ بمعرّفها — يُقرأ اسمُها وفنّانها من دِيزر لا ممّا يرسله الجهاز. */
export async function trackById(id: string): Promise<Track & { preview: string }> {
  if (!/^\d{1,15}$/.test(id)) throw notFound("الأغنية غير موجودة");
  const row = await get<Raw>(`/track/${id}`);
  const track = shape(row);
  if (!track || !row.preview) throw notFound("الأغنية غير متاحة");
  return { ...track, preview: row.preview };
}

/** رابطُ المعاينة طازجاً — يُخبّأ عشر دقائق لكل أغنية: نوتٌ يسمعها عشرون لا تُسأل عشرين مرّة. */
const fresh = new Map<string, { at: number; url: string }>();
export async function previewUrl(id: string): Promise<string> {
  const hit = fresh.get(id);
  if (hit && Date.now() - hit.at < 600_000) return hit.url;
  const { preview } = await trackById(id);
  fresh.set(id, { at: Date.now(), url: preview });
  if (fresh.size > 2000) fresh.delete(fresh.keys().next().value as string);
  return preview;
}
