import { badRequest } from "../lib/errors";

/**
 * الصورُ المتحرّكة من GIPHY (القاعدة ٣١٥) — من خادمنا لا من الجهاز، كالأغاني
 * (القاعدة ٢٦٩): المفتاحُ لا يخرج في التطبيق، والحدُّ يُضبط هنا.
 *
 * **وبلا `GIPHY_API_KEY` يختفي البابُ** (القاعدة ١٠٢): `enabled: false` فلا يُرسم زرٌّ
 * لا يفتح شيئاً. والتصنيفُ `pg` — جمهورٌ صغيرُ السنّ (القاعدة ٦).
 */

const API = "https://api.giphy.com/v1/gifs";
const KEY = () => process.env.GIPHY_API_KEY ?? "";
const LIMIT = 30;

export const giphyReady = () => KEY().length > 0;

/** معرّفُ GIPHY حروفٌ وأرقام — الرابطُ يُبنى منه وحده فلا يُحفظ عنوانٌ يكتبه الجهاز. */
export const GIF_ID = /^[A-Za-z0-9]{4,40}$/;

export type Gif = { id: string; w: number; h: number; preview: string };

type Raw = {
  id: string;
  images?: {
    fixed_width?: { width?: string; height?: string; url?: string; webp?: string };
    fixed_width_small?: { url?: string; webp?: string };
  };
};

function toGif(raw: Raw): Gif | null {
  const fw = raw.images?.fixed_width;
  const w = Number(fw?.width);
  const h = Number(fw?.height);
  if (!GIF_ID.test(raw.id) || !w || !h) return null;
  // المصغّرةُ للشبكة — أخفُّ على باقة من يتصفّح.
  const small = raw.images?.fixed_width_small;
  const preview = small?.webp || small?.url || fw?.webp || fw?.url || "";
  if (!preview.startsWith("https://")) return null;
  return { id: raw.id, w, h, preview };
}

async function call(path: string, params: Record<string, string>): Promise<Raw[]> {
  if (!giphyReady()) return [];
  const query = new URLSearchParams({ api_key: KEY(), rating: "pg", ...params });
  try {
    const res = await fetch(`${API}${path}?${query}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.warn(`[giphy] ${path} → ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { data?: Raw | Raw[] };
    return Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
  } catch (err) {
    console.warn("[giphy] request failed:", (err as Error).message);
    return [];
  }
}

const list = (rows: Raw[]) => rows.map(toGif).filter((g): g is Gif => g !== null);

export async function trending() {
  return { enabled: giphyReady(), gifs: list(await call("/trending", { limit: String(LIMIT) })) };
}

export async function search(q: string) {
  const term = q.trim().slice(0, 50);
  if (!term) return trending();
  return { enabled: giphyReady(), gifs: list(await call("/search", { q: term, limit: String(LIMIT), lang: "ar" })) };
}

/** الصورةُ بمعرّفها من GIPHY نفسها — مقاسٌ يرسله الجهاز يُكتب فيه أيُّ شيء. */
export async function gifById(id: string): Promise<Gif> {
  if (!giphyReady()) throw badRequest("الصور المتحركة غير متاحة الآن");
  if (!GIF_ID.test(id)) throw badRequest("صورة غير صالحة");
  const [gif] = list(await call(`/${id}`, {}));
  if (!gif) throw badRequest("الصورة غير موجودة");
  return gif;
}
