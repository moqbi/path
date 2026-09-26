/**
 * تحويل الإحداثيات إلى اسم مكان عربي.
 *
 * يجري على الخادم لا في الجهاز: Nominatim تشترط تعريفاً بالتطبيق في
 * ترويسة الطلب، ولأن إخفاء مواقع المستخدمين عن طرف ثالث أفضل حين يمكن.
 * الفشل ليس خطأً يوقف النشر — تُحفظ الإحداثيات ويبقى الاسم فارغاً.
 *
 * نسخةٌ من `src/lib/places.ts` بلا `server-only`: تلك موسومةٌ لـNext،
 * وهذه تعمل تحت node وحده. تُدمجان حين يُسحب الويب القديم.
 */
export type ResolvedPlace = { name: string | null; city: string | null };

export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedPlace> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("accept-language", "ar");
  url.searchParams.set("zoom", "18");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ATHAR-Moments/0.1" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return { name: null, city: null };

    const data = (await response.json()) as { name?: string; address?: Record<string, string> };
    const address = data.address ?? {};
    const city = address.city ?? address.town ?? address.village ?? address.state ?? null;
    const name =
      data.name?.trim() ||
      address.amenity ||
      address.shop ||
      address.road ||
      address.suburb ||
      address.neighbourhood ||
      city ||
      null;

    return { name: name ?? null, city };
  } catch {
    return { name: null, city: null };
  }
}

/** مكانٌ قريب: اسمه ونوعه وبُعده بالأمتار. */
export type NearbyPlace = {
  id: string;
  name: string;
  kind: string | null;
  meters: number;
  lat: number;
  lng: number;
};

/** أنواعٌ يعرفها الناس: المقهى مقهى، والمطعم مطعم — لا وسوم إنجليزية. */
const KIND_AR: Record<string, string> = {
  cafe: "مقهى",
  restaurant: "مطعم",
  fast_food: "وجبات سريعة",
  bakery: "مخبز",
  ice_cream: "آيس كريم",
  mall: "مركز تسوّق",
  supermarket: "سوبرماركت",
  pharmacy: "صيدلية",
  hospital: "مستشفى",
  clinic: "عيادة",
  mosque: "مسجد",
  park: "حديقة",
  gym: "نادٍ رياضي",
  fitness_centre: "نادٍ رياضي",
  hotel: "فندق",
  library: "مكتبة",
  university: "جامعة",
  school: "مدرسة",
  cinema: "سينما",
  museum: "متحف",
  stadium: "ملعب",
  fuel: "محطة وقود",
  bank: "بنك",
  car_wash: "مغسلة",
  barber: "حلاق",
  clothes: "ملابس",
  electronics: "إلكترونيات",
  company: "شركة",
  office: "مكتب",
  coworking_space: "مكتب مشترك",
  dentist: "أسنان",
  doctors: "عيادة",
  hairdresser: "حلاق",
  juice_bar: "عصائر",
  coffee: "قهوة",
  books: "كتب",
  convenience: "بقالة",
  supermarket_2: "سوبرماركت",
};

function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

type PhotonFeature = {
  properties?: Record<string, string | number | undefined>;
  geometry?: { coordinates?: [number, number] };
};

/** مفاتيح الأماكن التي يقصدها الناس: مقهى ومطعم ومتجر — لا شوارع ولا مبانٍ. */
const POI_KEYS = new Set(["amenity", "shop", "leisure", "tourism", "healthcare", "office", "craft"]);

/** نصفُ قطر البحث — **بقرار المالك**: كلُّ ما على الخريطة في كيلومتر. */
const RADIUS_M = 1000;

/**
 * خوادمُ Overpass العامة — تُسأل معاً ويُؤخذ أوّلُ جواب.
 *
 * الواحدُ منها يمهل أحياناً ثمّ يردّ ٥٠٤ (وهذا ما أبعده من قبل)، لكنّ
 * ثلاثةً معاً نادراً ما تمهل كلُّها. وPhoton يبقى احتياطاً لا بديلاً:
 * `reverse` عنده يردّ **أقرب خمسين شيئاً** — بيوتاً وشوارع — فإذا صُفّي
 * منها ما هو مكان بقيت أماكنُ على مئتين وتسعمئة متر وغاب المقهى المجاور.
 */
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** ما لا يُقصد ولا يُنشر عنه: مواقفُ ومقاعدُ وصناديق. */
const SKIP_VALUES = new Set([
  "parking", "parking_space", "parking_entrance", "bench", "waste_basket", "bicycle_parking",
  "vending_machine", "recycling", "toilets", "atm", "post_box", "telephone", "drinking_water",
  "shelter", "loading_dock", "motorcycle_parking",
]);

