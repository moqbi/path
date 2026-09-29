import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

/**
 * الأماكن من خرائط آبل على الآيفون — **بقرار المالك** بعد مراجعة آبل.
 *
 * الوحدةُ الأصليّة في `modules/apple-places` (Swift ← MapKit): تُسأل على
 * الجهاز نفسه بلا مفتاحٍ ولا حصّة، وتعرف أحياءَ المملكة أكثر من
 * OpenStreetMap. و**اختياريّةٌ** (`requireOptionalNativeModule`): على
 * أندرويد والمعاينة وأيّ بناءٍ قديم لا وحدةَ، فتردّ `null` ويعود السؤالُ
 * إلى الخادم (`/v1/places/*`) كما كان — لا إقلاعَ يسقط لغيابها (القاعدة ١٢٤).
 */
type Row = { id: string; name: string; category: string | null; meters: number };
type Native = {
  nearby(lat: number, lng: number, radius: number): Promise<Row[]>;
  search(query: string, lat: number, lng: number): Promise<Row[]>;
};

const native = Platform.OS === "ios" ? requireOptionalNativeModule<Native>("ApplePlaces") : null;

export const hasApplePlaces = Boolean(native);

export type ApplePlace = { id: string; name: string; kind: string | null; meters: number };

/** فئاتُ آبل بالعربية — ما لم يُذكر هنا يُعرض بلا فئة لا باسمه الإنجليزيّ. */
const KIND: Record<string, string> = {
  Airport: "مطار",
  AmusementPark: "مدينة ألعاب",
  Aquarium: "أحياء مائية",
  ATM: "صرّاف",
  Bakery: "مخبز",
  Bank: "بنك",
  Beach: "شاطئ",
  Brewery: "مشروبات",
  Cafe: "مقهى",
  Campground: "مخيّم",
  CarRental: "تأجير سيارات",
  EVCharger: "شحن سيارات",
  FireStation: "دفاع مدني",
  FitnessCenter: "نادٍ رياضي",
  FoodMarket: "تموينات",
  GasStation: "محطة وقود",
  Hospital: "مستشفى",
  Hotel: "فندق",
  Laundry: "مغسلة",
  Library: "مكتبة",
  Marina: "مرسى",
  MovieTheater: "سينما",
  Museum: "متحف",
  NationalPark: "منتزه وطني",
  Park: "حديقة",
  Parking: "مواقف",
  Pharmacy: "صيدلية",
  Police: "شرطة",
  PostOffice: "بريد",
  PublicTransport: "نقل عام",
  Restaurant: "مطعم",
  Restroom: "دورات مياه",
  School: "مدرسة",
  Stadium: "ملعب",
  Store: "متجر",
  Theater: "مسرح",
  University: "جامعة",
  Winery: "مشروبات",
  Zoo: "حديقة حيوان",
  Bowling: "بولينغ",
  Golf: "غولف",
  MiniGolf: "غولف مصغّر",
  Mosque: "مسجد",
  Spa: "سبا",
  Beauty: "تجميل",
  Hiking: "مسار مشي",
  Landmark: "معلم",
  MusicVenue: "مسرح موسيقى",
  Planetarium: "قبة فلكية",
  Skating: "تزلّج",
  Swimming: "مسبح",
  Tennis: "تنس",
  Volleyball: "كرة طائرة",
  Automotive: "سيارات",
  ConventionCenter: "مركز معارض",
  Distillery: "مشروبات",
  Fairground: "ساحة فعاليات",
  Fishing: "صيد",
  Kayaking: "قوارب",
  RVPark: "مخيّم",
  Skiing: "تزلّج",
  Surfing: "ركوب أمواج",
  AnimalService: "خدمات حيوانات",
  Baseball: "بيسبول",
  Basketball: "كرة سلة",
  Castle: "قلعة",
  Fortress: "حصن",
  GoKart: "كارتينغ",
  RockClimbing: "تسلّق",
  Soccer: "كرة قدم",
};

function kindOf(category: string | null): string | null {
  if (!category) return null;
  return KIND[category.replace(/^MKPOICategory/, "")] ?? null;
}

function shape(rows: Row[]): ApplePlace[] {
  return rows.map((row) => ({ id: row.id, name: row.name, kind: kindOf(row.category), meters: row.meters }));
}

/** المعالم المسمّاة في كيلومترٍ حول النقطة، الأقربُ أوّلاً — أو `null` بلا وحدة. */
export async function appleNearby(lat: number, lng: number): Promise<ApplePlace[] | null> {
  if (!native) return null;
  return shape(await native.nearby(lat, lng, 1000));
}

/** بحثٌ بالاسم قرب النقطة — أو `null` بلا وحدة. */
export async function appleSearch(query: string, lat: number, lng: number): Promise<ApplePlace[] | null> {
  if (!native) return null;
  return shape(await native.search(query, lat, lng));
}
