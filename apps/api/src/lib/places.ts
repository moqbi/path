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
  const query = `[out:json][timeout:5];nwr(around:${RADIUS_M},${lat},${lng})[name][~"^(amenity|shop|leisure|tourism|healthcare|office|craft|sport)$"~"."];out center 300;`;
  const ask = (endpoint: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "User-Agent": "ATHAR-Moments/0.1",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(6000),
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
    signal: AbortSignal.timeout(5000),
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
 * قوقل أوّلاً — **بقرار المالك**: «الموقع ما يجيب الأماكن ويأخذ وقتاً».
 *
 * والعلّةُ في المصدر لا في الشاشة: OpenStreetMap في المملكة ناقصٌ في
 * أحياءٍ كاملة — مقاهٍ ومطاعم لم يرسمها أحد — وخوادمُ Overpass العامة
 * تمهل حتى تسع ثوانٍ قبل أن تردّ. وقوقل يعرف المحلّ الذي فُتح أمس،
 * ويردّ في أقلّ من ثانية، وباسمه العربيّ ونوعه بالعربية
 * (`primaryTypeDisplayName`) فلا قاموسَ أنواعٍ نكتبه بأيدينا.
 *
 * بابُه `places:searchNearby` (Places API New) بمفتاحٍ على الخادم
 * (`GOOGLE_PLACES_KEY`) لا في التطبيق: المفتاحُ في الحزمة يقرؤه كلُّ من
 * فكّها، والنداءُ من عندنا يُبقي إحداثيات الناس بين الخادم وقوقل وحدهما.
 * وبلا مفتاحٍ يبقى OpenStreetMap كما كان — لا يتعطّل شيء.
 *
 * طلبان معاً: الأقربُ (`DISTANCE`) والأشهرُ (`POPULARITY`) في الدائرة
 * نفسها — الحدُّ عشرون لكلّ طلب، والأقربُ وحده يملأ القائمة بمحلّات
 * البناية نفسها ويُغيب المقهى المعروف على بعد مئتي متر.
 */
const GOOGLE_NEARBY = "https://places.googleapis.com/v1/places:searchNearby";
const GOOGLE_TEXT = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_FIELDS = "places.id,places.displayName,places.location,places.primaryType,places.primaryTypeDisplayName";

/** ما لا يُنشر عنه في قوقل: طرقٌ ومواقفُ وصرّافات ومحطّاتُ نقل. */
const GOOGLE_SKIP = new Set([
  "parking", "atm", "bus_stop", "bus_station", "transit_station", "transit_depot", "route",
  "street_address", "premise", "subpremise", "plus_code", "postal_code", "intersection",
  "electric_vehicle_charging_station", "public_bathroom", "light_rail_station",
]);

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
};

function fromGoogle(lat: number, lng: number, list: GooglePlace[] | undefined): NearbyPlace[] {
  const places: NearbyPlace[] = [];
  for (const place of list ?? []) {
    const name = place.displayName?.text?.trim();
    const pointLat = place.location?.latitude;
    const pointLng = place.location?.longitude;
    if (!name || !place.id || pointLat === undefined || pointLng === undefined) continue;
    if (place.primaryType && GOOGLE_SKIP.has(place.primaryType)) continue;
    places.push({
      id: `g${place.id}`,
      name,
      kind: place.primaryTypeDisplayName?.text ?? null,
      meters: metersBetween(lat, lng, pointLat, pointLng),
      lat: pointLat,
      lng: pointLng,
    });
  }
  return places;
}

async function askGoogle(url: string, key: string, body: unknown): Promise<GooglePlace[]> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": GOOGLE_FIELDS,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    // السببُ في السجلّ: مفتاحٌ مقيّد أو واجهةٌ لم تُفعَّل أو فوترةٌ لم تُربط.
    console.error("[places] google", response.status, (await response.text().catch(() => "")).slice(0, 300));
    throw new Error(`google ${response.status}`);
  }
  const data = (await response.json()) as { places?: GooglePlace[] };
  return data.places ?? [];
}

