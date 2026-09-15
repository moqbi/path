/**
 * هوية آثار على الموبايل — نفس الأرقام التي في `globals.css` حرفاً بحرف.
 *
 * تُكتب مرةً هنا وتُقرأ من `tailwind.config` ومن أيّ نمطٍ مباشر: لونان
 * متقاربان في ملفّين يصيران لونين مختلفين بعد شهر.
 */
export const colors = {
  paper: "#eae5d9",
  card: "#fdfcf8",
  chip: "#ded8c9",

  chrome: "#0e1a24",
  chrome2: "#17242f",
  chromeInk: "#f7f5ef",
  chromeMuted: "#8c9aa5",
  chromeLine: "#223140",

  night: "#0e1a24",
  night2: "#16242f",

  ink: "#14212b",
  ink2: "#3d4a55",
  muted: "#667380",
  faint: "#8b96a1",
  line: "#d8d2c2",

  clay: "#f6b93b",
  clayInk: "#a8730f",
  claySoft: "#faedd6",
  brand2: "#ff7a5a",
  onBrand: "#0e1a24",

  live: "#d4502f",
  liveSoft: "#fae2da",

  gold: "#f6b93b",
  goldInk: "#a8730f",
  goldSoft: "#faedd6",
  goldLine: "#ecdcb6",
} as const;

/** توقيع العلامة: كهرماني ← مرجاني. لا يُستعمل إلا حيث يستحق. */
export const brandGradient = ["#f6b93b", "#ff7a5a"] as const;

export const fonts = {
  body: "IBMPlexSansArabic",
  display: "Tajawal",
  latin: "Montserrat",
} as const;
