import { prisma } from "@athar/db";
import { cloudReady, getObject } from "@athar/storage";
import sharp from "sharp";
import { book } from "./archive";
import { SITE_URL } from "@athar/shared";
import { ar } from "../lib/riyadh-day";

/**
 * «سنتك في كتاب» ملفّاً يُحفظ (القاعدة ٢٥٦) — **بقرار المالك**.
 *
 * الخادمُ يكتب الكتاب صفحةً HTML كاملة، والجوّالُ يطبعها PDF بمحرّك النظام
 * (`expo-print`): WebKit يرسم العربيّة بوصلها واتجاهها، ومكتباتُ PDF في Node
 * تكتبها حروفاً مقطّعة. والصورُ **مضمّنةٌ في الصفحة** مصغّرةً: الطابعةُ لا
 * تحمل جلسةً تفتح بها `/v1/media`، ورابطٌ مفتوح يكسر القاعدة ٢٣ب.
 * والكتابُ لصاحبه وحده، وحدُّه حدُّ الأرشيف: سنةٌ لآثار+ وستّة أشهر لغيره.
 */

type Book = Awaited<ReturnType<typeof book>>;
type Moment = Book["moments"][number];

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
// صورٌ كثيرةٌ مضمّنة تُثقل الملفّ حتى لا يُفتح — ما بعدها يُكتب سطراً.
const MAX_PHOTOS = 400;

// الشعارُ صورتُه على الموقع (القاعدة ١١٩)، وبلا نطاقٍ مضبوط قرصٌ بتدرّج العلامة.
const MARK = SITE_URL
  ? `<img class="logo" src="${SITE_URL}/athr-mark.png" alt="">`
  : `<div class="mark"></div>`;

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** «فلان وفلان»، «فلان وفلان وفلان» — بالواو العربيّة لا بالفاصلة وحدها. */
const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : `${list.slice(0, -1).join("، ")} و${list.at(-1)}`;

function line(moment: Moment): string {
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

/** لمن كانت اللحظة الخاصّة — بلسان صاحبها. */
export function privateNote(moment: Moment): string | null {
  const p = moment.private;
  if (!p) return null;
  if (p.audience === "PICKED")
    return p.people.length ? `لحظة خاصة — شاركتها مع ${names(p.people)}` : "لحظة خاصة";
  if (p.audience === "GROUP") return p.group ? `لحظة خاصة — لتصنيف ${p.group}` : "لحظة خاصة";
  if (p.audience === "EXCEPT") return p.group ? `لحظة خاصة — للكل ما عدا ${p.group}` : "لحظة خاصة";
  return "لحظة خاصة";
}

function clock(at: Date): string {
  const shifted = new Date(at.getTime() + 3 * 3_600_000);
  let h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  const half = h < 12 ? "ص" : "م";
  h = h % 12 || 12;
  return `${ar(h)}:${ar(String(m).padStart(2, "0"))} ${half}`;
}

function dayTitle(key: string): { title: string; weekday: string } {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { title: `${ar(d)} ${MONTHS[m - 1]}`, weekday };
}

/** بايتاتُ الملفّ مصغّرةً JPEG — من R2 أو من القاعدة، والفشلُ يُسقط الصورة لا الكتاب. */
async function thumb(mediaId: string, width: number): Promise<string | null> {
  try {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: { key: true, bytes: true, ready: true },
    });
    if (!media?.ready) return null;
    let bytes: Uint8Array | null = null;
    if (media.key) {
      if (!cloudReady()) return null;
      const answer = await getObject(media.key);
      if (!answer.ok) return null;
      bytes = new Uint8Array(await answer.arrayBuffer());
    } else if (media.bytes) {
      bytes = new Uint8Array(media.bytes);
    }
    if (!bytes) return null;
    const out = await sharp(bytes, { animated: false })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 72 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

/** صورٌ كثيرة بالتوازي بلا أن تُغرق الخادم: ثمانٍ معاً. */
async function thumbs(ids: string[], width: number): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let index = 0; index < ids.length; index += 8) {
    const slice = ids.slice(index, index + 8);
    const done = await Promise.all(slice.map((id) => thumb(id, width)));
    slice.forEach((id, i) => {
      if (done[i]) out.set(id, done[i]!);
    });
  }
  return out;
}

const CSS = `
@page { size: A5; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { direction: rtl; background: #fff; color: #182830;
  font-family: "IBM Plex Sans Arabic", "SF Arabic", "Geeza Pro", system-ui, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 148mm; min-height: 210mm; padding: 14mm 12mm; page-break-after: always; break-after: page; position: relative; }
.page:last-child { page-break-after: auto; break-after: auto; }
.night { background: #0E1A24; color: #f7f5ef; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.cover .year { font-size: 64px; font-weight: 800; margin-top: 18px; }
.cover .avatar { width: 78px; height: 78px; border-radius: 50%; object-fit: cover; margin-top: 26px; border: 3px solid #F6B93B; }
.cover .name { font-size: 22px; font-weight: 800; margin-top: 12px; }
.cover .member { font-size: 12px; opacity: .6; margin-top: 4px; }
.cover .motto { color: #F6B93B; font-weight: 700; margin-top: 34px; font-size: 15px; }
h2 { font-size: 22px; font-weight: 800; margin-bottom: 14px; }
.stats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.stat { flex: 1 1 40%; background: #F4F0E6; border-radius: 14px; padding: 12px; }
.stat b { display: block; font-size: 26px; }
.stat span { font-size: 12px; color: #6b7880; }
.facts p { font-size: 14px; line-height: 1.8; }
.note { font-size: 11.5px; color: #6b7880; margin-top: 12px; }
.month { background: #FCEFD2; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.month .y { color: #9a6a12; font-weight: 700; }
.month .m { font-size: 46px; font-weight: 800; }
.day-head { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 2px solid #F6B93B; padding-bottom: 8px; margin-bottom: 14px; }
.day-head .t { font-size: 24px; font-weight: 800; }
.day-head .w { font-size: 13px; color: #6b7880; }
.moment { display: flex; gap: 10px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
.num { flex: 0 0 26px; height: 26px; border-radius: 13px; background: #0E1A24; color: #F6B93B; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.body { flex: 1; min-width: 0; }
.meta { font-size: 11.5px; color: #6b7880; margin-bottom: 4px; }
.text { font-size: 15px; line-height: 1.75; white-space: pre-wrap; word-wrap: break-word; }
.text.big { font-size: 17px; font-weight: 700; }
.photo { width: 100%; max-height: 95mm; object-fit: cover; border-radius: 12px; margin: 4px 0 6px; display: block; }
.with { font-size: 12.5px; color: #3c4a52; margin-top: 3px; }
.private { display: inline-block; font-size: 11.5px; color: #9a6a12; background: #FCEFD2; border-radius: 8px; padding: 3px 8px; margin-top: 6px; }
.end .big { font-size: 20px; font-weight: 800; margin-top: 16px; }
.logo { width: 96px; height: auto; }
.mark { width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #F6B93B, #FF7A5A); }
`;

