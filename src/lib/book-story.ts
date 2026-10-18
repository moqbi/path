import { ar, counted } from "./riyadh-day";

/**
 * راوي «سنتك في كتاب» — **بقرار المالك** (القاعدة ٢٥٩).
 *
 * الكتابُ لا ينسخ اللحظة كما نُشرت: يرويها لصاحبها ويقول ما جرى حولها —
 * «كنت تسمع…»، «رحت إلى… وكان معك…»، ومن تفاعل وبماذا، وما كُتب له فيها.
 * نسخةُ `apps/api/src/lib/book-story.ts` حرفاً بحرف، وتغييرُ إحداهما تغييرٌ للأخرى: ثلاثةُ
 * أوجهٍ للكتاب (الشاشة والويب والـPDF) تقرأ الجملةَ نفسها ولا تكتبها.
 *
 * دالّةٌ صافية بلا قاعدة: تأخذ ما جُمع وتردّ نصّاً. والأسماءُ فيها ما مرّره
 * الجامعُ — من دائرة صاحبها اليوم بلا محجوب (كالقاعدة ٢٣٥).
 */

export type Echo = {
  /** كلُّ من تفاعل بلا محجوب. */
  reactions: number;
  /** أكثرُ تفاعلٍ وصلها، و`emoji` للحرّ. */
  top: { kind: string; emoji: string | null; count: number } | null;
  /** أسماءٌ من الدائرة، أحدثُها أوّلاً، ثلاثةٌ على الأكثر. */
  reactors: string[];
  comments: number;
  /** تعليقٌ يُقتبس في الصفحة — من غير صاحبها. */
  quote: { name: string; text: string } | null;
};

export type StoryMoment = {
  kind: string;
  text: string | null;
  placeName: string | null;
  placeCity: string | null;
  musicTitle: string | null;
  musicArtist: string | null;
  with?: string[];
  createdAt: Date | string;
};

const ONE: Record<string, string> = {
  SMILE: "بابتسامة",
  LAUGH: "بضحكة",
  GASP: "بدهشة",
  SAD: "بمواساة",
  LOVE: "بقلب",
  CAMERA: "بكاميرا",
  CHAT: "بفقاعة كلام",
  PIN: "بدبّوس",
  SLEEPY: "بنعاس",
};

const MANY: Record<string, string> = {
  SMILE: "الابتسامات",
  LAUGH: "الضحكات",
  GASP: "الدهشة",
  SAD: "المواساة",
  LOVE: "القلوب",
  CAMERA: "الكاميرات",
  CHAT: "فقاعات الكلام",
  PIN: "الدبابيس",
  SLEEPY: "النعاس",
};

const times = (n: number, one: string, two: string, few: string, many: string) => counted(n, one, two, few, many);

/** «نورة وخالد وسارة» — العطفُ بالواو في النثر لا بالفاصلة. */
export const listNames = (list: string[]) => list.join(" و");

/** «بقلب» لتفاعلٍ واحد، و«القلوب» لأكثرها — والحرُّ يُكتب برسمه. */
export function reactionWord(top: { kind: string; emoji: string | null }, many: boolean): string {
  if (top.kind === "CUSTOM") return many ? (top.emoji ?? "إيموجي") : `بـ${top.emoji ?? "إيموجي"}`;
  return (many ? MANY : ONE)[top.kind] ?? (many ? "التفاعلات" : "بتفاعل");
}

const clock = (at: Date | string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  }).format(new Date(at));

/**
 * صوتُ الراوي بجنس صاحب الكتاب (`User.gender`، القاعدة ٢٦٠): مذكّرٌ لمن لم يختر —
 * كما كان قبل الحقل — ومؤنّثٌ بالكسرة حيث يلتبس الرسم («رحتِ»، «معكِ»)، ومحايدٌ لمن
 * اختار «أفضّل ألّا أقول» بجملٍ اسميّةٍ لا تخاطب أحداً بجنس.
 */