async function google(lat: number, lng: number, key: string): Promise<NearbyPlace[]> {
  const circle = { circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M } };
  const ask = (rankPreference: "DISTANCE" | "POPULARITY") =>
    askGoogle(GOOGLE_NEARBY, key, {
      maxResultCount: 20,
      rankPreference,
      languageCode: "ar",
      regionCode: "SA",
      locationRestriction: circle,
    });
  // واحدٌ ينجح يكفي: قائمةٌ من عشرين خيرٌ من لا شيء.
  const [near, known] = await Promise.allSettled([ask("DISTANCE"), ask("POPULARITY")]);
  if (near.status === "rejected" && known.status === "rejected") throw near.reason;
  return fromGoogle(lat, lng, [
    ...(near.status === "fulfilled" ? near.value : []),
    ...(known.status === "fulfilled" ? known.value : []),
  ]);
}

/**
 * بحثٌ بالاسم حول المستخدم — لما لم يظهر في القائمة: المكانُ الذي أنت
 * فيه قد يكون أبعدَ من العشرين الأقرب، أو اسمُه بلغةٍ أخرى.
 * منحازٌ إلى موقعه (`locationBias`) لا محصورٌ فيه، فالاسمُ يجد صاحبه
 * وإن كان على بعد كيلومترين. وبلا مفتاح قوقل قائمةٌ فارغة.
 */
export async function searchPlaces(lat: number, lng: number, text: string): Promise<NearbyPlace[]> {
  const key = process.env.GOOGLE_PLACES_KEY;
  const q = text.trim().slice(0, 80);
  if (!key || q.length < 2) return [];
  try {
    const list = await askGoogle(GOOGLE_TEXT, key, {
      textQuery: q,
      maxResultCount: 15,
      languageCode: "ar",
      regionCode: "SA",
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } },
    });
    return fromGoogle(lat, lng, list).sort((a, b) => a.meters - b.meters);
  } catch {
    return [];
  }
}

/**
 * OpenStreetMap: Overpass وPhoton **معاً** لا واحداً بعد آخر — كان الثاني
 * لا يُسأل إلا بعد أن تمهل خوادمُ الأوّل تسع ثوانٍ، فتنتظر الشاشةُ ثماني
 * عشرة ثانيةً لتقول «ما لقينا شيئاً». والأغنى يُؤخذ.
 */
async function openStreetMap(lat: number, lng: number): Promise<NearbyPlace[]> {
  const [full, quick] = await Promise.allSettled([overpass(lat, lng), photon(lat, lng)]);
  const a = full.status === "fulfilled" ? full.value : [];
  const b = quick.status === "fulfilled" ? quick.value : [];
  return a.length >= b.length ? a : b;
}

/**
 * الأماكن حول المستخدم — الأقربُ أوّلاً، في كيلومتر.
 *
 * `reverseGeocode` تردّ أقرب عنوان — وغالباً شارعاً — وهذا لا يقول أين
 * أنت: في المقهى أم في المطعم المجاور. فهنا نسأل عن المعالم المسمّاة
 * حولك، ويختار صاحبها بنفسه.
 *
 * قوقل إن كان له مفتاح، وOpenStreetMap إن لم يكن أو فشل. والفشلان معاً
 * قائمةٌ فارغة: الواجهة تُبقي «أقرب عنوان» فلا يتعطّل النشر.
 */
export async function nearbyPlaces(
  lat: number,
  lng: number,
  limit = 60,
): Promise<{ places: NearbyPlace[]; source: "google" | "osm" }> {
  const key = process.env.GOOGLE_PLACES_KEY;
  let places: NearbyPlace[] = [];
  let source: "google" | "osm" = "osm";
  if (key) {
    places = await google(lat, lng, key).catch(() => []);
    if (places.length) source = "google";
  }
  if (!places.length) places = await openStreetMap(lat, lng).catch(() => []);

  // المعرّفُ مرّةً واحدة (الطلبان يتقاطعان)، والاسمُ مرّةً — الأقربُ منه —
  // فالسلسلةُ لا تملأ القائمة بفروعها.
  const ids = new Set<string>();
  const names = new Set<string>();
  return {
    source,
    places: places
      .filter((place) => place.meters <= RADIUS_M)
      .sort((a, b) => a.meters - b.meters)
      .filter((place) => (ids.has(place.id) ? false : (ids.add(place.id), true)))
      .filter((place) => (names.has(place.name) ? false : (names.add(place.name), true)))
      .slice(0, limit),
  };
}
