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
  };
  moments: ArchiveMoment[];
};

/** سطرُ اللحظة في البلاطة والكتاب: ما يُقرأ منها بلا صورة. */
export function momentLine(moment: ArchiveMoment): string {
  switch (moment.kind) {
    case "PLACE":
      return moment.placeName ?? "مكان";
    case "MUSIC":
      return moment.musicTitle ? `${moment.musicTitle}${moment.musicArtist ? ` — ${moment.musicArtist}` : ""}` : "أغنية";
    case "CITY":
      return `وصل إلى ${moment.text ?? moment.placeCity ?? ""}`.trim();
    case "SLEEP":
      return "نام";
    case "WAKE":
      return "صحى";
    default:
      return moment.text ?? "";
  }
}
