/** «أرشيفي» و«سنتك في كتاب» (القاعدة ٢٤٤) — ما يردّه `/v1/archive`. */
export type ArchiveMoment = {
  id: string;
  kind: string;
  text: string | null;
  placeName: string | null;
  placeCity: string | null;
  musicTitle: string | null;
  musicArtist: string | null;
  musicThumb: string | null;
  mediaId: string | null;
  photoX: number | null;
  photoY: number | null;
  createdAt: string;
};

export type ArchivePage = {
  moments: ArchiveMoment[];
  nextCursor?: string;
  limited: boolean;
  hidden: number;
};

/** لمن كانت اللحظة الخاصّة — يُكتب في الكتاب (القاعدة ٢٥٦). */
export type BookPrivate = { audience: "GROUP" | "PICKED" | "EXCEPT"; group: string | null; people: string[] };
/** صدى اللحظة في دائرتها (القاعدة ٢٥٩): أكثرُ تفاعلٍ وصلها وتعليقٌ يُقتبس. */
export type BookEcho = {
  reactions: number;
  top: { kind: string; emoji: string | null; count: number } | null;
  reactors: string[];
  comments: number;
  quote: { name: string; text: string } | null;
};
export type BookMoment = ArchiveMoment & {
  with?: string[];
  private?: BookPrivate | null;
  /** جملةُ الراوي — خادمٌ قديمٌ بلاها يُرسم بسطره كما كان. */
  story?: string;
  echoText?: string | null;
  echo?: BookEcho | null;
};

export type Book = {
  year: number;
  name: string;
  memberNo: number;
  avatarMediaId: string | null;
  partial: boolean;
  stats: {
    moments: number;
    photos: number;
    places: number;
    songs: number;
    thoughts: number;
    cities: string[];
    topPlace: { name: string; visits: number } | null;
    topSong: string | null;
    /** ما وصله من دائرته في السنة، أسطراً جاهزة (القاعدة ٢٥٩). */
    circleLines?: string[];
  };
  moments: BookMoment[];
  /** صفحةٌ لكلّ يوم بتوقيت الرياض — خادمٌ قديم بلاها يُجمَّع منه هنا. */
  days?: { day: string; moments: BookMoment[] }[];
};

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : `${list.slice(0, -1).join("، ")} و${list.at(-1)}`;

/** «لحظة خاصة — شاركتها مع نورة وخالد» بلسان صاحبها. */
export function privateNote(moment: BookMoment): string | null {
  const p = moment.private;
  if (!p) return null;
  if (p.audience === "PICKED") return p.people.length ? `لحظة خاصة — شاركتها مع ${names(p.people)}` : "لحظة خاصة";
  if (p.audience === "GROUP") return p.group ? `لحظة خاصة — لتصنيف ${p.group}` : "لحظة خاصة";
  return p.group ? `لحظة خاصة — للكل ما عدا ${p.group}` : "لحظة خاصة";
}

export const withNames = (moment: BookMoment) => (moment.with?.length ? `مع ${names(moment.with)}` : null);

/** سطرُ اللحظة في البلاطة والكتاب: ما يُقرأ منها بلا صورة. */
export function momentLine(moment: ArchiveMoment): string {
  switch (moment.kind) {
    case "PLACE":
      return moment.placeName ?? "مكان";
    case "MUSIC":
      return moment.musicTitle ? `${moment.musicTitle}${moment.musicArtist ? ` — ${moment.musicArtist}` : ""}` : "أغنية";
    case "CITY":
      return `وصلت إلى ${moment.text ?? moment.placeCity ?? ""}`.trim();
    case "SLEEP":
      return "نمت";
    case "WAKE":
      return "صحيت";
    default:
      return moment.text ?? "";
  }
}
