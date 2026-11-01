import "server-only";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * خرائطُ آبل من الخادم (Apple Maps Server API) — القاعدة ٣٨٠: المدينةُ والدولةُ بالعربيّة،
 * والبحثُ عن مكانٍ باسمه، لأندرويد والويب ولكلّ ما يُكتب على الخادم. الآيفونُ يسأل MapKit
 * على جهازه بلا مفتاح (القاعدة ١٨٨)، وهذا بابُه على الخادم.
 *
 * رمزُ الخرائط JWT بـES256 من مفتاحٍ فيه «Maps» (`MAPKIT_KEY_ID` و`MAPKIT_KEY_PATH` ومعهما
 * `APPLE_TEAM_ID`)، يُبادَل عند `/v1/token` برمز وصولٍ لثلاثين دقيقة. **وبلا مفتاحٍ لا شيء**:
 * يبقى OpenStreetMap وقوقل كما كانا (القاعدة ١٠٢). والفشلُ `null` لا استثناء — اسمُ مدينةٍ لا
 * يُفشل نشرَ لحظة. ونسختُه `src/lib/apple-maps.ts` حرفاً بحرف إلا `server-only`.
 */
const API = "https://maps-api.apple.com/v1";

export function appleMapsReady(): boolean {
  return Boolean(process.env.APPLE_TEAM_ID && process.env.MAPKIT_KEY_ID && process.env.MAPKIT_KEY_PATH);
}

let auth: { jwt: string; at: number } | null = null;
let access: { value: string; until: number } | null = null;
// فشلُ الرمز يُسكت السؤالَ خمسَ دقائق: مفتاحٌ مرفوض لا يُسأل عنه مع كلّ لحظة.
let failedAt = 0;

function signed(): string {
  if (auth && Date.now() - auth.at < 11 * 3_600_000) return auth.jwt;
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: process.env.MAPKIT_KEY_ID, typ: "JWT" });
  const body = b64({ iss: process.env.APPLE_TEAM_ID, iat: now - 60, exp: now + 12 * 3600 });
  const signer = createSign("SHA256");
  signer.update(`${head}.${body}`);
  const sig = signer.sign({ key: readFileSync(process.env.MAPKIT_KEY_PATH as string, "utf8"), dsaEncoding: "ieee-p1363" });
  auth = { jwt: `${head}.${body}.${sig.toString("base64url")}`, at: Date.now() };
  return auth.jwt;
}

async function token(): Promise<string | null> {
  if (!appleMapsReady()) return null;
  if (access && access.until > Date.now() + 60_000) return access.value;
  if (Date.now() - failedAt < 5 * 60_000) return null;
  try {
    const res = await fetch(`${API}/token`, {
      headers: { authorization: `Bearer ${signed()}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // السببُ في السجلّ: مفتاحٌ بلا خدمة Maps، أو معرّفُ فريقٍ خطأ، أو ملفٌّ ناقص.
      console.error("[apple-maps] token", res.status, (await res.text().catch(() => "")).slice(0, 200));
      failedAt = Date.now();
      return null;
    }
    const data = (await res.json()) as { accessToken?: string; expiresInSeconds?: number };
    if (!data.accessToken) return null;
    access = { value: data.accessToken, until: Date.now() + (data.expiresInSeconds ?? 1800) * 1000 };
    return access.value;
  } catch (problem) {
    console.error("[apple-maps] token", problem instanceof Error ? problem.message : problem);
    failedAt = Date.now();
    return null;
  }
}

async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const bearer = await token();
  if (!bearer) return null;
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    const res = await fetch(url, { headers: { authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(5000) });
    if (res.status === 401) access = null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Result = {
  name?: string;
  coordinate?: { latitude?: number; longitude?: number };
  country?: string;
  countryCode?: string;
  poiCategory?: string;
  structuredAddress?: {
    locality?: string;
    administrativeArea?: string;
    subLocality?: string;
    thoroughfare?: string;
    areasOfInterest?: string[];
  };
};

/** المدينةُ والدولةُ بالعربيّة لموضعٍ — وما يطلبه `reverseGeocode` من اسمٍ قريب. */
export async function appleReverse(
  lat: number,
  lng: number,
): Promise<{ name: string | null; city: string | null; country: string | null; countryCode: string | null } | null> {
  const data = await get<{ results?: Result[] }>("/reverseGeocode", { loc: `${lat},${lng}`, lang: "ar" });
  const first = data?.results?.[0];
  if (!first) return null;
  const address = first.structuredAddress ?? {};
  return {
    name: address.areasOfInterest?.[0] ?? address.subLocality ?? address.thoroughfare ?? null,
    city: address.locality ?? address.administrativeArea ?? null,
    country: first.country ?? null,
    countryCode: first.countryCode?.toLowerCase() ?? null,
  };
}

/** فئاتُ آبل بالعربيّة — ما لا نعرفه يبقى بلا نوع. */
const KIND: Record<string, string> = {
  Cafe: "مقهى", Restaurant: "مطعم", Bakery: "مخبز", Store: "متجر", FoodMarket: "سوق",
  Hotel: "فندق", Park: "حديقة", Museum: "متحف", Airport: "مطار", Beach: "شاطئ",
  Hospital: "مستشفى", University: "جامعة", School: "مدرسة", Library: "مكتبة",
  MovieTheater: "سينما", Stadium: "ملعب", FitnessCenter: "نادي رياضي", Pharmacy: "صيدلية",
  GasStation: "محطة وقود", Bank: "بنك", Theater: "مسرح", Nightlife: "سهر", Zoo: "حديقة حيوان",
  NationalPark: "منتزه", Marina: "مرسى", AmusementPark: "ملاهي", Winery: "مزرعة",
};

function meters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.asin(Math.sqrt(h)));
}

/** بحثٌ باسم المكان حول صاحبه — نتائجُ «مكانٍ» لا عناوين. */
export async function appleSearch(
  lat: number,
  lng: number,
  q: string,
): Promise<{ id: string; name: string; kind: string | null; meters: number; lat: number; lng: number }[]> {
  const data = await get<{ results?: Result[] }>("/search", {
    q,
    searchLocation: `${lat},${lng}`,
    resultTypeFilter: "Poi",
    lang: "ar",
  });
  const out: { id: string; name: string; kind: string | null; meters: number; lat: number; lng: number }[] = [];
  for (const one of data?.results ?? []) {
    const name = one.name?.trim();
    const pLat = one.coordinate?.latitude;
    const pLng = one.coordinate?.longitude;
    if (!name || pLat === undefined || pLng === undefined) continue;
    out.push({
      id: `a${pLat.toFixed(5)},${pLng.toFixed(5)}`,
      name,
      kind: one.poiCategory ? KIND[one.poiCategory] ?? null : null,
      meters: meters(lat, lng, pLat, pLng),
      lat: pLat,
      lng: pLng,
    });
  }
  return out.sort((a, b) => a.meters - b.meters).slice(0, 15);
}
