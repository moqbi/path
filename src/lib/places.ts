import "server-only";

/**
 * تحويل الإحداثيات إلى اسم مكان عربي.
 *
 * يجري على الخادم لا في المتصفح: Nominatim تشترط تعريفاً بالتطبيق في
 * ترويسة الطلب، ولأن إخفاء مواقع المستخدمين عن طرف ثالث أفضل حين يمكن.
 * الفشل ليس خطأً يوقف النشر — تُحفظ الإحداثيات ويبقى الاسم فارغاً.
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
      headers: { "User-Agent": "AthrApp/0.1 (https://athr.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return { name: null, city: null };

    const data = (await response.json()) as {
      name?: string;
      address?: Record<string, string>;
    };
    const address = data.address ?? {};
    const city =
      address.city ?? address.town ?? address.village ?? address.state ?? null;
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

/**
 * الأماكن حول المستخدم من OpenStreetMap عبر Photon.
 *
 * `reverseGeocode` تردّ أقرب عنوان — وغالباً شارعاً — وهذا لا يقول أين
 * أنت: في المقهى أم في المطعم المجاور. فهنا نسأل عن المعالم المسمّاة
 * حولك مرتّبةً بالأقرب، ويختار صاحبها بنفسه.
 *
 * ولماذا Photon لا Overpass: الأخير يمهل ثم يردّ ٥٠٤ من خوادمه العامة،
 * وهذا طلبٌ واحد سريع بلا لغةٍ محدّدة (`lang=ar` يرفضه) ولا وسوم.
 *
 * الفشل يردّ قائمةً فارغة: الواجهة تُبقي «أقرب عنوان» فلا يتعطّل النشر.
 */
export async function nearbyPlaces(
  lat: number,
  lng: number,
  limit = 50,
): Promise<NearbyPlace[]> {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("limit", String(limit));

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AthrApp/0.1; +https://athr.app)" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return [];

    const data = (await response.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    const places: NearbyPlace[] = [];

    for (const feature of data.features ?? []) {
      const props = feature.properties ?? {};
      const key = String(props.osm_key ?? "");
      if (!POI_KEYS.has(key)) continue;

      const name = String(props.name ?? "").trim();
      if (!name || seen.has(name)) continue;

      const [pointLng, pointLat] = feature.geometry?.coordinates ?? [];
      if (pointLat === undefined || pointLng === undefined) continue;

      const value = String(props.osm_value ?? "");
      seen.add(name);
      places.push({
        id: `${props.osm_type ?? "n"}${props.osm_id ?? name}`,
        name,
        kind: KIND_AR[value] ?? null,
        meters: metersBetween(lat, lng, pointLat, pointLng),
        lat: pointLat,
        lng: pointLng,
      });
    }

    return places.sort((a, b) => a.meters - b.meters).slice(0, 18);
  } catch {
    return [];
  }
}