export type Gender = "MALE" | "FEMALE" | "UNSPECIFIED" | null | undefined;
type Voice = "m" | "f" | "n";
const voiceOf = (gender: Gender): Voice => (gender === "FEMALE" ? "f" : gender === "UNSPECIFIED" ? "n" : "m");
const pick = (v: Voice, m: string, f: string, n: string) => (v === "f" ? f : v === "n" ? n : m);

/** ما فعله صاحبُ اللحظة — بلسان الراوي إليه. */
export function leadOf(moment: StoryMoment, gender?: Gender): string {
  const v = voiceOf(gender);
  const withThem = moment.with?.length ? listNames(moment.with) : null;
  const along = (lead: string) => (withThem ? `${lead}${pick(v, "معك", "معكِ", "في الصحبة")} ${withThem}` : "");
  switch (moment.kind) {
    case "MUSIC": {
      const song = moment.musicTitle ? `«${moment.musicTitle}»` : "أغنية";
      const by = moment.musicArtist ? ` لـ${moment.musicArtist}` : "";
      return `${pick(v, "كنت تسمع", "كنتِ تسمعين", "على السمّاعة:")} ${song}${by}${along("، و")}.`;
    }
    case "PLACE": {
      const where = moment.placeName ?? "مكانٍ";
      const city = moment.placeCity && moment.placeCity !== moment.placeName ? ` في ${moment.placeCity}` : "";
      return `${pick(v, "رحت إلى", "رحتِ إلى", "مشوارٌ إلى")} ${where}${city}${along(pick(v, "، وكان ", "، وكان ", "، و"))}.`;
    }
    case "PHOTO": {
      const where = moment.placeName ? ` في ${moment.placeName}` : "";
      return `${pick(v, "التقطت هذه الصورة", "التقطتِ هذه الصورة", "صورةٌ")}${where}${withThem ? ` مع ${withThem}` : ""}.`;
    }
    case "THOUGHT":
      return `${pick(v, "كتبت ما في خاطرك", "كتبتِ ما في خاطركِ", "خاطرةٌ من القلب")}${along(pick(v, "، وكان ", "، وكان ", "، و"))}.`;
    case "CITY":
      return `${pick(v, "وصلت إلى", "وصلتِ إلى", "الوصولُ إلى")} ${moment.text ?? moment.placeCity ?? "مدينةٍ جديدة"}.`;
    case "SLEEP":
      return `${pick(v, "نمت", "نمتِ", "النومُ")} الساعة ${clock(moment.createdAt)}.`;
    case "WAKE":
      return `${pick(v, "صحيت", "صحيتِ", "الصحوُ")} الساعة ${clock(moment.createdAt)}.`;
    default:
      return "";
  }
}

/** ما جرى حولها: من تفاعل وبماذا، وكم كُتب له فيها. */
export function echoText(echo: Echo, gender?: Gender): string {
  const v = voiceOf(gender);
  const circle = pick(v, "دائرتك", "دائرتكِ", "الدائرة");
  const got = pick(v, "وأكثرُ ما وصلك", "وأكثرُ ما وصلكِ", "وأكثرُ ما وصلها");
  const wrote = pick(v, "وكُتب لك فيها", "وكُتب لكِ فيها", "وكُتب فيها");
  const parts: string[] = [];
  if (echo.reactions === 1 && echo.top) {
    const who = echo.reactors[0];
    parts.push(
      who
        ? `وتفاعلت ${circle} معها: ${who} ${reactionWord(echo.top, false)}.`
        : `ووصلها تفاعلٌ ${reactionWord(echo.top, false)}.`,
    );
  } else if (echo.reactions > 1 && echo.top) {
    const most = reactionWord(echo.top, true);
    if (echo.reactors.length && echo.reactors.length >= echo.reactions) {
      parts.push(`وتفاعلت ${circle} معها: ${listNames(echo.reactors)}، ${got} ${most}.`);
    } else {
      const some = echo.reactors.length ? `، منهم ${listNames(echo.reactors)}` : "";
      parts.push(`وتفاعل معها ${ar(echo.reactions)} من ${circle}${some}، ${got} ${most}.`);
    }
  }
  const said = times(echo.comments, "تعليقٌ", "تعليقان", "تعليقات", "تعليقاً");
  if (echo.comments === 1 && echo.quote) parts.push(`${wrote}:`);
  else if (echo.comments > 1 && echo.quote) parts.push(`${wrote} ${said}، ${echo.comments === 2 ? "أحدهما" : "منها"}:`);
  else if (echo.comments > 1) parts.push(`${wrote} ${said}.`);
  return parts.join(" ");
}

