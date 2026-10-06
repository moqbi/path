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

/** رسمُ التفاعل من الموقع كالشعار — وبلا نطاقٍ تُكتب الجملةُ وحدها. */
const GLYPH: Record<string, string> = {
  SMILE: "smile", LAUGH: "laugh", GASP: "gasp", SAD: "sad", LOVE: "love",
  CAMERA: "camera", CHAT: "chat", PIN: "pin", SLEEPY: "sleepy",
};
function glyph(top: { kind: string; emoji: string | null } | null | undefined): string {
  if (!top) return "";
  if (top.kind === "CUSTOM") return top.emoji ? `<span class="glyph emoji">${esc(top.emoji)}</span>` : "";
  const file = GLYPH[top.kind];
  return file && SITE_URL ? `<img class="glyph" src="${SITE_URL}/app/reactions/${file}.png" alt="">` : "";
}

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** «فلان وفلان»، «فلان وفلان وفلان» — بالواو العربيّة لا بالفاصلة وحدها. */
const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : `${list.slice(0, -1).join("، ")} و${list.at(-1)}`;

/** لمن كانت اللحظة الخاصّة — بلسان صاحبها. */
export function privateNote(moment: Moment): string | null {
  const p = moment.private;
  if (!p) return null;
  if (p.audience === "PICKED")
    return p.people.length ? `لحظة خاصة — شاركتها مع ${names(p.people)}` : "لحظة خاصة";
  if (p.audience === "GROUP") return p.group ? `لحظة خاصة — لتصنيف ${p.group}` : "لحظة خاصة";
  if (p.audience === "EXCEPT") return p.group ? `للكل ما عدا ${p.group}` : null;
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
html, body { direction: rtl; background: #FBF8F1; color: #182830;
  font-family: "IBM Plex Sans Arabic", "SF Arabic", "Geeza Pro", system-ui, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { counter-reset: folio; }
h1, h2, .display { font-family: "Tajawal", "IBM Plex Sans Arabic", sans-serif; }
.page { width: 148mm; min-height: 210mm; padding: 16mm 14mm 18mm; page-break-after: always; break-after: page;
  position: relative; background: #FBF8F1; }
.page:last-child { page-break-after: auto; break-after: auto; }
.folio { counter-increment: folio; }
.folio::after { content: counter(folio, arabic-indic); position: absolute; bottom: 9mm; left: 14mm;
  font-size: 9px; color: #9aa4a8; letter-spacing: .5px; }
.folio::before { content: attr(data-run); position: absolute; bottom: 9mm; right: 14mm;
  font-size: 9px; color: #9aa4a8; }
.rule { height: 1px; background: #E4DCC8; }
.gold { height: 2px; width: 36px; background: #F6B93B; border-radius: 2px; }

/* الغلاف */
.night { background: radial-gradient(120% 80% at 50% 30%, #1d3a46 0%, #0E1A24 60%, #08121a 100%); color: #f7f5ef; }
.cover { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 26mm; }
.cover .eyebrow { margin-top: 14mm; font-size: 11px; letter-spacing: 4px; color: rgba(247,245,239,.55); }
.cover .year { font-size: 92px; font-weight: 800; line-height: 1; margin-top: 4mm; }
.cover .gold { margin: 8mm auto 0; }
.cover .who { position: absolute; bottom: 30mm; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; }
.cover .avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #F6B93B; padding: 2px; background: #0E1A24; }
.cover .name { font-size: 19px; font-weight: 800; margin-top: 10px; }
.cover .member { font-size: 10.5px; color: rgba(247,245,239,.5); margin-top: 3px; }
.cover .motto { position: absolute; bottom: 14mm; left: 0; right: 0; color: #F6B93B; font-size: 12px; letter-spacing: 1px; }
.logo { width: 84px; height: auto; }
.mark { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #F6B93B, #FF7A5A); }

/* سنتك بالأرقام */
.kicker { font-size: 10.5px; letter-spacing: 3px; color: #b07d1c; }
h2 { font-size: 26px; font-weight: 800; margin-top: 3mm; }
.numbers { display: grid; grid-template-columns: 1fr 1fr; margin-top: 10mm; border-top: 1px solid #E4DCC8; }
.numbers div { padding: 6mm 0 5mm; border-bottom: 1px solid #E4DCC8; }
.numbers div:nth-child(odd) { border-left: 1px solid #E4DCC8; padding-left: 5mm; }
.numbers div:nth-child(even) { padding-right: 5mm; }
.numbers b { display: block; font-family: "Tajawal", sans-serif; font-size: 40px; font-weight: 800; line-height: 1.05; }
.numbers span { font-size: 11px; color: #6b7880; }
.facts { margin-top: 8mm; }
.fact { display: flex; gap: 4mm; padding: 3.2mm 0; border-bottom: 1px solid #EFE8D8; font-size: 13px; line-height: 1.6; }
.fact .k { flex: 0 0 26mm; color: #8a7a55; font-size: 11px; padding-top: 1px; }
.note { font-size: 10.5px; color: #8a949a; margin-top: 6mm; line-height: 1.7; }

/* فاصلُ الشهر */
.month { display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 30mm; }
.month .ghost { position: absolute; top: 10mm; left: 8mm; font-family: "Tajawal", sans-serif; font-size: 200px; font-weight: 800; color: #F1E8D2; line-height: 1; }
.month .y { font-size: 11px; letter-spacing: 3px; color: #b07d1c; }
.month .m { font-family: "Tajawal", sans-serif; font-size: 54px; font-weight: 800; line-height: 1.1; margin-top: 2mm; position: relative; }
.month .gold { margin-top: 5mm; }
.month .c { font-size: 12px; color: #6b7880; margin-top: 4mm; }

/* صفحةُ اليوم */
.day-head { display: flex; align-items: flex-end; gap: 4mm; padding-bottom: 4mm; border-bottom: 1px solid #E4DCC8; margin-bottom: 6mm; }
.day-head .d { font-family: "Tajawal", sans-serif; font-size: 52px; font-weight: 800; line-height: .9; }
.day-head .mw { flex: 1; padding-bottom: 1mm; }
.day-head .mo { font-family: "Tajawal", sans-serif; font-size: 17px; font-weight: 800; }
.day-head .wd { font-size: 11px; color: #6b7880; margin-top: 1px; }
.day-head .count { font-size: 10.5px; color: #8a7a55; border: 1px solid #E4DCC8; border-radius: 20px; padding: 2px 9px; margin-bottom: 1mm; }
.timeline { position: relative; }
.moment { position: relative; display: flex; gap: 4mm; padding-bottom: 6mm; break-inside: avoid; page-break-inside: avoid; }
.moment::before { content: ""; position: absolute; right: 10px; top: 24px; bottom: 0; width: 1px; background: #E4DCC8; }
.moment:last-child::before { display: none; }
.num { flex: 0 0 21px; height: 21px; border-radius: 50%; background: #0E1A24; color: #F6B93B;
  font-size: 10.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
.body { flex: 1; min-width: 0; }
.meta { font-size: 10.5px; color: #8a949a; margin-bottom: 2mm; letter-spacing: .2px; }
.text { font-size: 13.5px; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word; }
.text.big { font-family: "Tajawal", sans-serif; font-size: 18px; font-weight: 700; line-height: 1.55; }
.photo { width: 100%; aspect-ratio: 5 / 4; max-height: 88mm; object-fit: cover; border-radius: 10px; margin-bottom: 2.5mm; display: block;
  box-shadow: 0 1px 0 #E4DCC8, 0 6px 16px rgba(14,26,36,.08); }
.with { font-size: 11.5px; color: #3c4a52; margin-top: 1.5mm; }
.with b { font-weight: 700; }
.story { font-size: 12.5px; line-height: 1.85; color: #6a5420; margin-bottom: 2.5mm; }
.echo { display: flex; align-items: flex-start; gap: 2.5mm; margin-top: 3mm; font-size: 11.5px; line-height: 1.75; color: #3c4a52; }
.glyph { width: 20px; height: 20px; flex: 0 0 20px; margin-top: 1px; }
.glyph.emoji { font-size: 16px; line-height: 20px; text-align: center; }
.quote { margin-top: 2mm; padding: 2.5mm 4mm; border-right: 2px solid #F6B93B; background: #F6EFDD; border-radius: 8px 0 0 8px;
  font-size: 12.5px; line-height: 1.8; color: #182830; }
.quote cite { display: block; font-style: normal; font-size: 10.5px; color: #8a7a55; margin-top: 1mm; }
.circle { margin-top: 8mm; padding-top: 5mm; border-top: 1px solid #E4DCC8; }
.circle p { font-size: 12.5px; line-height: 1.9; color: #3c4a52; }
.private { display: inline-block; font-size: 10.5px; color: #8a5f10; border: 1px solid #EBD9AE; background: #FBF1DA; border-radius: 6px; padding: 1.5px 7px; margin-top: 2mm; }

/* الخاتمة */
.end { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.end .big { font-family: "Tajawal", sans-serif; font-size: 22px; font-weight: 800; margin-top: 8mm; line-height: 1.5; }
.end .gold { margin: 6mm auto 0; }
.end .sub { font-size: 12px; color: rgba(247,245,239,.6); margin-top: 5mm; }
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

  const run = `آثار مومنتس · ${ar(year)}`;
  const pages: string[] = [];
  pages.push(`
    <section class="page night cover">
      ${MARK}
      <div class="eyebrow">كتاب السنة</div>
      <div class="year display">${ar(year)}</div>
      <div class="gold"></div>
      <div class="who">
        ${avatar ? `<img class="avatar" src="${avatar}">` : ""}
        <div class="name display">${esc(data.name)}</div>
        <div class="member">عضوية رقم ${ar(data.memberNo)}</div>
      </div>
      <div class="motto">لحظاتك، مع ناسك.</div>
    </section>`);

  const tiles = [
    [s.moments, "لحظة"],
    [data.days.length, "يوماً كتبت فيها"],
    [s.photos, "صورة"],
    [s.places, "مكان"],
    [s.songs, "أغنية"],
    [s.cities.length, "مدينة"],
  ].filter(([n]) => Number(n) > 0);
  const facts = [
    s.cities.length ? ["مدنك", esc(s.cities.join("، "))] : null,
    s.topPlace
      ? ["أكثر مكان رجعت له", `${esc(s.topPlace.name)}${s.topPlace.visits > 1 ? ` — ${ar(s.topPlace.visits)} مرّات` : ""}`]
      : null,
    s.topSong ? ["أغنيتك", esc(s.topSong)] : null,
  ].filter(Boolean) as string[][];
  pages.push(`
    <section class="page folio" data-run="${run}">
      <div class="kicker">مقدّمة</div>
      <h2>سنتك بالأرقام</h2>
      <div class="numbers">${tiles.map(([n, label]) => `<div><b>${ar(n)}</b><span>${label}</span></div>`).join("")}</div>
      ${facts.length ? `<div class="facts">${facts.map(([k, v]) => `<div class="fact"><span class="k">${k}</span><span>${v}</span></div>`).join("")}</div>` : ""}
      ${s.circleLines.length ? `<div class="circle"><div class="kicker">دائرتك</div>${s.circleLines.map((text) => `<p>${esc(text)}</p>`).join("")}</div>` : ""}
      ${data.partial ? `<p class="note">هذا الكتاب من آخر ستة أشهر — السنة كاملة مع آثار+.</p>` : ""}
    </section>`);

  let month = -1;
  for (const day of data.days) {
    const m = Number(day.day.slice(5, 7)) - 1;
    if (m !== month) {
      month = m;
      const inMonth = data.days.filter((d) => Number(d.day.slice(5, 7)) - 1 === m);
      const count = inMonth.reduce((sum, d) => sum + d.moments.length, 0);
      pages.push(`
        <section class="page month folio" data-run="${run}">
          <div class="ghost">${ar(m + 1)}</div>
          <div class="y">${ar(year)}</div>
          <div class="m">${MONTHS[m]}</div>
          <div class="gold"></div>
          <div class="c">${ar(count)} لحظة في ${ar(inMonth.length)} ${inMonth.length === 1 ? "يوم" : "أيام"}</div>
        </section>`);
    }
    const [, mm, dd] = day.day.split("-").map(Number);
    const { weekday } = dayTitle(day.day);
    const items = day.moments
      .map((moment, index) => {
        const photo = moment.mediaId ? photos.get(moment.mediaId) : undefined;
        // كلامُه هو يبقى كما كتبه، وما سواه يرويه الراوي (القاعدة ٢٥٩).
        const own = moment.kind === "PHOTO" || moment.kind === "THOUGHT" ? (moment.text ?? "") : "";
        const where = moment.placeName && moment.kind === "PHOTO" ? ` · ${esc(moment.placeName)}` : "";
        const note = privateNote(moment);
        const quote = moment.echo?.quote;
        return `
          <div class="moment">
            <div class="num">${ar(index + 1)}</div>
            <div class="body">
              <div class="meta">${clock(moment.createdAt)}${where}</div>
              ${moment.story ? `<div class="story">${esc(moment.story)}</div>` : ""}
              ${photo ? `<img class="photo" src="${photo}" style="object-position:${moment.photoX ?? 50}% ${moment.photoY ?? 50}%">` : ""}
              ${own ? `<div class="text${photo ? "" : " big"}">${esc(own)}</div>` : ""}
              ${moment.echoText ? `<div class="echo">${glyph(moment.echo?.top)}<span>${esc(moment.echoText)}</span></div>` : ""}
              ${quote ? `<div class="quote">«${esc(quote.text)}»<cite>— ${esc(quote.name)}</cite></div>` : ""}
              ${note ? `<div class="private">${esc(note)}</div>` : ""}
            </div>
          </div>`;
      })
      .join("");
    pages.push(`
      <section class="page folio" data-run="${run}">
        <div class="day-head">
          <span class="d">${ar(dd)}</span>
          <span class="mw"><div class="mo">${MONTHS[mm - 1]}</div><div class="wd">${weekday}</div></span>
          <span class="count">${ar(day.moments.length)} ${day.moments.length === 1 ? "لحظة" : "لحظات"}</span>
        </div>
        <div class="timeline">${items}</div>
      </section>`);
  }

  pages.push(`
    <section class="page night end">
      ${MARK}
      <div class="big">${ar(s.moments)} لحظة تركت أثرها<br>في ${ar(year)}</div>
      <div class="gold"></div>
      <div class="sub">والصفحة الجاية تكتبها أنت.</div>
    </section>`);

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&family=Tajawal:wght@700;800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>${pages.join("")}</body></html>`;
  return { html, name: `athar-${year}` };
}
