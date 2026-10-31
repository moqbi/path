/**
 * «تجهيز الكتاب» لمشتركي آثار+ (القاعدة ٣٧٨) — نسخةُ `packages/shared/src/book.ts` حرفاً بحرف.
 * وأقسامٌ تُظهر وتُخفى وتُرتَّب. ونسختُه حرفاً بحرف في `src/lib/book-prefs.ts`
 * لمشروع الجذر الذي لا يرى الحزم.
 */
export const BOOK_COVERS = ["night", "paper", "minimal"] as const;
export type BookCover = (typeof BOOK_COVERS)[number];
export const BOOK_COVER_LABEL: Record<BookCover, string> = { night: "ليلي", paper: "كلاسيكي", minimal: "بسيط" };

export const BOOK_SECTIONS = ["numbers", "places", "song", "circle", "months", "end"] as const;
export type BookSection = (typeof BOOK_SECTIONS)[number];
export const BOOK_SECTION_LABEL: Record<BookSection, string> = {
  numbers: "سنتك بالأرقام",
  places: "المدن والأماكن",
  song: "أغنية سنتك",
  circle: "دائرتك",
  months: "الشهور",
  end: "الخاتمة",
};
/** الشهورُ متنُ الكتاب: تُنقل ولا تُخفى — كتابٌ بلا أيّامه غلافٌ ومقدّمة. */
export const BOOK_FIXED: BookSection[] = ["months"];
/** ما يجتمع في صفحة المقدّمة إذا تجاور. */
export const BOOK_INTRO: BookSection[] = ["numbers", "places", "song", "circle"];

export const BOOK_TITLE_MAX = 40;
export const BOOK_DEDICATION_MAX = 140;

export type BookPrefs = {
  cover: BookCover;
  title: string | null;
  dedication: string | null;
  sections: { id: BookSection; on: boolean }[];
};

export const DEFAULT_BOOK_PREFS: BookPrefs = {
  cover: "night",
  title: null,
  dedication: null,
  sections: BOOK_SECTIONS.map((id) => ({ id, on: true })),
};

/** ما في القاعدة أو ما أرسله الجهاز: المجهولُ يسقط، والمكرّرُ مرّة، والناقصُ يُلحق في آخره. */
export function cleanBookPrefs(raw: unknown): BookPrefs {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cover = BOOK_COVERS.includes(value.cover as BookCover) ? (value.cover as BookCover) : "night";
  const text = (input: unknown, max: number) => {
    if (typeof input !== "string") return null;
    const trimmed = input.trim().slice(0, max);
    return trimmed || null;
  };
  const seen = new Set<BookSection>();
  const sections: BookPrefs["sections"] = [];
  for (const row of Array.isArray(value.sections) ? value.sections : []) {
    const id = (row as { id?: unknown })?.id as BookSection;
    if (!BOOK_SECTIONS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, on: BOOK_FIXED.includes(id) ? true : (row as { on?: unknown }).on !== false });
  }
  for (const id of BOOK_SECTIONS) if (!seen.has(id)) sections.push({ id, on: true });
  return {
    cover,
    title: text(value.title, BOOK_TITLE_MAX),
    dedication: text(value.dedication, BOOK_DEDICATION_MAX),
    sections,
  };
}

/** الأقسامُ الظاهرة بترتيبها، والمتجاورةُ من المقدّمة صفحةً واحدة. */
export function bookBlocks(prefs: BookPrefs): (BookSection | BookSection[])[] {
  const out: (BookSection | BookSection[])[] = [];
  for (const { id, on } of prefs.sections) {
    if (!on) continue;
    const last = out.at(-1);
    if (BOOK_INTRO.includes(id)) {
      if (Array.isArray(last)) last.push(id);
      else out.push([id]);
    } else out.push(id);
  }
  return out;
}
