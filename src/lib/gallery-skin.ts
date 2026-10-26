/**
 * ثوبُ قاعة المعرض (القاعدتان ٣٤٦ و٣٤٨) — نسخةُ `packages/shared/src/hall.ts` حرفاً بحرف:
 * مشروعُ الجذر لا يرى الحزم (القاعدة ١٤٢).
 *
 * ألوانٌ ثابتةٌ لا تتبع ثيمَ التطبيق: القاعةُ مكانٌ له جدارُه، كالكتاب (القاعدة ٢٥٦).
 */
export type HallSkin = {
  wall: string;
  wallShade: string;
  ceiling: string;
  floor: string;
  floorEdge: string;
  /** حوافُّ اللوح الخشبيّ والإفريز والقاعدة: ضوءٌ وظلٌّ من لون الجدار نفسه، لا أبيضُ وأسودُ ثابتان. */
  bevel: { light: string; dark: string };
  /** ضوءٌ يسقط على اللوحة الحاليّة — لونُه في مركزه، ويذوب إلى الشفافيّة. */
  light: string;
  sign: { bg: string; ink: string; muted: string };
  placard: { bg: string; ink: string; muted: string };
  /** إطارُ الصورة: لونُه وعرضُه، والبطانةُ بين الإطار والصورة. */
  photo: { frame: string; width: number; mat: string; matWidth: number };
  plaque: { bg: string; ink: string; edge: string };
  brass: { bg: string; ink: string; edge: string };
  vinyl: { disc: string; groove: string };
  rope: { cord: string; post: string };
  /** شريحةُ الشهر المختار وزرّا «ادخل» و«افتح اللحظة». */
  accent: { bg: string; ink: string };
};

/** الحقولُ المسطّحة كما تُحفظ وتُضبط في اللوحة: لونٌ أو رقم، وافتراضُها القاعةُ الكلاسيكية. */
export const HALL_FIELDS = [
  { key: "wall", label: "الجدار", type: "color", fallback: "#ECE3D2" },
  { key: "wallShade", label: "ظلّ الجدار", type: "color", fallback: "#D8CAB0" },
  { key: "ceiling", label: "السقف", type: "color", fallback: "#F4EEE2" },
  { key: "floor", label: "الأرضية", type: "color", fallback: "#8A6A4C" },
  { key: "floorEdge", label: "حافّة الأرضية", type: "color", fallback: "#5E4A35" },
  { key: "light", label: "الضوء", type: "color", fallback: "#FFECC4" },
  { key: "signBg", label: "اللافتة", type: "color", fallback: "#F4EEE2" },
  { key: "signInk", label: "حبر اللافتة", type: "color", fallback: "#2A2218" },
  { key: "placardBg", label: "بطاقة الشرح", type: "color", fallback: "#FBF8F1" },
  { key: "placardInk", label: "حبر البطاقة", type: "color", fallback: "#0E1A24" },
  { key: "frame", label: "إطار الصورة", type: "color", fallback: "#B8913E" },
  { key: "mat", label: "البطانة", type: "color", fallback: "#F8F2E6" },
  { key: "plaqueBg", label: "لوحة الخاطرة", type: "color", fallback: "#FBF8F1" },
  { key: "plaqueInk", label: "حبر الخاطرة", type: "color", fallback: "#0E1A24" },
  { key: "brassBg", label: "لوحة المكان", type: "color", fallback: "#C99B3E" },
  { key: "brassInk", label: "حبر المكان", type: "color", fallback: "#2A1E0C" },
  { key: "vinyl", label: "الأسطوانة", type: "color", fallback: "#15191D" },
  { key: "cord", label: "الحبل", type: "color", fallback: "#9E2B33" },
  { key: "accentBg", label: "اللمسة", type: "color", fallback: "#F6B93B" },
  { key: "accentInk", label: "حبر اللمسة", type: "color", fallback: "#0E1A24" },
  { key: "frameWidth", label: "عرض الإطار", type: "number", fallback: "5", min: 2, max: 18 },
  { key: "matWidth", label: "عرض البطانة", type: "number", fallback: "18", min: 0, max: 28 },
] as const;

export type HallFlat = Partial<Record<(typeof HALL_FIELDS)[number]["key"], string>>;

const HEX = /^#[0-9a-f]{6}$/i;

/** لونٌ بين لونين — لما يُشتقّ ولا يُسأل عنه المشرف (الحوافّ والدرجاتُ الباهتة). */
function mix(a: string, b: string, t: number): string {
  const at = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(at(a, i) * (1 - t) + at(b, i) * t));
  return `#${out.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** الحقولُ المسطّحة → الثوب. ما غاب أو فسد يأخذ افتراضَه، فثوبٌ ناقصٌ لا يكسر القاعة. */
export function hallSkinOf(raw: string | HallFlat | null | undefined): HallSkin {
  let flat: HallFlat = {};
  if (typeof raw === "string") {
    try {
      flat = JSON.parse(raw) as HallFlat;
    } catch {
      flat = {};
    }
  } else if (raw) flat = raw;
  const get = (key: (typeof HALL_FIELDS)[number]["key"]): string => {
    const field = HALL_FIELDS.find((one) => one.key === key)!;
    const value = flat[key];
    if (field.type === "number") {
      const n = Number(value);
      return Number.isFinite(n) && value !== undefined && value !== "" ? String(Math.max(field.min, Math.min(field.max, Math.round(n)))) : field.fallback;
    }
    return value && HEX.test(value) ? value : field.fallback;
  };
  const light = get("light");
  const rgb = [1, 3, 5].map((i) => parseInt(light.slice(i, i + 2), 16)).join(",");
  return {
    wall: get("wall"),
    wallShade: get("wallShade"),
    ceiling: get("ceiling"),
    floor: get("floor"),
    floorEdge: get("floorEdge"),
    bevel: { light: mix(get("wall"), "#ffffff", 0.22), dark: mix(get("wall"), "#000000", 0.2) },
    light: `rgba(${rgb},0.95)`,
    sign: { bg: get("signBg"), ink: get("signInk"), muted: mix(get("signInk"), get("signBg"), 0.45) },
    placard: { bg: get("placardBg"), ink: get("placardInk"), muted: mix(get("placardInk"), get("placardBg"), 0.45) },
    photo: { frame: get("frame"), width: Number(get("frameWidth")), mat: get("mat"), matWidth: Number(get("matWidth")) },
    plaque: { bg: get("plaqueBg"), ink: get("plaqueInk"), edge: mix(get("plaqueBg"), get("plaqueInk"), 0.12) },
    brass: { bg: get("brassBg"), ink: get("brassInk"), edge: mix(get("brassBg"), "#000000", 0.22) },
    vinyl: { disc: get("vinyl"), groove: mix(get("vinyl"), "#ffffff", 0.12) },
    rope: { cord: get("cord"), post: get("brassBg") },
    accent: { bg: get("accentBg"), ink: get("accentInk") },
  };
}

/** القاعةُ الكلاسيكية — ثوبُ من لم يلبس شيئاً. */
export const HALL_SKIN: HallSkin = hallSkinOf(null);

/** يقرأ حقولَ الثوب من نموذج اللوحة، ويردّها JSON بما صحّ منها وحده. */
export function hallFlatFrom(get: (key: string) => string | null): string {
  const out: Record<string, string> = {};
  for (const field of HALL_FIELDS) {
    const value = (get(`hall.${field.key}`) ?? "").trim();
    if (field.type === "number" ? /^\d{1,2}$/.test(value) : HEX.test(value)) out[field.key] = value.toLowerCase();
  }
  return JSON.stringify(out);
}
