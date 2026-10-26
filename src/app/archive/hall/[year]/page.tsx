import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { FREE_ARCHIVE_DAYS } from "@/lib/archive";
import { apiAs } from "@/lib/api-bridge";
import { canTryStickers } from "@/lib/stickers";
import { GalleryHall, type HallImages, type HallPiece } from "@/components/gallery-hall";
import { ar, MONTHS } from "@/lib/format";

/** التاريخُ بتوقيت الرياض (+٣) — كالكتاب (القاعدة ٢٣٥)، ويُكتب هنا لا في المتصفّح. */
function riyadh(date: Date) {
  const shifted = new Date(date.getTime() + 3 * 3_600_000);
  const hours = shifted.getUTCHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    when: `${ar(shifted.getUTCDate())} ${MONTHS[shifted.getUTCMonth()]} · ${ar(hour12)}:${ar(String(shifted.getUTCMinutes()).padStart(2, "0"))} ${hours < 12 ? "ص" : "م"}`,
    time: `${ar(hour12)}:${ar(String(shifted.getUTCMinutes()).padStart(2, "0"))} ${hours < 12 ? "ص" : "م"}`,
    date: `${ar(shifted.getUTCDate())} ${MONTHS[shifted.getUTCMonth()]} ${ar(shifted.getUTCFullYear())}`,
  };
}

/** صفحةُ `/v1/archive` كما يردّها الخادم (القاعدة ٣٤٩) — الصدى والصورُ المكدّسة وثوبُ القاعة منه. */
type Row = {
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
  createdAt: Date;
  morePhotos?: string[];
  morePhotoPos?: { x: number; y: number }[];
  echo?: HallPiece["echo"];
};
type Page = { moments: (Omit<Row, "createdAt"> & { createdAt: string })[]; nextCursor?: string; limited: boolean; hidden: number; hallSkin?: string | null; hallImages?: HallImages | null };

/** لحظاتُ السنة صفحةً صفحةً من الخادم نفسه — كالجوّال، فلا تختلف لوحةٌ بين الوجهين. */
async function loadYear(userId: string, year: number) {
  const rows: Row[] = [];
  let cursor: string | undefined;
  let first: Page | null = null;
  for (let round = 0; round < 40; round++) {
    const page = await apiAs<Page>(userId, `/v1/archive?limit=90${cursor ? `&cursor=${cursor}` : ""}`);
    first ??= page;
    let older = false;
    for (const moment of page.moments) {
      const row = { ...moment, createdAt: new Date(moment.createdAt) };
      const at = riyadh(row.createdAt).year;
      if (at === year) rows.push(row);
      else if (at < year) older = true;
    }
    cursor = page.nextCursor;
    if (!cursor || older) break;
  }
  return { rows, limited: first?.limited ?? false, hidden: first?.hidden ?? 0, skin: first?.hallSkin ?? null, images: first?.hallImages ?? null };
}

function line(moment: Row): string {
  switch (moment.kind) {
    case "PLACE":
      return moment.placeName ?? "مكان";
    case "MUSIC":
      return moment.musicTitle ? `${moment.musicTitle}${moment.musicArtist ? ` — ${moment.musicArtist}` : ""}` : "أغنية";
    case "CITY":
      return `وصلت إلى ${moment.text ?? moment.placeCity ?? ""}`.trim();
    case "SLEEP":
    case "WAKE": {
      const at = riyadh(moment.createdAt).when.split(" · ")[1];
      return `${moment.kind === "SLEEP" ? "نمت" : "صحيت"} ${at}`;
    }
    default:
      return moment.text ?? "";
  }
}

/** قاعةُ السنة (القاعدة ٣٤٦) — للمالك وممنوحي اللوحة كلّها مقابلَ نسخة التطوير. */
export default async function HallPage({ params }: { params: Promise<{ year: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!canTryStickers(user)) redirect("/archive");
  const year = Number((await params).year);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) notFound();

  // الأرشيفُ نفسُه بحدّه (القاعدة ٢٤٤)، ثمّ لحظاتُ السنة بتوقيت الرياض من أقدمها.
  const page = await loadYear(user.id, year);
  const pieces: HallPiece[] = page.rows
    .reverse()
    .map((moment) => {
      const at = riyadh(moment.createdAt);
      return {
        id: moment.id,
        kind: moment.kind,
        line: line(moment),
        text: moment.text,
        mediaId: moment.mediaId,
        photoX: moment.photoX,
        photoY: moment.photoY,
        placeName: moment.placeName,
        placeCity: moment.placeCity,
        musicThumb: moment.musicThumb,
        morePhotos: moment.morePhotos ?? [],
        morePhotoPos: moment.morePhotoPos ?? [],
        echo: moment.echo ?? null,
        month: at.month,
        when: at.when,
        time: at.time,
        date: at.date,
      };
    });
  // الحبلُ في أوّل القاعة التي يقع فيها الحدّ.
  const edge = riyadh(new Date(Date.now() - FREE_ARCHIVE_DAYS * 86_400_000)).year;
  const hidden = page.limited && edge === year ? page.hidden : 0;

  return (
    <div className="screen">
      <GalleryHall pieces={pieces} hidden={hidden} skin={page.skin} images={page.images} />
    </div>
  );
}
