/**
 * هوية آثار على الموبايل — نفس الأرقام التي في `globals.css` حرفاً بحرف.
 *
 * تُكتب مرةً هنا وتُقرأ من `tailwind.config` ومن أيّ نمطٍ مباشر: لونان
 * متقاربان في ملفّين يصيران لونين مختلفين بعد شهر.
 */
const DEFAULTS = {
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

/**
 * والألوان تتبدّل: الثيم ثوبٌ لا خلفية (القاعدة ٧٢).
 *
 * على الويب سبعةُ ألوانٍ تُحقن متغيّراتِ CSS على `.shell` فيتبدّل
 * التطبيق كلّه بلا أن يعرف مكوّنٌ واحد. ولا متغيّراتِ نمطٍ هنا:
 * ستّون ملفّاً تستورد `colors` مرّةً عند التحميل، فلو كان كائناً
 * ثابتاً بقي ما اشتراه المستخدم محفوظاً في القاعدة لا يُرى على شاشته —
 * وهذا ما كان.
 *
 * فالكائن **يتبدّل في مكانه** (`Object.assign`)، ويُرفع رقمُ نسخةٍ
 * يقرؤه الجذر فيُعيد بناء الشجرة. والمستوردون يقرؤون المرجعَ نفسه،
 * فلا ملفَّ يُعدَّل ولا `useTheme()` يُكتب في كل سطر.
 */
export const colors: { -readonly [K in keyof typeof DEFAULTS]: string } = { ...DEFAULTS };

/** ألوان الثيم السبعة — نسخةٌ من `src/lib/theme.ts` في الويب. */
type Palette = {
  paper: string;
  card: string;
  ink: string;
  accent: string;
  onAccent: string;
  chrome: string;
  chromeInk: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * مزجُ لونين بنسبة — بديلُ `color-mix` التي لا وجود لها هنا.
 *
 * والنسبُ هي نسبُ الويب حرفاً بحرف، وإلّا خرج الثيمُ الواحد بدرجتين
 * بين الشاشة والمتصفّح.
 */
function mix(fg: string, bg: string, pct: number): string {
  const read = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = read(fg);
  const [br, bg_, bb] = read(bg);
  const k = pct / 100;
  const one = (a: number, b: number) =>
    Math.round(a * k + b * (1 - k)).toString(16).padStart(2, "0");
  return `#${one(ar, br)}${one(ag, bg_)}${one(ab, bb)}`;
}

/** يقرأ ألوان الثيم المحفوظة، ويردّ `null` لأيّ نقصٍ: نصفُ ثوبٍ لا يُلبس. */
function parsePalette(raw: string | null | undefined): Palette | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const keys = ["paper", "card", "ink", "accent", "onAccent", "chrome", "chromeInk"] as const;
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = data[key];
      if (typeof value !== "string" || !HEX.test(value)) return null;
      out[key] = value;
    }
    return out as Palette;
  } catch {
    return null;
  }
}

let version = 0;
const watchers = new Set<() => void>();

/** رقمُ النسخة: يقرؤه الجذر بـ`useSyncExternalStore` فيُعيد البناء عند التبديل. */
export const themeStore = {
  subscribe(fn: () => void) {
    watchers.add(fn);
    return () => watchers.delete(fn);
  },
  get: () => version,
};

/**
 * يُلبس التطبيقَ ثيماً، أو يعيده إلى ثوبه الأصليّ بـ`null`.
 *
 * وما عدا السبعة يُشتقّ هنا كما يُشتقّ هناك. ويبقى المرجانيّ
 * (`live`, `brand2`) على حاله: دلالتُه ثابتة لا تتبع ثيماً (القاعدة ٧).
 */
export function applyTheme(raw: string | null | undefined): void {
  const p = parsePalette(raw);
  const next = p
    ? {
        paper: p.paper,
        card: p.card,
        chip: mix(p.ink, p.paper, 10),
        line: mix(p.ink, p.paper, 15),

        ink: p.ink,
        ink2: mix(p.ink, p.paper, 80),
        muted: mix(p.ink, p.paper, 60),
        faint: mix(p.ink, p.paper, 45),

        clay: p.accent,
        clayInk: mix(p.accent, p.ink, 62),
        claySoft: mix(p.accent, p.card, 18),
        onBrand: p.onAccent,

        gold: p.accent,
        goldInk: mix(p.accent, p.ink, 62),
        goldSoft: mix(p.accent, p.card, 18),
        goldLine: mix(p.accent, p.card, 34),

        chrome: p.chrome,
        chrome2: mix(p.chromeInk, p.chrome, 12),
        chromeInk: p.chromeInk,
        chromeMuted: mix(p.chromeInk, p.chrome, 58),
        chromeLine: mix(p.chromeInk, p.chrome, 20),

        night: p.chrome,
        night2: mix(p.chromeInk, p.chrome, 10),
      }
    : DEFAULTS;

  // لا إعادةَ بناءٍ بلا تغيير: الجذر يقرأ هذا الرقم مع كلّ تحديثٍ لـ`me`.
  const same = (Object.keys(next) as (keyof typeof next)[]).every((k) => colors[k] === next[k]);
  if (same) return;

  Object.assign(colors, DEFAULTS, next);
  version += 1;
  for (const fn of watchers) fn();
}

/** توقيع العلامة: كهرماني ← مرجاني. لا يُستعمل إلا حيث يستحق. */
export const brandGradient = ["#f6b93b", "#ff7a5a"] as const;

export const fonts = {
  body: "IBMPlexSansArabic",
  display: "Tajawal",
  latin: "Montserrat",
} as const;
