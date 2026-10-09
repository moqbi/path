/**
 * هوية آثار على الموبايل — نفس الأرقام التي في `globals.css` حرفاً بحرف.
 *
 * تُكتب مرةً هنا وتُقرأ من `tailwind.config` ومن أيّ نمطٍ مباشر: لونان
 * متقاربان في ملفّين يصيران لونين مختلفين بعد شهر.
 */
const DEFAULTS = {
  paper: "#eae5d9",
  /**
   * أرضيةُ الشاشة نفسها — `paper` ما لم يكن للثيم صورة، وشفّافةٌ إن كانت:
   * الصورةُ وحجابُها مرسومان في الجذر خلف الشاشات كلّها (القاعدة ٤٧)، وأرضيةٌ
   * مصمتة في كل شاشة كانت تحجبها — «صورة الثيم ما تظهر على الجوال».
   * و`paper` يبقى لما يُرسم على الورق داخل الشاشة من حقولٍ وأقراص.
   */
  ground: "#eae5d9",
  /** أرضيةُ الثيم مصمتةً ولو كان للثيم صورة — لما يجب أن يطابقها (حلقةُ القصّة، الصفُّ المسحوب). */
  groundSolid: "#eae5d9",
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

  /**
   * حبرُ ما يُكتب على الأرضية مباشرةً لا على بطاقة — سطورُ الأحداث وعناوينُ
   * الأيام والساعات والاسمُ والأرقام في الملف. ثيمٌ أرضيتُه داكنة وبطاقاتُه
   * فاتحة يحتاج حبرين: حبرُ البطاقة الداكن يذوب في الأرضية.
   */
  groundInk: "#14212b",
  groundInk2: "#3d4a55",
  groundMuted: "#667380",
  groundFaint: "#8b96a1",
  groundLine: "#d8d2c2",

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
  /** اختياريّ: بلاه يُختار حبرُ البطاقة إن قُرئ على الأرضية، وإلّا ضدُّها. */
  groundInk?: string;
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

/** إضاءةُ لونٍ نسبيّة كما في WCAG — نسخةُ `src/lib/theme.ts`. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * حبرُ الأرضية: ما اختاره المشرف، وإلّا حبرُ البطاقة إن قُرئ على الأرضية،
 * وإلّا الأوضحُ من حبرين ثابتين — فثيمٌ قديمٌ بأرضيةٍ داكنة يُصلح نفسه بلا تعديل.
 */
export function groundInkOf(p: { paper: string; ink: string; groundInk?: string }): string {
  if (p.groundInk) return p.groundInk;
  if (contrast(p.ink, p.paper) >= 3) return p.ink;
  const dark = "#14212b";
  const light = "#f7f5ef";
  return contrast(dark, p.paper) >= contrast(light, p.paper) ? dark : light;
}

/** ورقُ الحقول: الأرضيةُ إن قُرئ عليها حبرُ البطاقة، وإلّا البطاقةُ بلمسةٍ من حبرها. */
export function fieldOf(p: { paper: string; card: string; ink: string }): string {
  return contrast(p.ink, p.paper) >= 3 ? p.paper : mix(p.ink, p.card, 7);
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
    if (typeof data.groundInk === "string" && HEX.test(data.groundInk)) out.groundInk = data.groundInk;
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
export function applyTheme(raw: string | null | undefined, image = false): void {
  const p = parsePalette(raw);
  const paper = p?.paper ?? DEFAULTS.paper;
  const ground = image ? "transparent" : paper;
  const gi = p ? groundInkOf(p) : DEFAULTS.groundInk;
  /*
    `paper` لونان في الثوب الأصليّ: أرضيةُ الشاشة، وحقولُ البطاقات وأقراصُها.
    ثيمٌ أرضيتُه داكنة وحبرُه داكن يُبقي الأولى ويُفتّح الثانية من بطاقته — وإلّا
    كان كلُّ حقلٍ وخيارٍ داخل بطاقةٍ فاتحة كتلةً داكنة بحبرٍ داكن لا يُقرأ.
  */
  const field = p ? fieldOf(p) : DEFAULTS.paper;
  const next = p
    ? {
        ground,
        groundSolid: p.paper,
        paper: field,
        card: p.card,
        chip: mix(p.ink, field, 10),
        line: mix(p.ink, field, 15),

        ink: p.ink,
        ink2: mix(p.ink, field, 80),
        muted: mix(p.ink, field, 60),
        faint: mix(p.ink, field, 45),

        groundInk: gi,
        groundInk2: mix(gi, p.paper, 80),
        groundMuted: mix(gi, p.paper, 60),
        groundFaint: mix(gi, p.paper, 45),
        groundLine: mix(gi, p.paper, 15),

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
    : { ...DEFAULTS, ground, groundSolid: DEFAULTS.paper };

  // لا إعادةَ بناءٍ بلا تغيير: الجذر يقرأ هذا الرقم مع كلّ تحديثٍ لـ`me`.
  const same = (Object.keys(next) as (keyof typeof next)[]).every((k) => colors[k] === next[k]);
  if (same) return;

  Object.assign(colors, DEFAULTS, next);
  version += 1;
  for (const fn of watchers) fn();
}

/**
 * حجابُ صورة الثيم: أرضيةُ الثيم بشفافية ٧٠٪ — نسبةُ الويب نفسها (`veilOf`)،
 * تُبقي النصّ مقروءاً ولا تطمس الصورة.
 */
export function veil(): string {
  const hex = colors.groundSolid.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.7)`;
}

/** توقيع العلامة: كهرماني ← مرجاني. لا يُستعمل إلا حيث يستحق. */
export const brandGradient = ["#f6b93b", "#ff7a5a"] as const;

export const fonts = {
  body: "IBMPlexSansArabic",
  display: "Tajawal",
  latin: "Montserrat",
} as const;
