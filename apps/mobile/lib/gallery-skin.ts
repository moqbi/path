/**
 * ثوبُ قاعة المعرض (القاعدة ٣٤٦) — كلُّ لونٍ ومقاسٍ يُرسم في القاعة من هنا، لا من
 * الشاشة: الجدارُ والسقفُ والأرضيّة والضوءُ واللافتة، وإطارُ كلّ نوع. فصنفُ «المعرض»
 * القادم في المتجر ثوبٌ بهذا الشكل يُلبَس مكانَ `HALL_SKIN` بلا لمس الشاشة —
 * ونسختُه في الويب (`src/lib/gallery-skin.ts`) حرفاً بحرف.
 *
 * ألوانٌ ثابتةٌ لا تتبع ثيمَ التطبيق: القاعةُ مكانٌ له جدارُه، كالكتاب (القاعدة ٢٥٦).
 */
export type HallSkin = {
  id: string;
  name: string;
  /** الجدارُ ولونُ ظلّه أسفلَه، والسقفُ (شريطٌ في أعلى القاعة)، والأرضيّةُ وحافّتُها. */
  wall: string;
  wallShade: string;
  ceiling: string;
  floor: string;
  floorEdge: string;
  /** ضوءٌ يسقط على اللوحة الحاليّة — لونُه في مركزه، ويذوب إلى الشفافيّة. */
  light: string;
  /** لافتةُ الجدار («جدار أكتوبر») وبطاقةُ الشرح تحت اللوحة. */
  sign: { bg: string; ink: string; muted: string };
  placard: { bg: string; ink: string; muted: string };
  /** إطارُ الصورة: لونُه وعرضُه، والبطانةُ (passe-partout) بين الإطار والصورة. */
  photo: { frame: string; width: number; mat: string; matWidth: number };
  /** لوحةُ الخاطرة، ولوحةُ المكان النحاسيّة، والأسطوانة، وحبلُ آثار+. */
  plaque: { bg: string; ink: string; edge: string };
  brass: { bg: string; ink: string; edge: string };
  vinyl: { disc: string; groove: string };
  rope: { cord: string; post: string };
  /** شريحةُ الشهر المختار في شريط الشهور. */
  accent: { bg: string; ink: string };
};

export const HALL_SKIN: HallSkin = {
  id: "classic",
  name: "القاعة الكلاسيكية",
  wall: "#D9CFBC",
  wallShade: "#CBBFA8",
  ceiling: "#1E2B36",
  floor: "#7A6248",
  floorEdge: "#5E4A35",
  light: "rgba(255,236,196,0.95)",
  sign: { bg: "#F4EEE2", ink: "#0E1A24", muted: "#6B6152" },
  placard: { bg: "#FBF8F1", ink: "#0E1A24", muted: "#6B6152" },
  photo: { frame: "#B8892F", width: 10, mat: "#F4EEE2", matWidth: 9 },
  plaque: { bg: "#FBF8F1", ink: "#0E1A24", edge: "#E2D7C2" },
  brass: { bg: "#C99B3E", ink: "#2A1E0C", edge: "#9C7526" },
  vinyl: { disc: "#15191D", groove: "#2B3238" },
  rope: { cord: "#9E2B33", post: "#C99B3E" },
  accent: { bg: "#F6B93B", ink: "#0E1A24" },
};
