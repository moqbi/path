import { prisma } from "@athar/db";

/**
 * فحصُ المعرّف واقتراحُه (القاعدة ٣٧٧) — الشروطُ نفسُها التي يفحص بها `saveProfile`:
 * حروفٌ إنجليزيّة صغيرة وأرقامٌ و`_` من ثلاثةٍ إلى عشرين، ولا يُحجز معرّفُ غيرك.
 * والاقتراحُ من الاسم نفسه: العربيُّ يُكتب بحروفٍ لاتينيّة (`latinOf`)، ثمّ ما يُطلب
 * من القاعدة ما زال متاحاً وحده.
 */
const HANDLE = /^[a-z0-9_]{3,20}$/;

const MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ء: "", ئ: "e", ؤ: "o", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h",
  خ: "kh", د: "d", ذ: "th", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", و: "w",
  ي: "y", ى: "a", پ: "p", چ: "ch", گ: "g", ڤ: "v", " ": "_",
};

/** أشيعُ الأسماء بكتابتها المعروفة — الحرفُ بالحرف يُسقط الحركات فيخرج «mhmd». */
const KNOWN: Record<string, string> = {
  محمد: "mohammed", احمد: "ahmed", عبدالله: "abdullah", عبدالرحمن: "abdulrahman", عبدالعزيز: "abdulaziz",
  عبدالمجيد: "abdulmajeed", خالد: "khalid", سعود: "saud", فهد: "fahad", سلطان: "sultan", نايف: "naif",
  تركي: "turki", بندر: "bandar", ماجد: "majed", فيصل: "faisal", سلمان: "salman", بدر: "bader",
  مشعل: "mishal", عادل: "adel", حمد: "hamad", حسن: "hassan", حسين: "hussain", ابراهيم: "ibrahim",
  علي: "ali", عمر: "omar", يوسف: "yousef", ناصر: "nasser", سعد: "saad", ياسر: "yasser", زياد: "ziyad",
  نوره: "noura", نورة: "noura", فاطمه: "fatima", فاطمة: "fatima", ساره: "sara", سارة: "sara", ريم: "reem",
  مريم: "maryam", منيره: "munira", منيرة: "munira", هيا: "haya", لطيفه: "latifa", لطيفة: "latifa",
  نوف: "nouf", شهد: "shahad", ريما: "rima", لمى: "lama", جود: "jood", دانه: "dana", دانة: "dana",
  عبير: "abeer", اسماء: "asma", هند: "hind", غاده: "ghada", غادة: "ghada", رهف: "rahaf", لين: "leen",
  العتيبي: "alotaibi", الشهري: "alshehri", القحطاني: "alqahtani", الدوسري: "aldosari",
  الغامدي: "alghamdi", الزهراني: "alzahrani", الحربي: "alharbi", المطيري: "almutairi",
  العنزي: "alanazi", الشمري: "alshammari", السبيعي: "alsubaie", الرشيدي: "alrashidi",
  الشهراني: "alshahrani", العمري: "alomari", المالكي: "almalki", السهلي: "alsahli",
};

function wordOf(word: string): string {
  const plain = word.replace(/[أإآ]/g, "ا");
  if (KNOWN[plain]) return KNOWN[plain];
  const body = plain.startsWith("ال") && plain.length > 3 ? plain.slice(2) : plain;
  const latin = [...body]
    .map((ch, i, all) => {
      // الواوُ والياءُ في وسط الكلمة حرفا مدٍّ في الغالب.
      if (ch === "و" && i > 0) return "o";
      if (ch === "ي" && i > 0 && i < all.length - 1) return "i";
      if (ch === "ي" && i === all.length - 1) return "i";
      return ch in MAP ? MAP[ch] : /[a-z0-9_]/.test(ch) ? ch : "";
    })
    .join("");
  return body === plain ? latin : `al${latin}`;
}

/** الاسمُ بحروفٍ لاتينيّة صالحةٍ لمعرّف — «نورة العتيبي» ← noura_alotaibi. */
export function latinOf(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map(wordOf)
    .filter(Boolean)
    // كلمةٌ كاملةٌ أو لا شيء: «abdulrahman_abdulazi» يُقرأ خطأً.
    .reduce((out, word) => {
      const next = out ? `${out}_${word}` : word;
      return next.length <= 20 ? next : out || word.slice(0, 20);
    }, "");
}

const cleanOf = (raw: string) => raw.trim().replace(/^@/, "").toLowerCase();

async function suggest(userId: string, seed: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, memberNo: true } });
  const fromName = latinOf(user?.name ?? "");
  const first = fromName.split("_")[0] ?? "";
  const bases = [...new Set([seed, fromName, first].filter((b) => b.length >= 3))];
  if (!bases.length) bases.push("athar");
  const year = String(new Date().getFullYear()).slice(2);
  const pool = new Set<string>();
  for (const base of bases) {
    pool.add(base);
    // اللاحقةُ على أصلٍ يتّسع لها: معرّفٌ مقصوصٌ في وسط اسمٍ يُقرأ خطأً.
    const short = base.length > 16 ? base.split("_")[0].slice(0, 16) : base;
    if (user?.memberNo) pool.add(`${short}${user.memberNo}`);
    pool.add(`${short}_${year}`);
    pool.add(`${short}${Math.floor(10 + Math.random() * 89)}`);
  }
  const candidates = [...pool].filter((h) => HANDLE.test(h));
  const taken = await prisma.user.findMany({
    where: { handle: { in: candidates }, id: { not: userId } },
    select: { handle: true },
  });
  const busy = new Set(taken.map((row) => row.handle));
  return candidates.filter((h) => !busy.has(h)).slice(0, 3);
}

export async function checkHandle(userId: string, raw: string) {
  const handle = cleanOf(raw);
  if (!handle) return { ok: null, suggestions: await suggest(userId, "") };
  if (!HANDLE.test(handle)) {
    return { ok: false, error: "حروف إنجليزية وأرقام و_ ، من ٣ إلى ٢٠", suggestions: await suggest(userId, latinOf(handle)) };
  }
  const taken = await prisma.user.findFirst({ where: { handle, id: { not: userId } }, select: { id: true } });
  if (taken) return { ok: false, error: "المعرّف محجوز", suggestions: await suggest(userId, handle.slice(0, 16)) };
  return { ok: true, suggestions: [] as string[] };
}