/** جملةُ الراوي كاملةً — والاقتباسُ يُرسم بعدها وحده. */
export function storyOf(moment: StoryMoment, echo: Echo | null, gender?: Gender): string {
  return [leadOf(moment, gender), echo ? echoText(echo, gender) : ""].filter(Boolean).join(" ");
}

/** التعليقُ المقتبس: أطولُ ما كُتب له، مقصوصاً عند ١٦٠. */
export function pickQuote(comments: { name: string; body: string }[]): { name: string; text: string } | null {
  const best = [...comments].sort((a, b) => b.body.trim().length - a.body.trim().length)[0];
  if (!best || !best.body.trim()) return null;
  const text = best.body.trim();
  return {
    name: best.name,
    text: text.length > 160 ? `${text.slice(0, 159)}…` : text,
  };
}

type RawReaction = {
  userId: string;
  kind: string;
  emoji: string | null;
  createdAt: Date;
  name: string;
};
type RawComment = { userId: string; body: string; name: string };

/**
 * يجمع صدى لحظةٍ واحدة من صفوفها الخام: المحجوبُ خارجٌ من كلّ شيء، والأسماءُ
 * من الدائرة وحدها — صديقٌ أُزيل يُعدّ ولا يُسمّى.
 */
export function echoOf(
  reactions: RawReaction[],
  comments: RawComment[],
  circle: Set<string>,
  blocked: Set<string>,
): Echo | null {
  const shown = reactions.filter((reaction) => !blocked.has(reaction.userId));
  const said = comments.filter((comment) => !blocked.has(comment.userId));
  if (!shown.length && !said.length) return null;

  const tally = new Map<string, { kind: string; emoji: string | null; count: number }>();
  for (const reaction of shown) {
    const key = reaction.kind === "CUSTOM" ? `CUSTOM:${reaction.emoji ?? ""}` : reaction.kind;
    const row = tally.get(key) ?? {
      kind: reaction.kind,
      emoji: reaction.emoji,
      count: 0,
    };
    row.count += 1;
    tally.set(key, row);
  }
  const top = [...tally.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  const reactors = [...shown]
    .filter((reaction) => circle.has(reaction.userId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((reaction) => reaction.name);

  return {
    reactions: shown.length,
    top,
    reactors,
    comments: said.length,
    // الملصقُ لا يُقتبس: نصُّه «ملصق» لا كلامٌ قيل (القاعدة ٢٩١).
    quote: pickQuote(said.filter((comment) => circle.has(comment.userId) && comment.body !== "ملصق")),
  };
}

/**
 * ما يُقال في مقدّمة الكتاب عن الدائرة: كم وصلك، وأكثرُه، ومن كان أقربَ تفاعلاً،
 * ومن رافقك أكثر، وأيُّ لحظةٍ حرّكت دائرتك.
 */
export type CircleYear = {
  reactions: number;
  comments: number;
  topReaction: { kind: string; emoji: string | null; count: number } | null;
  closest: { name: string; count: number } | null;
  companion: { name: string; count: number } | null;
  loudest: { day: string; line: string; score: number } | null;
};

export function circleYear(
  rows: {
    id: string;
    day: string;
    line: string;
    with?: string[];
    echo: Echo | null;
  }[],
  raw: Map<string, { reactions: RawReaction[]; comments: RawComment[] }>,
  circle: Set<string>,
  blocked: Set<string>,
): CircleYear {
  let reactions = 0;
  let comments = 0;
  const kinds = new Map<string, { kind: string; emoji: string | null; count: number }>();
  const people = new Map<string, { name: string; count: number }>();
  const bump = (id: string, name: string) => {
    if (!circle.has(id) || blocked.has(id)) return;
    const row = people.get(id) ?? { name, count: 0 };
    row.count += 1;
    people.set(id, row);
  };
  for (const [, entry] of raw) {
    for (const reaction of entry.reactions) {
      if (blocked.has(reaction.userId)) continue;
      reactions += 1;
      const key = reaction.kind === "CUSTOM" ? `CUSTOM:${reaction.emoji ?? ""}` : reaction.kind;
      const row = kinds.get(key) ?? {
        kind: reaction.kind,
        emoji: reaction.emoji,
        count: 0,
      };
      row.count += 1;
      kinds.set(key, row);
      bump(reaction.userId, reaction.name);
    }
    for (const comment of entry.comments) {
      if (blocked.has(comment.userId)) continue;
      comments += 1;
      bump(comment.userId, comment.name);
    }
  }

  const companions = new Map<string, number>();
  for (const row of rows) for (const name of row.with ?? []) companions.set(name, (companions.get(name) ?? 0) + 1);
  const companion = [...companions.entries()].sort((a, b) => b[1] - a[1])[0];

  const loudest = rows
    .map((row) => ({
      day: row.day,
      line: row.line,
      score: (row.echo?.reactions ?? 0) + (row.echo?.comments ?? 0),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return {
    reactions,
    comments,
    topReaction: [...kinds.values()].sort((a, b) => b.count - a.count)[0] ?? null,
    closest: [...people.values()].sort((a, b) => b.count - a.count)[0] ?? null,
    companion: companion ? { name: companion[0], count: companion[1] } : null,
    loudest: loudest ?? null,
  };
}

/** أسطرُ مقدّمة الكتاب عن الدائرة — نصٌّ جاهز تقرؤه الأوجهُ الثلاثة. */
export function circleLines(year: CircleYear, gender?: Gender): string[] {
  const v = voiceOf(gender);
  const yours = pick(v, "دائرتك", "دائرتكِ", "الدائرة");
  const got = pick(v, "وصلك", "وصلكِ", "وصل");
  const lines: string[] = [];
  if (year.reactions || year.comments) {
    const tally = [
      year.reactions ? times(year.reactions, "تفاعلٌ واحد", "تفاعلان", "تفاعلات", "تفاعلاً") : null,
      year.comments ? times(year.comments, "تعليقٌ واحد", "تعليقان", "تعليقات", "تعليقاً") : null,
    ].filter(Boolean);
    lines.push(`${got} من ${yours} هذه السنة ${tally.join(" و")}.`);
  }
  if (year.topReaction) lines.push(`وأكثرُ ما ${got} ${reactionWord(year.topReaction, true)}.`);
  if (year.closest) {
    const count = times(year.closest.count, "مرّةً واحدة", "مرّتين", "مرّات", "مرّة");
    lines.push(`${pick(v, "أقربُ دائرتك تفاعلاً معك", "أقربُ دائرتكِ تفاعلاً معكِ", "الأقربُ تفاعلاً")}: ${year.closest.name} — ${count}.`);
  }
  if (year.companion) {
    const count = times(year.companion.count, "لحظةٍ واحدة", "لحظتين", "لحظات", "لحظة");
    lines.push(
      `${pick(v, "رفيقُ لحظاتك", "رفيقُ لحظاتكِ", "رفيقُ اللحظات")}: ${year.companion.name} — ${pick(v, "كان معك", "كان معكِ", "حاضرٌ")} في ${count}.`,
    );
  }
  if (year.loudest) lines.push(`وأكثرُ لحظةٍ حرّكت ${yours}: «${year.loudest.line}».`);
  return lines;
}
