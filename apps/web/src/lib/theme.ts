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

export type Palette = Record<(typeof PALETTE_KEYS)[number], string>;

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
 * ثوب التطبيق كاملاً من سبعة ألوان.
 *
 * الثيم ليس خلفيةً تتبدّل: الأرضية والبطاقات والحبر واللمسة والشريطان
 * كلها تلبس ألوانه. وما عدا السبعة يُشتقّ بـ`color-mix` لا يُسأل عنه
 * المشرف — درجاتُ لونٍ واحد لا قراراتٌ مستقلة.
 */
export function themeVars(palette: Palette): React.CSSProperties {
  const { paper, card, ink, accent, onAccent, chrome, chromeInk } = palette;
  const on = (fg: string, bg: string, pct: number) =>
    `color-mix(in srgb, ${fg} ${pct}%, ${bg})`;

  return {
    "--color-paper": paper,
    "--color-card": card,
    "--color-chip": on(ink, paper, 10),
    "--color-line": on(ink, paper, 15),

    "--color-ink": ink,
    "--color-ink-2": on(ink, paper, 80),
    "--color-muted": on(ink, paper, 60),
    "--color-faint": on(ink, paper, 45),

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
