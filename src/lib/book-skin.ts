/**
 * نسخةُ `packages/shared/src/book-skin.ts` حرفاً بحرف.
 *
 * أغلفةُ الكتاب في المتجر (القاعدة ٤٠٥): صنفٌ من نوع `BOOK` يحمل ثوبَ غلافٍ في
 * `StoreItem.bookSkin` — لونان للأرضية، وحبر، ولمسة، ونقشٌ يُرسم من الكود — ومعه
 * صورةُ الصنف (`mediaId`) إن رُفعت فتملأ الغلافَ بدل النقش. فيُضاف غلافٌ من اللوحة
 * بلا لمس الكود ولا نشر نسخة.
 *
 * والنقشُ نصُّ SVG واحدٌ تقرؤه الأوجهُ الثلاثة — الـPDF والويب بأيديهما، والجوّالُ
 * بـ`SvgXml` — فلا يختلف غلافٌ بين ما يُرى وما يُطبع. ونسختُه حرفاً بحرف في
 * `src/lib/book-skin.ts` لمشروع الجذر الذي لا يرى الحزم.
 */
export const BOOK_PATTERNS = ["none", "dunes", "stars", "waves", "arches"] as const;
export type BookPattern = (typeof BOOK_PATTERNS)[number];
export const BOOK_PATTERN_LABEL: Record<BookPattern, string> = {
  none: "بلا نقش",
  dunes: "كثبان",
  stars: "نجوم وهلال",
  waves: "موج",
  arches: "أقواس",
};

export type BookSkin = { bg: string; bg2: string; ink: string; accent: string; pattern: BookPattern };

export const BOOK_SKIN_FIELDS = [
  { key: "bg", label: "الأرضية (أعلى)", fallback: "#0E1A24" },
  { key: "bg2", label: "الأرضية (أسفل)", fallback: "#08121A" },
  { key: "ink", label: "الحبر", fallback: "#F7F5EF" },
  { key: "accent", label: "اللمسة", fallback: "#F6B93B" },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** ما في القاعدة أو ما كتبه المشرف: ما فسد يأخذ افتراضَه فلا ينكسر غلاف. */
export function bookSkinOf(raw: unknown): BookSkin {
  let value: Record<string, unknown> = {};
  try {
    value = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  } catch {
    value = {};
  }
  if (!value || typeof value !== "object") value = {};
  const color = (key: (typeof BOOK_SKIN_FIELDS)[number]["key"]) => {
    const got = value[key];
    return typeof got === "string" && HEX.test(got) ? got.toUpperCase() : BOOK_SKIN_FIELDS.find((one) => one.key === key)!.fallback;
  };
  const pattern = BOOK_PATTERNS.includes(value.pattern as BookPattern) ? (value.pattern as BookPattern) : "none";
  return { bg: color("bg"), bg2: color("bg2"), ink: color("ink"), accent: color("accent"), pattern };
}

/** تدرّجُ بطاقة الصنف في المتجر — من ثوبه (كـ`specFor` للثيم). */
export function bookSpec(skin: BookSkin): string {
  return `linear-gradient(160deg, ${skin.bg}, ${skin.bg2})`;
}

/**
 * النقشُ على لوحةٍ بنسبة A5 (١٤٨×٢١٠) يملأ الغلاف كلَّه خلف ما عليه.
 * بألوان الثوب وشفافيّاتٍ هادئة: النقشُ أرضٌ لا موضوع.
 */
export function bookPatternSvg(skin: BookSkin): string | null {
  const a = skin.accent;
  const k = skin.ink;
  let body = "";
  switch (skin.pattern) {
    case "dunes":
      body = `
<circle cx="122" cy="30" r="11" fill="${a}" opacity=".35"/>
<path d="M0 158 C30 144 58 146 84 156 S128 168 148 156 V210 H0Z" fill="${k}" opacity=".06"/>
<path d="M0 174 C24 164 52 162 78 172 S124 188 148 176 V210 H0Z" fill="${k}" opacity=".07"/>
<path d="M0 190 C32 182 62 184 90 192 S132 202 148 198 V210 H0Z" fill="${k}" opacity=".08"/>`;
      break;
    case "stars": {
      const dots = [
        [14, 22, 0.9], [36, 40, 0.6], [62, 16, 0.8], [90, 34, 0.5], [118, 18, 0.9], [132, 50, 0.6],
        [20, 70, 0.5], [128, 86, 0.7], [10, 120, 0.6], [138, 132, 0.5], [24, 168, 0.7], [126, 178, 0.6],
        [70, 196, 0.5], [46, 140, 0.4], [104, 152, 0.4],
      ];
      body =
        dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${k}" opacity=".7"/>`).join("") +
        `<path d="M118 34 a13 13 0 1 0 9 22 a10 10 0 1 1 -9 -22z" fill="${a}" opacity=".9"/>`;
      break;
    }
    case "waves": {
      const rows: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        const y = 176 + i * 8;
        rows.push(
          `<path d="M-4 ${y} q9 -6 18.5 0 t18.5 0 t18.5 0 t18.5 0 t18.5 0 t18.5 0 t18.5 0 t18.5 0 t18.5 0" fill="none" stroke="${i % 2 ? k : a}" stroke-width="1" opacity="${(0.18 + i * 0.07).toFixed(2)}"/>`,
        );
      }
      body = rows.join("");
      break;
    }
    case "arches": {
      const cells: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        const x = 6 + i * 28;
        cells.push(
          `<path d="M${x} 210 V186 a14 14 0 0 1 28 0 V210" fill="none" stroke="${a}" stroke-width="1" opacity=".4"/>`,
          `<path d="M${x + 6} 210 V190 a8 8 0 0 1 16 0 V210" fill="${a}" opacity=".08"/>`,
        );
      }
      body = cells.join("") + `<rect x="0" y="22" width="148" height=".6" fill="${a}" opacity=".5"/><rect x="0" y="25" width="148" height=".3" fill="${a}" opacity=".35"/>`;
      break;
    }
    default:
      return null;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 148 210" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
}
