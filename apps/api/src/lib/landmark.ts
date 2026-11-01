import sharp from "sharp";

/**
 * صورةُ معلم الدولة وبانوراما المدينة في «خريطتي» (القاعدة ٣٨٤) — من ويكيبيديا عبر خادمنا.
 *
 * **النداءُ من هنا لا من الجهاز** (كالقاعدة ١٢٨): أسماءُ المدن التي زارها صاحبُها لا تخرج
 * إلى طرفٍ ثالث من جهازه. والصورةُ تُصغَّر هنا وتُرسل `data:` في الردّ — لا رابطَ يجلبه الجهاز.
 *
 * **الدولةُ بمعلمٍ مختار** (`COUNTRY_LANDMARKS`): صورةُ مقالة الدولة علمُها أو خريطتُها،
 * فلكلّ دولةٍ مقالةُ معلمها بالإنجليزيّة. ودولةٌ ليست في القائمة بلا صورة — والشاشةُ ترجع
 * إلى صورةٍ من لحظات صاحبها. **والمدينةُ مقالتُها العربيّة بشرط الموضع**: إحداثيّاتُ المقالة
 * على ستّين كيلومتراً من لحظاته وإلّا لا صورة — اسمٌ يلتبس («صور») لا يجلب مقالةً أخرى.
 *
 * وويكيبيديا تحدّ من يُكثر السؤال، فكلُّ جوابٍ يُحفظ أسبوعاً والفشلُ نصفَ ساعة، وسؤالان
 * للشيء نفسه معاً سؤالٌ واحد. والفشلُ `null` لا خطأ: الخريطةُ لا تتعطّل لصورة.
 */

const UA = "ATHAR-Moments/0.1 (https://atharmts.com; support@atharmts.com)";
const DAY = 86_400_000;

const COUNTRY_LANDMARKS: [string[], string][] = [
  [["السعودية"], "Kingdom Centre"],
  [["الإمارات"], "Burj Khalifa"],
  [["قطر"], "Museum of Islamic Art, Doha"],
  [["الكويت"], "Kuwait Towers"],
  [["البحرين"], "Bahrain World Trade Center"],
  [["عُمان", "سلطنة عمان"], "Sultan Qaboos Grand Mosque"],
  [["مصر"], "Giza pyramid complex"],
  [["الأردن"], "Petra"],
  [["لبنان"], "Pigeons' Rock"],
  [["سوريا", "سورية"], "Umayyad Mosque"],
  [["العراق"], "Al-Shaheed Monument"],
  [["المغرب"], "Hassan II Mosque"],
  [["تونس"], "Sidi Bou Said"],
  [["الجزائر"], "Maqam Echahid"],
  [["السودان"], "Meroë"],
  [["تركيا"], "Hagia Sophia"],
  [["أذربيجان"], "Flame Towers"],
  [["جورجيا"], "Gergeti Trinity Church"],
  [["باكستان"], "Faisal Mosque"],
  [["الهند"], "Taj Mahal"],
  [["ماليزيا"], "Petronas Towers"],
  [["إندونيسيا"], "Borobudur"],
  [["تايلاند"], "Wat Arun"],
  [["سنغافورة"], "Marina Bay Sands"],
  [["الصين"], "Great Wall of China"],
  [["اليابان"], "Mount Fuji"],
  [["كوريا الجنوبية"], "Gyeongbokgung"],
  [["المالديف"], "Malé"],
  [["فرنسا"], "Eiffel Tower"],
  [["المملكة المتحدة", "بريطانيا"], "Big Ben"],
  [["إيطاليا"], "Colosseum"],
  [["إسبانيا"], "Sagrada Família"],
  [["ألمانيا"], "Brandenburg Gate"],
  [["سويسرا"], "Matterhorn"],
  [["النمسا"], "Schönbrunn Palace"],
  [["هولندا"], "Kinderdijk"],
  [["اليونان"], "Parthenon"],
  [["البرتغال"], "Belém Tower"],
  [["التشيك"], "Charles Bridge"],
  [["البوسنة"], "Stari Most"],
  [["روسيا"], "Saint Basil's Cathedral"],
  [["الولايات المتحدة", "أمريكا"], "Statue of Liberty"],
  [["كندا"], "CN Tower"],
  [["البرازيل"], "Christ the Redeemer (statue)"],
  [["أستراليا"], "Sydney Opera House"],
];

