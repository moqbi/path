import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { archive, FREE_ARCHIVE_DAYS } from "@/lib/archive";
import { canTryStickers } from "@/lib/stickers";
import { ScreenHeader } from "@/components/ui";
import { GalleryHall, type HallPiece } from "@/components/gallery-hall";
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
  };
}

type Row = Awaited<ReturnType<typeof archive>>["moments"][number];

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
  const page = await archive(user.id, { limit: 3000 });
  const pieces: HallPiece[] = page.moments
    .filter((moment) => riyadh(moment.createdAt).year === year)
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
        month: at.month,
        when: at.when,
      };
    });
  // الحبلُ في أوّل القاعة التي يقع فيها الحدّ.
  const edge = riyadh(new Date(Date.now() - FREE_ARCHIVE_DAYS * 86_400_000)).year;
  const hidden = page.limited && edge === year ? page.hidden : 0;

  return (
    <div className="screen">
      <ScreenHeader title={`قاعة ${ar(year)}`} back="/archive" mark />
      <GalleryHall pieces={pieces} hidden={hidden} />
    </div>
  );
}