async function overpass(lat: number, lng: number): Promise<NearbyPlace[]> {
  const query = `[out:json][timeout:8];nwr(around:${RADIUS_M},${lat},${lng})[name][~"^(amenity|shop|leisure|tourism|healthcare|office|craft|sport)$"~"."];out center 300;`;
  const ask = (endpoint: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "User-Agent": "ATHAR-Moments/0.1",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(9000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as { elements?: OverpassElement[] };
    });

  const data = await Promise.any(OVERPASS.map(ask));
  const places: NearbyPlace[] = [];
  for (const element of data.elements ?? []) {
    const tags = element.tags ?? {};
    const name = (tags["name:ar"] || tags.name || "").trim();
    if (!name) continue;
    const pointLat = element.lat ?? element.center?.lat;
    const pointLng = element.lon ?? element.center?.lon;
    if (pointLat === undefined || pointLng === undefined) continue;

    const value =
      tags.amenity ?? tags.shop ?? tags.leisure ?? tags.tourism ?? tags.healthcare ?? tags.office ?? tags.craft ?? tags.sport ?? "";
    if (SKIP_VALUES.has(value)) continue;

    places.push({
      id: `${element.type[0]}${element.id}`,
      name,
      kind: KIND_AR[value] ?? null,
      meters: metersBetween(lat, lng, pointLat, pointLng),
      lat: pointLat,
      lng: pointLng,
    });
  }
  return places;
}

async function photon(lat: number, lng: number): Promise<NearbyPlace[]> {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("limit", "50");
  url.searchParams.set("radius", String(RADIUS_M / 1000));
  for (const key of POI_KEYS) url.searchParams.append("osm_tag", key);

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ATHAR-Moments/0.1)" },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return [];

  const data = (await response.json()) as { features?: PhotonFeature[] };
  const places: NearbyPlace[] = [];
  for (const feature of data.features ?? []) {
    const props = feature.properties ?? {};
    const key = String(props.osm_key ?? "");
    if (!POI_KEYS.has(key)) continue;
    const name = String(props.name ?? "").trim();
    if (!name) continue;
    const [pointLng, pointLat] = feature.geometry?.coordinates ?? [];
    if (pointLat === undefined || pointLng === undefined) continue;
    const value = String(props.osm_value ?? "");
    if (SKIP_VALUES.has(value)) continue;
    places.push({
      id: `${props.osm_type ?? "n"}${props.osm_id ?? name}`,
      name,
      kind: KIND_AR[value] ?? null,
      meters: metersBetween(lat, lng, pointLat, pointLng),
      lat: pointLat,
      lng: pointLng,
    });
  }
  return places;
}

/**
 * الأماكن حول المستخدم — كلُّ مكانٍ مسمّى في كيلومتر، الأقربُ أوّلاً.
 *
 * `reverseGeocode` تردّ أقرب عنوان — وغالباً شارعاً — وهذا لا يقول أين
 * أنت: في المقهى أم في المطعم المجاور. فهنا نسأل عن المعالم المسمّاة
 * حولك (مطاعم ومقاهٍ ومحلّات وخدمات وأسواق)، ويختار صاحبها بنفسه.
 *
 * Overpass أوّلاً لأنّه يسأل عن **كلّ** ما في الدائرة لا عن أقرب خمسين
 * شيئاً، وPhoton احتياطٌ إن أمهلت خوادمُه كلُّها. والفشلان معاً يردّان
 * قائمةً فارغة: الواجهة تُبقي «أقرب عنوان» فلا يتعطّل النشر.
 *
 * والحدُّ ما في الخريطة: OpenStreetMap في المملكة ناقصٌ في أحياءٍ دون
 * أحياء، فما لم يُرسم فيها لا يظهر هنا.
 */
export async function nearbyPlaces(lat: number, lng: number, limit = 80): Promise<NearbyPlace[]> {
  let places: NearbyPlace[] = [];
  try {
    places = await overpass(lat, lng);
  } catch {
    places = await photon(lat, lng).catch(() => []);
  }

  // اسمٌ واحد مرّةً واحدة — الأقربُ منه — فالسلسلةُ لا تملأ القائمة بفروعها.
  const seen = new Set<string>();
  return places
    .filter((place) => place.meters <= RADIUS_M)
    .sort((a, b) => a.meters - b.meters)
    .filter((place) => (seen.has(place.name) ? false : (seen.add(place.name), true)))
    .slice(0, limit);
}