/** الكتابُ صفحةَ HTML واحدة، والجوّالُ يطبعها. */
export async function bookHtml(userId: string, year: number): Promise<{ html: string; name: string }> {
  const data = await book(userId, year);
  const s = data.stats;
  const photoIds = data.moments.filter((m) => m.mediaId).map((m) => m.mediaId!).slice(0, MAX_PHOTOS);
  const [photos, avatar] = await Promise.all([
    thumbs(photoIds, 900),
    data.avatarMediaId ? thumb(data.avatarMediaId, 240) : Promise.resolve(null),
  ]);

  const pages: string[] = [];
  pages.push(`
    <section class="page night cover">
      ${MARK}
      <div class="year">${ar(year)}</div>
      ${avatar ? `<img class="avatar" src="${avatar}">` : ""}
      <div class="name">${esc(data.name)}</div>
      <div class="member">عضوية رقم ${ar(data.memberNo)}</div>
      <div class="motto">لحظاتك، مع ناسك.</div>
    </section>`);

  const tiles = [
    [s.moments, "لحظة"],
    [s.photos, "صورة"],
    [s.places, "مكان"],
    [s.songs, "أغنية"],
  ].filter(([n]) => Number(n) > 0);
  pages.push(`
    <section class="page">
      <h2>سنتك بالأرقام</h2>
      <div class="stats">${tiles.map(([n, label]) => `<div class="stat"><b>${ar(n)}</b><span>${label}</span></div>`).join("")}</div>
      <div class="facts">
        <p>${ar(data.days.length)} يوماً كتبت فيها لحظة</p>
        ${s.cities.length ? `<p>مدنك: ${esc(s.cities.join("، "))}</p>` : ""}
        ${s.topPlace ? `<p>أكثر مكان رجعت له: ${esc(s.topPlace.name)}${s.topPlace.visits > 1 ? ` — ${ar(s.topPlace.visits)} مرّات` : ""}</p>` : ""}
        ${s.topSong ? `<p>أغنيتك: ${esc(s.topSong)}</p>` : ""}
      </div>
      ${data.partial ? `<p class="note">الكتاب من آخر ستة أشهر — السنة كاملة مع آثار+.</p>` : ""}
    </section>`);

  let month = -1;
  for (const day of data.days) {
    const m = Number(day.day.slice(5, 7)) - 1;
    if (m !== month) {
      month = m;
      const count = data.days
        .filter((d) => Number(d.day.slice(5, 7)) - 1 === m)
        .reduce((sum, d) => sum + d.moments.length, 0);
      pages.push(`
        <section class="page month">
          <div class="y">${ar(year)}</div>
          <div class="m">${MONTHS[m]}</div>
          <div class="note">${ar(count)} لحظة</div>
        </section>`);
    }
    const { title, weekday } = dayTitle(day.day);
    const items = day.moments
      .map((moment, index) => {
        const photo = moment.mediaId ? photos.get(moment.mediaId) : undefined;
        const text = line(moment);
        const where = moment.placeName && moment.kind !== "PLACE" ? ` · ${esc(moment.placeName)}` : "";
        const note = privateNote(moment);
        return `
          <div class="moment">
            <div class="num">${ar(index + 1)}</div>
            <div class="body">
              <div class="meta">${clock(moment.createdAt)}${where}</div>
              ${photo ? `<img class="photo" src="${photo}" style="object-position:${moment.photoX ?? 50}% ${moment.photoY ?? 50}%">` : ""}
              ${text ? `<div class="text${photo ? "" : " big"}">${esc(text)}</div>` : ""}
              ${moment.with.length ? `<div class="with">مع ${esc(names(moment.with))}</div>` : ""}
              ${note ? `<div class="private">${esc(note)}</div>` : ""}
            </div>
          </div>`;
      })
      .join("");
    pages.push(`
      <section class="page">
        <div class="day-head"><span class="t">${title}</span><span class="w">${weekday} · ${ar(day.moments.length)} لحظة</span></div>
        ${items}
      </section>`);
  }

  pages.push(`
    <section class="page night end">
      ${MARK}
      <div class="big">${ar(s.moments)} لحظة تركت أثرها في ${ar(year)}</div>
      <div class="note" style="color:rgba(247,245,239,.6)">والصفحة الجاية تكتبها أنت.</div>
    </section>`);

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>${pages.join("")}</body></html>`;
  return { html, name: `athar-${year}` };
}
