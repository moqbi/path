import "server-only";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * كتالوج Apple Music مصدراً ثانياً للأغاني (القاعدة ٣٠٤) — من خادمنا كدِيزر.
 *
 * رمزُ المطوّر JWT بـES256 من مفتاح MusicKit (`MUSICKIT_KEY_ID` و`MUSICKIT_KEY_PATH`
 * ومعهما `APPLE_TEAM_ID`)، يُوقَّع مرّةً لاثنتي عشرة ساعة. **وبلا مفتاحٍ لا شيء**:
 * البحثُ يبقى على دِيزر وحده ولا يتعطّل (القاعدة ١٠٢). والمعاينةُ ثلاثون ثانية لا
 * تحتاج اشتراكاً من السامع. والمتجرُ `MUSICKIT_STOREFRONT` (السعودية افتراضاً).
 *
 * **والمعرّفُ يحمل مصدرَه** (`am:` قبل رقم آبل): الرقمان من دِيزر وآبل أرقامٌ كلاهما
 * فيصطدمان، والبادئةُ تُغني عن عمودٍ جديد في `StatusNote` و`Story` — ونسخةٌ قديمة
 * تطلب صوتَ نوتٍ من آبل فيردّه الخادمُ كما يردّ دِيزر.
 */

const API = "https://api.music.apple.com/v1/catalog";
export const APPLE_PREFIX = "am:";

export type AppleTrack = {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  duration: number;
  preview: string;
};

type Song = {
  id: string;
  attributes?: {
    name?: string;
    artistName?: string;
    durationInMillis?: number;
    artwork?: { url?: string };
    previews?: { url?: string }[];
  };
};

export function appleReady(): boolean {
  return Boolean(process.env.APPLE_TEAM_ID && process.env.MUSICKIT_KEY_ID && process.env.MUSICKIT_KEY_PATH);
}

let token: { at: number; value: string } | null = null;
function developerToken(): string | null {
  if (!appleReady()) return null;
  if (token && Date.now() - token.at < 11 * 3_600_000) return token.value;
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: process.env.MUSICKIT_KEY_ID });
  const body = b64({ iss: process.env.APPLE_TEAM_ID, iat: now - 60, exp: now + 12 * 3600 });
  const signer = createSign("SHA256");
  signer.update(`${head}.${body}`);
  // JOSE (r‖s) لا DER — كتوقيع حذف حساب آبل.
  const sig = signer.sign({ key: readFileSync(process.env.MUSICKIT_KEY_PATH as string, "utf8"), dsaEncoding: "ieee-p1363" });
  token = { at: Date.now(), value: `${head}.${body}.${sig.toString("base64url")}` };
  return token.value;
}

const storefront = () => (process.env.MUSICKIT_STOREFRONT || "sa").toLowerCase();

/** أسماءٌ عربيّة حيث يحملها المتجر — ومتجرٌ لا يعرف `ar` يُسأل بلغته الافتراضيّة. */
let arabic = true;
async function get<T>(path: string): Promise<T | null> {
  const bearer = developerToken();
  if (!bearer) return null;
  const ask = (lang: boolean) =>
    fetch(`${API}/${storefront()}${path}${lang ? `${path.includes("?") ? "&" : "?"}l=ar` : ""}`, {
      headers: { authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  let res = await ask(arabic);
  if (res.status === 400 && arabic) {
    arabic = false;
    res = await ask(false);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`apple music ${res.status}`);
  return (await res.json()) as T;
}

function shape(song: Song): AppleTrack | null {
  const a = song.attributes;
  const preview = a?.previews?.[0]?.url;
  // أغنيةٌ بلا معاينةٍ لا تُسمع في النوت، فلا تُعرض.
  if (!a || !preview) return null;
  return {
    id: APPLE_PREFIX + song.id,
    title: a.name ?? "",
    artist: a.artistName ?? "",
    cover: a.artwork?.url ? a.artwork.url.replace("{w}", "300").replace("{h}", "300") : null,
    duration: Math.round((a.durationInMillis ?? 0) / 1000),
    preview,
  };
}

/** بحثٌ في الكتالوج — فارغٌ بلا مفتاح. */
export async function appleSearch(query: string): Promise<AppleTrack[]> {
  const body = await get<{ results?: { songs?: { data?: Song[] } } }>(
    `/search?types=songs&limit=25&term=${encodeURIComponent(query)}`,
  );
  return (body?.results?.songs?.data ?? []).map(shape).filter((row): row is AppleTrack => row !== null);
}

/** الأغنيةُ بمعرّفها (بلا البادئة) — `null` لما لا يوجد أو بلا معاينة أو بلا مفتاح. */
export async function appleSong(id: string): Promise<AppleTrack | null> {
  if (!/^\d{1,15}$/.test(id)) return null;
  const body = await get<{ data?: Song[] }>(`/songs/${id}`);
  const song = body?.data?.[0];
  return song ? shape(song) : null;
}