const SIZES = {
  pin: { width: 160, height: 160 },
  hero: { width: 1080, height: 600 },
} as const;
export type LandmarkSize = keyof typeof SIZES;

type Hit = { image: string | null; credit: string | null };
const cache = new Map<string, { at: number; ttl: number; value: Hit }>();
const inflight = new Map<string, Promise<Hit>>();
const NONE: Hit = { image: null, credit: null };

function countryTitle(name: string): string | null {
  const text = name.trim();
  for (const [aliases, title] of COUNTRY_LANDMARKS) {
    if (aliases.some((alias) => text.includes(alias))) return title;
  }
  return null;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

type Summary = {
  type?: string;
  coordinates?: { lat: number; lon: number };
  originalimage?: { source: string; width: number };
  thumbnail?: { source: string; width: number };
};

async function summary(lang: "ar" | "en", title: string): Promise<Summary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  // لا مقالة: جوابٌ يُحفظ. وغيرُه (٤٢٩ حدُّ الأسئلة) عارضٌ يُعاد بعد نصف ساعة.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`wikipedia ${response.status}`);
  return (await response.json()) as Summary;
}

/** رابطُ الصورة بعرضٍ قريبٍ ممّا نحتاج — ويكيميديا تقدّم أعراضاً ثابتة (٣٣٠، ١٢٨٠…). */
function sourceFor(page: Summary, size: LandmarkSize): string | null {
  const original = page.originalimage?.source ?? null;
  const small = page.thumbnail?.source ?? null;
  if (size === "pin") return small ?? original;
  if (!original) return small;
  if ((page.originalimage?.width ?? 0) <= 2000) return original;
  return original.replace(/\/(\d+)px-/, "/1280px-");
}

async function shrink(url: string, size: LandmarkSize): Promise<string | null> {
  const response = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 12_000_000) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 12_000_000) return null;
  const { width, height } = SIZES[size];
  const out = await sharp(bytes, { animated: false, limitInputPixels: 60_000_000 })
    .rotate()
    .resize(width, height, { fit: "cover", position: "attention" })
    .jpeg({ quality: size === "hero" ? 78 : 72, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${out.toString("base64")}`;
}

async function look(kind: "country" | "city", name: string, size: LandmarkSize, near?: { lat: number; lng: number }): Promise<Hit> {
  let page: Summary | null = null;
  if (kind === "country") {
    const title = countryTitle(name);
    if (!title) return NONE;
    page = await summary("en", title);
  } else {
    page = await summary("ar", name);
    if (page && page.type !== "standard") page = null;
    // المقالةُ مدينتُه هو لا اسمٌ يشبهه.
    if (page && near) {
      const at = page.coordinates;
      if (!at || distanceKm(at.lat, at.lon, near.lat, near.lng) > 60) page = null;
    }
  }
  if (!page) return NONE;
  const source = sourceFor(page, size);
  if (!source) return NONE;
  const image = await shrink(source, size);
  return image ? { image, credit: "ويكيبيديا" } : NONE;
}

export async function landmark(
  kind: "country" | "city",
  name: string,
  size: LandmarkSize,
  near?: { lat: number; lng: number },
): Promise<Hit> {
  // الموضعُ مقرَّبٌ في المفتاح: لحظاتٌ جديدة تحرّك المتوسّط قليلاً ولا تُعيد السؤال.
  const key = `${kind}:${size}:${name}:${near ? `${near.lat.toFixed(0)},${near.lng.toFixed(0)}` : ""}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < saved.ttl) return saved.value;
  const running = inflight.get(key);
  if (running) return running;

  const job = look(kind, name, size, near)
    .then((value) => ({ value, ttl: value.image ? 7 * DAY : 6 * 3_600_000 }))
    .catch(() => ({ value: NONE, ttl: 30 * 60_000 }))
    .then(({ value, ttl }) => {
      if (cache.size > 600) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: Date.now(), ttl, value });
      inflight.delete(key);
      return value;
    });
  inflight.set(key, job);
  return job;
}
