import { badRequest, notFound } from "../lib/errors";
import { APPLE_PREFIX, appleReady, appleSearch, appleSong } from "./apple-music";

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

/** أقصرُ مقطعٍ يُقصّ — دون ثلاث ثوانٍ نقرةٌ لا أغنية. */
export const CLIP_MIN_SECONDS = 3;

/**
 * ما يُسمع من المعاينة (القاعدة ٣٠٣): كاملةً، أو من البداية إلى النهاية كما اختارها
 * صاحبُها بأيّ طول بين ثلاثٍ وثلاثين. ونسخةٌ لا ترسل الطول تبقى على عشرين من حيث بدأت.
 */
export function clipOf(input: { start?: number; seconds?: number; full?: boolean }) {
  if (input.full) return { start: 0, seconds: PREVIEW_SECONDS };
  if (input.seconds == null) {
    return { start: Math.max(0, Math.min(PREVIEW_SECONDS - NOTE_SECONDS, Math.round(input.start ?? 0))), seconds: NOTE_SECONDS };
  }
  const start = Math.max(0, Math.min(PREVIEW_SECONDS - CLIP_MIN_SECONDS, Math.round(input.start ?? 0)));
  const seconds = Math.max(CLIP_MIN_SECONDS, Math.min(PREVIEW_SECONDS - start, Math.round(input.seconds)));
  return { start, seconds };
}

export type Track = {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  /** مدّة الأغنية كاملةً — تُكتب بجانبها في القائمة. */
  duration: number;
  /** مصدرُ الأغنية — «Apple Music» يُكتب بجانبها شرطاً منه (القاعدة ٣٠٤). */
  source?: "deezer" | "apple";
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
    source: "deezer",
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

/** ما يُطوى قبل المقارنة: الأغنيةُ نفسها في المصدرين تُعرض مرّةً. */
function keyOf(track: Track): string {
  const fold = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, "")
      .replace(/[ً-ْـ]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "");
  return `${fold(track.title)}|${fold(track.artist)}`;
}

/**
 * بحثٌ واحدٌ يجمع المصدرين (القاعدة ٣٠٤): دِيزر وApple Music معاً، متناوبين، وما
 * تكرّر بينهما يُعرض مرّةً من أوّلهما. وفشلُ أحدهما لا يُفرغ القائمة.
 */
export async function searchTracks(query: string, withApple = false): Promise<Track[]> {
  const q = query.trim().slice(0, 80);
  if (!q) return topTracks();
  const [deezer, apple] = await Promise.allSettled([
    get<{ data?: Raw[] }>(`/search?q=${encodeURIComponent(q)}&limit=30`).then((body) =>
      (body.data ?? []).map(shape).filter((row): row is Track => row !== null),
    ),
    withApple && appleReady()
      ? appleSearch(q).then((rows) => rows.map(({ preview: _, ...row }): Track => ({ ...row, source: "apple" })))
      : Promise.resolve([] as Track[]),
  ]);
  const a = deezer.status === "fulfilled" ? deezer.value : [];
  const b = apple.status === "fulfilled" ? apple.value : [];
  if (apple.status === "rejected") console.warn("[music] Apple Music:", apple.reason);
  if (deezer.status === "rejected" && !b.length) throw deezer.reason;
  const seen = new Set<string>();
  const out: Track[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    for (const row of [a[i], b[i]]) {
      if (!row) continue;
      const key = keyOf(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

/** الأغنيةُ بمعرّفها — يُقرأ اسمُها وفنّانها من دِيزر لا ممّا يرسله الجهاز. */
export async function trackById(id: string): Promise<Track & { preview: string }> {
  if (id.startsWith(APPLE_PREFIX)) {
    const song = await appleSong(id.slice(APPLE_PREFIX.length)).catch((error: unknown) => {
      console.warn("[music] Apple Music:", error);
      throw badRequest("الأغاني غير متاحة الآن — حاول بعد قليل");
    });
    if (!song) throw notFound("الأغنية غير متاحة");
    return { ...song, source: "apple" };
  }
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
