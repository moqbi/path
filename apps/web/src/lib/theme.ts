/** لونٌ سداسي كامل — لا اختصار ولا اسم لون. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** ألوان الثيم السبعة: ما يُسأل عنه المشرف، وما عداها يُشتقّ منها. */
export const PALETTE_KEYS = [
  "paper",
  "card",
  "ink",
  "accent",
  "onAccent",
  "chrome",
  "chromeInk",
] as const;

export type Palette = Record<(typeof PALETTE_KEYS)[number], string> & {
  /**
   * حبرُ ما يُكتب على الأرضية لا على بطاقة — اختياريّ: ثيمٌ أرضيتُه داكنة
   * وبطاقاتُه فاتحة يحتاج حبرين. وبلاه يُختار بالتباين (`groundInkOf`).
   */
  groundInk?: string;
};

/**
 * يقرأ ألوان الثيم المحفوظة (JSON)، ويردّ `null` لأي شيء غير مكتمل —
 * فثيمٌ بألوانٍ ناقصة يُلبس التطبيقَ نصفَ ثوب.
 */
export function parsePalette(raw: string | null | undefined): Palette | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const key of PALETTE_KEYS) {
      const value = data[key];
      if (typeof value !== "string" || !HEX_COLOR.test(value)) return null;
      out[key] = value;
    }
    if (typeof data.groundInk === "string" && HEX_COLOR.test(data.groundInk)) {
      out.groundInk = data.groundInk;
    }
    return out as Palette;
  } catch {
    return null;
  }
}

/** لونٌ بشفافية: `#rrggbb` إلى `rgba()` — الحجاب يُبنى من لون الثيم نفسه. */
function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * رسمُ الثيم في المتجر وغلافُه الاحتياطيّ من ألوانه نفسها: لمستُه فبطاقتُه
 * فأرضيتُه. ثيمٌ بألوانٍ يُضبط مرّةً واحدة — حقلُ التدرّج كان يبقى كهرمانيّاً
 * فتُعرض أيقونتُه بغير ألوانه. واللونُ الأوّل اللمسة: الجوّال يرسم الأوّل وحده.
 */
export function paletteSpec(palette: Palette): string {
  return `linear-gradient(135deg,${palette.accent},${palette.card} 55%,${palette.paper})`;
}

/** إضاءةُ لونٍ نسبيّة كما في WCAG. */
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
 * ونسختُه على الجوّال في `theme/tokens.ts` حرفاً بحرف.
 */
export function groundInkOf(palette: Pick<Palette, "paper" | "ink" | "groundInk">): string {
  if (palette.groundInk) return palette.groundInk;
  if (contrast(palette.ink, palette.paper) >= 3) return palette.ink;
  const dark = "#14212b";
  const light = "#f7f5ef";
  return contrast(dark, palette.paper) >= contrast(light, palette.paper) ? dark : light;
}

/**
 * ثوب التطبيق كاملاً من سبعة ألوان.
 *
 * الثيم ليس خلفيةً تتبدّل: الأرضية والبطاقات والحبر واللمسة والشريطان
 * كلها تلبس ألوانه. وما عدا السبعة يُشتقّ بـ`color-mix` لا يُسأل عنه
 * المشرف — درجاتُ لونٍ واحد لا قراراتٌ مستقلة.
 */
/**
 * ورقُ الحقول: الأرضيةُ إن قُرئ عليها حبرُ البطاقة، وإلّا البطاقةُ بلمسةٍ من حبرها —
 * ثيمٌ أرضيتُه داكنة وحبرُه داكن كان يُلبس كلَّ حقلٍ داخل بطاقةٍ فاتحة كتلةً داكنة.
 * ونسختُه على الجوّال `fieldOf` في `theme/tokens.ts`.
 */
export function fieldOf(palette: Pick<Palette, "paper" | "card" | "ink">): string {
  if (contrast(palette.ink, palette.paper) >= 3) return palette.paper;
  return `color-mix(in srgb, ${palette.ink} 7%, ${palette.card})`;
}

export function themeVars(palette: Palette): React.CSSProperties {
  const { card, ink, accent, onAccent, chrome, chromeInk } = palette;
  const paper = fieldOf(palette);
  const on = (fg: string, bg: string, pct: number) =>
    `color-mix(in srgb, ${fg} ${pct}%, ${bg})`;
  const ground = groundInkOf(palette);
  const solid = palette.paper;

  return {
    "--color-ground": palette.paper,
    "--color-paper": paper,
    "--color-card": card,
    "--color-chip": on(ink, paper, 10),
    "--color-line": on(ink, paper, 15),

    "--color-ink": ink,
    "--color-ink-2": on(ink, paper, 80),
    "--color-muted": on(ink, paper, 60),
    "--color-faint": on(ink, paper, 45),

    "--color-ground-ink": ground,
    "--color-ground-ink-2": on(ground, solid, 80),
    "--color-ground-muted": on(ground, solid, 60),
    "--color-ground-faint": on(ground, solid, 45),
    "--color-ground-line": on(ground, solid, 15),

    "--color-clay": accent,
    "--color-clay-ink": on(accent, ink, 62),
    "--color-clay-soft": on(accent, card, 18),
    "--color-on-brand": onAccent,

    "--color-gold": accent,
    "--color-gold-ink": on(accent, ink, 62),
    "--color-gold-soft": on(accent, card, 18),
    "--color-gold-line": on(accent, card, 34),

    "--color-chrome": chrome,
    "--color-chrome-2": on(chromeInk, chrome, 12),
    "--color-chrome-ink": chromeInk,
    "--color-chrome-muted": on(chromeInk, chrome, 58),
    "--color-chrome-line": on(chromeInk, chrome, 20),

    "--color-night": chrome,
    "--color-night-2": on(chromeInk, chrome, 10),
  } as React.CSSProperties;
}

/** حجاب الخلفية بلون أرضية الثيم نفسها، لا بلون الورق الافتراضي. */
export function veilOf(palette: Palette | null): string {
  const ground = palette?.paper ?? "#f7f5ef";
  return `linear-gradient(${alpha(ground, 0.7)},${alpha(ground, 0.7)})`;
}
