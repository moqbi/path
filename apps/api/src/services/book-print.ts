import { prisma } from "@athar/db";
import { cloudReady, getObject } from "@athar/storage";
import sharp from "sharp";
import { book, type OwnedCover } from "./archive";
import { BOOK_SECTION_LABEL, bookBlocks, bookPalette, bookPatternSvg, type BookPalette, SITE_URL, storeCoverId, type BookCover, type BookSection, type BookSkin } from "@athar/shared";
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
type Thumb = { src: string; w: number; h: number };

async function thumb(mediaId: string, width: number): Promise<string | null> {
  return (await sized(mediaId, width))?.src ?? null;
}

/** المصغّرةُ ومقاسُها: الورقةُ تُوزَّع قبل أن تُفكّ الصور، فلا بدّ أن يُعرف ارتفاعُها من مقاسها. */
async function sized(mediaId: string, width: number): Promise<Thumb | null> {
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
      .toBuffer({ resolveWithObject: true });
    return { src: `data:image/jpeg;base64,${out.data.toString("base64")}`, w: out.info.width, h: out.info.height };
  } catch {
    return null;
  }
}

/** صورٌ كثيرة بالتوازي بلا أن تُغرق الخادم: ثمانٍ معاً. */
async function thumbs(ids: string[], width: number): Promise<Map<string, Thumb>> {
  const out = new Map<string, Thumb>();
  for (let index = 0; index < ids.length; index += 8) {
    const slice = ids.slice(index, index + 8);
    const done = await Promise.all(slice.map((id) => sized(id, width)));
    slice.forEach((id, i) => {
      if (done[i]) out.set(id, done[i]!);
    });
  }
  return out;
}

const CSS = `
/*
  الورقةُ ٥٦٠×٧٩٤ نقطة بنسبة A5 وهامشٌ ٤٥ أعلاها وأسفلها (القاعدة ٤٠٨) — ويرسلها الجوّالُ
  بالأرقام نفسها إلى \`expo-print\`: طابعةُ آبل لا تقرأ \`@page\`، وتقيس الورقةَ بالنقطة فتُصغّر
  صفحةً عرضُها ١٤٨ ملم (٥٦٠ بكسل) إلى ٤٢٠ نقطة إن طُلب A5 بالنقطة — فكان كلُّ شيءٍ ثلاثةَ أرباعه
  وبقيّةُ الورقة فارغة، ويومٌ طويلٌ يُكمل في التالية ملتصقاً بحافّتها. هنا بكسلٌ لكلّ نقطة،
  والهامشُ في كلّ ورقةٍ بلا استثناء: الغلافُ والخاتمةُ لوحان داخله. وهذه القاعدةُ لـChromium
  وحده — به تُجرَّب الصفحاتُ على هيئتها في آبل.
*/
@page { size: 560px 794px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { direction: rtl; background: #FBF8F1; color: #182830;
  font-family: "IBM Plex Sans Arabic", "SF Arabic", "Geeza Pro", system-ui, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, .display { font-family: "Tajawal", "IBM Plex Sans Arabic", sans-serif; }
/*
  الورقةُ تُرصف بأيدينا لا بالطابعة (القاعدة ٤١٠): هامشُ \`expo-print\` يُرسم خارج الصفحة أبيضَ
  فوق الكريميّ وتحته، ويومٌ يُكمل في الورقة التالية ملتصقاً بحافّتها. فكلُّ ورقةٍ \`.sheet\` بارتفاعٍ
  ثابت أقلَّ من الورقة بشعرة — صفحةٌ تساويها تفيض وتجرّ ورقةً بيضاء — وبحشوتها هامشاً، وسكربتُ
  آخر الصفحة يوزّع لحظاتِ اليوم على أوراقه ويكتب في ركنها الأيمن الأسفل «آثار مومنتس · السنة · الرقم».
  والغلافُ والخاتمةُ لوحان داخل ورقتهما.
*/
.sheet { position: relative; height: 790px; overflow: hidden; padding: 16mm 14mm 18mm; background: #FBF8F1;
  break-before: page; page-break-before: always; break-inside: avoid; page-break-inside: avoid; }
.sheet:first-child { break-before: auto; page-break-before: auto; }
.sheet.board { padding: 14px 14px; }
.page { position: relative; }
.sheet.board > .page, .sheet > .month, .sheet > .dedication { height: 100%; }
.night, .skinc, .paperc, .minc, .end { width: auto; margin: 0; border-radius: 3mm; overflow: hidden; }
.folio-line { position: absolute; bottom: 8mm; right: 14mm; font-size: 9px; color: #9aa4a8; letter-spacing: .5px; }
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
.month { display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 22mm; }
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
.moment:last-child { padding-bottom: 0; }
.num { flex: 0 0 21px; height: 21px; border-radius: 50%; background: #0E1A24; color: #F6B93B;
  font-size: 10.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
.body { flex: 1; min-width: 0; }
.meta { font-size: 10.5px; color: #8a949a; margin-bottom: 2mm; letter-spacing: .2px; }
.text { font-size: 13.5px; line-height: 1.8; white-space: pre-wrap; word-wrap: break-word; }
.text.big { font-family: "Tajawal", sans-serif; font-size: 18px; font-weight: 700; line-height: 1.55; }
.photo { height: auto; border-radius: 10px; margin: 0 auto 2.5mm; display: block;
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
.cline, .circle p { font-size: 12.5px; line-height: 1.9; color: #3c4a52; }
.private { display: inline-block; font-size: 10.5px; color: #8a5f10; border: 1px solid #EBD9AE; background: #FBF1DA; border-radius: 6px; padding: 1.5px 7px; margin-top: 2mm; }

/* الأغلفةُ والإهداء — تجهيزُ الكتاب (القاعدة ٣٧٨) */
.cover .title { font-size: 22px; font-weight: 800; margin-top: 7mm; line-height: 1.45; padding: 0 8mm; }
.paperc { overflow: hidden; background: #FBF8F1; color: #182830; border: 1px solid #E4DCC8; }
.paperc .frame { position: absolute; inset: 9mm; border: 1px solid #D9C9A3; }
.paperc .frame::after { content: ""; position: absolute; inset: 2mm; border: 1px solid #EBDFC4; }
.paperc .eyebrow { color: #b07d1c; }
.paperc .title { font-size: 28px; }
.paperc .year { color: #B9A27A; font-size: 76px; }
.paperc .member { color: #8a949a; }
.paperc .motto { color: #b07d1c; }
.paperc .avatar { background: #FBF8F1; }
.minc { overflow: hidden; background: #EDE6D8; color: #182830; padding: 22mm 18mm; }
.minc .bar { position: absolute; right: 14mm; top: 22mm; width: 3px; height: 118mm; background: #FF7A5A; border-radius: 2px; }
.minc .kicker { margin-right: 4mm; }
.minc .ttl { font-size: 34px; font-weight: 800; line-height: 1.3; margin: 4mm 4mm 0 0; }
.minc .yr { font-size: 15px; color: #6b7880; margin: 3mm 4mm 0 0; }
.minc .foot { position: absolute; right: 18mm; left: 18mm; bottom: 18mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; color: #3c4a52; }
.minc .logo { width: 44px; }
.minc .mark { width: 34px; height: 34px; border-radius: 10px; }
/* غلافُ المتجر (القاعدة ٤٠٥): ألوانُه في الصفحة نفسها، والنقشُ أو الصورةُ خلفه. */
.skinc { overflow: hidden; }
.skinc .art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.skinc .art svg { width: 100%; height: 100%; display: block; }
.skinc > :not(.art) { position: relative; }
.skinc .who, .skinc .motto { position: absolute; }
.skinc .eyebrow, .skinc .member { color: inherit; opacity: .6; }
.dedication { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.dedication .line { font-family: "Tajawal", sans-serif; font-size: 20px; font-weight: 700; line-height: 1.8; color: #3c4a52; max-width: 100mm; margin-top: 6mm; }

/* الخاتمة */
.end { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  box-shadow: none; background-size: cover; background-position: center; }
.end .big { font-family: "Tajawal", sans-serif; font-size: 22px; font-weight: 800; margin-top: 8mm; line-height: 1.5; }
.end .gold { margin: 6mm auto 0; }
.end .sub { font-size: 12px; color: rgba(247,245,239,.6); margin-top: 5mm; }
`;

/** غلافُ المتجر (القاعدة ٤٠٥): بتخطيط «ليلي» وألوانِ ثوبه، والنقشُ أو صورتُه خلفه. */
function skinCoverHtml(
  skin: BookSkin,
  art: string | null,
  b: { year: number; title: string | null; name: string; memberNo: number; avatar: string | null },
): string {
  const pattern = art ? `<img class="art" src="${art}">` : bookPatternSvg(skin) ? `<div class="art">${bookPatternSvg(skin)}</div>` : "";
  return `
    <section class="page cover skinc" style="background: linear-gradient(170deg, ${skin.bg}, ${skin.bg2}); color: ${skin.ink};">
      ${pattern}
      ${MARK}
      <div class="eyebrow">كتاب السنة</div>
      <div class="year display">${ar(b.year)}</div>
      <div class="gold" style="background: ${skin.accent}"></div>
      ${b.title ? `<div class="title display">${esc(b.title)}</div>` : ""}
      <div class="who">
        ${b.avatar ? `<img class="avatar" src="${b.avatar}" style="border-color: ${skin.accent}; background: ${skin.bg2}">` : ""}
        <div class="name display">${esc(b.name)}</div>
        <div class="member">عضوية رقم ${ar(b.memberNo)}</div>
      </div>
      <div class="motto" style="color: ${skin.accent}">لحظاتك، مع ناسك.</div>
    </section>`;
}

/** الغلافُ بتصميمه (القاعدة ٣٧٨): ليليٌّ كما كان، وكلاسيكيٌّ بورقه وإطاره، وبسيطٌ بخطٍّ مرجانيّ. */
function coverHtml(
  cover: BookCover,
  b: { year: number; title: string | null; name: string; memberNo: number; avatar: string | null },
): string {
  const title = b.title ? `<div class="title display">${esc(b.title)}</div>` : "";
  if (cover === "minimal")
    return `
    <section class="page minc">
      <div class="bar"></div>
      <div class="kicker">كتاب السنة</div>
      <div class="ttl display">${b.title ? esc(b.title) : ar(b.year)}</div>
      ${b.title ? `<div class="yr">${ar(b.year)}</div>` : ""}
      <div class="foot"><span>${esc(b.name)} · عضوية ${ar(b.memberNo)}</span>${MARK}</div>
    </section>`;
  return `
    <section class="page cover ${cover === "paper" ? "paperc" : "night"}">
      ${cover === "paper" ? `<div class="frame"></div>` : ""}
      ${MARK}
      <div class="eyebrow">كتاب السنة</div>
      <div class="year display">${ar(b.year)}</div>
      <div class="gold"></div>
      ${title}
      <div class="who">
        ${b.avatar ? `<img class="avatar" src="${b.avatar}">` : ""}
        <div class="name display">${esc(b.name)}</div>
        <div class="member">عضوية رقم ${ar(b.memberNo)}</div>
      </div>
      <div class="motto">لحظاتك، مع ناسك.</div>
    </section>`;
}

/** ألوانُ الكتاب الأصليّة في `CSS` ومفاتيحُها في الثوب — تُبدَّل حرفاً بحرف (القاعدة ٤٠٦). */
const TOKENS: [string, keyof BookPalette][] = [
  ["#FBF8F1", "paper"],
  ["#182830", "ink"],
  ["#3c4a52", "ink2"],
  ["#6b7880", "soft"],
  ["#8a949a", "muted"],
  ["#9aa4a8", "folio"],
  ["#b07d1c", "kicker"],
  ["#8a7a55", "label"],
  ["#E4DCC8", "rule"],
  ["#EFE8D8", "ruleSoft"],
  ["#F1E8D2", "ghost"],
  ["#F6B93B", "gold"],
  ["#6a5420", "story"],
  ["#F6EFDD", "quote"],
  ["#0E1A24", "numBg"],
  ["#FBF1DA", "privBg"],
  ["#EBD9AE", "privLine"],
  ["#8a5f10", "privInk"],
];

/*
  WebKit يرصف الصفحةَ المطبوعة بعرضٍ أوسعَ من الورقة ثمّ يصغّرها (printingMinimumShrinkFactor)،
  فصفحةٌ بعرضٍ ثابت جلست في طرف البداية — يميناً — وبجانبها فراغ، والغلافُ أقصرُ من ورقته فتحته
  شريطٌ أبيض. فكلُّ طولٍ في الورقة نسبةٌ من عرض ما يُرصف (vw): ٥٦٠ بكسلاً هي عرضُ الورقة، فـ١px
  = 100vw/560 — والصفحةُ تُرصف على هيئةٍ واحدة مهما كان العرضُ الذي يختاره المحرّك، وطولُ الورقة
  يتّسع بالنسبة نفسها. و@page وحدها بالبكسل: هي الورقةُ نفسها لا ما عليها.
*/
const UNIT = "calc(100vw / 560)";
const MM_PX = 96 / 25.4;
export function fluid(css: string): string {
  return css
    .split("\n")
    .map((line) =>
      line.startsWith("@page")
        ? line
        : line.replace(/(-?\d*\.?\d+)(px|mm)\b/g, (_, n: string, unit: string) => {
            const px = Number(n) * (unit === "mm" ? MM_PX : 1);
            return `calc(${Number(px.toFixed(3))} * ${UNIT})`;
          }),
    )
    .join("\n");
}

/** ورقةُ الأنماط بألوان الثوب، وصورتا الورق والخاتمة فوقها. */
function themedCss(cover: OwnedCover | null, paperArt: string | null, endArt: string | null): string {
  // الصورُ بعد التحويل لا قبله: نصُّ base64 قد يحمل «9px».
  if (!cover) return fluid(CSS);
  const pal = bookPalette(cover.skin);
  let css = CSS;
  for (const [hex, key] of TOKENS) css = css.replace(new RegExp(hex, "gi"), pal[key]);
  return `${fluid(css)}
.end { background: ${pal.end}${endArt ? ` url("${endArt}") center / cover no-repeat` : ""}; color: ${pal.endInk}; }
.end .sub { color: ${pal.endSoft}; }
${paperArt ? `.sheet:not(.board) { background: ${pal.paper} url("${paperArt}") center / cover no-repeat; }` : ""}`;
}

/*
  الصورةُ بنسبتها كما في اللحظات لا مقصوصةً في ٥:٤ (القاعدة ٤١٠): عرضُها نسبةٌ من عمودها تكفل
  ألّا يزيد ارتفاعُها على عرض العمود — المربّعةُ والعرضيّةُ بعرضه كلّه، والطوليّةُ أضيقُ في الوسط.
*/
function photoStyle({ w, h }: Thumb): string {
  const pct = Math.min(100, Math.round((w / h) * 100));
  return `width:${pct}%;aspect-ratio:${w}/${h}`;
}

/*
  يُوزّع الصفحاتِ على أوراقٍ بارتفاعٍ ثابت (القاعدة ٤١٠): لحظاتُ اليوم واحدةً واحدة، وما لا يتّسع
  في ورقته يبدأ ورقةً بعدها. ويُعاد حين تجهز الخطوط فيُقاس بالخطّ الذي يُطبع به.
*/
const PAGINATE = `(function(){
var body=document.body;
var proto=[].slice.call(body.children).filter(function(e){return e.tagName==='SECTION';}).map(function(e){return e.cloneNode(true);});
var BOARD=/(^| )(cover|night|end|minc|skinc|paperc)( |$)/;
function ar(n){return String(n).replace(/[0-9]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'[d];});}
function sheet(board){var d=document.createElement('div');d.className='sheet'+(board?' board':'');body.appendChild(d);return d;}
function room(sh){var r=sh.getBoundingClientRect();return r.bottom-parseFloat(getComputedStyle(sh).paddingBottom);}
function build(){
  body.innerHTML='';var n=0;
  function mark(sh,s){n++;if(!/(^| )folio( |$)/.test(s.className))return;var f=document.createElement('div');f.className='folio-line';f.textContent=(s.getAttribute('data-run')||'')+'   ·   '+ar(n);sh.appendChild(f);}
  proto.forEach(function(orig){
    var s=orig.cloneNode(true);var board=BOARD.test(s.className);var tl=s.querySelector('.timeline');
    var sh=sheet(board);sh.appendChild(s);mark(sh,s);
    if(board||!tl)return;
    var items=[].slice.call(tl.children);tl.innerHTML='';var cur=tl,curSheet=sh;
    items.forEach(function(it){
      cur.appendChild(it);
      if(it.getBoundingClientRect().bottom>room(curSheet)+1&&cur.children.length>1){
        cur.removeChild(it);var c=s.cloneNode(false);var t=tl.cloneNode(false);c.appendChild(t);
        curSheet=sheet(false);curSheet.appendChild(c);mark(curSheet,c);t.appendChild(it);cur=t;
      }
    });
  });
}
build();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(build);
})();`;

/** الكتابُ صفحةَ HTML واحدة، والجوّالُ يطبعها. */
export async function bookHtml(userId: string, year: number): Promise<{ html: string; name: string }> {
  const data = await book(userId, year);
  const s = data.stats;
  const photoIds = data.moments.filter((m) => m.mediaId).map((m) => m.mediaId!).slice(0, MAX_PHOTOS);
  const [photos, avatar, art, paperArt, endArt] = await Promise.all([
    thumbs(photoIds, 900),
    data.avatarMediaId ? thumb(data.avatarMediaId, 240) : Promise.resolve(null),
    data.coverSkin?.mediaId ? thumb(data.coverSkin.mediaId, 1100) : Promise.resolve(null),
    data.coverSkin?.paperMediaId ? thumb(data.coverSkin.paperMediaId, 1100) : Promise.resolve(null),
    data.coverSkin?.endMediaId ? thumb(data.coverSkin.endMediaId, 1100) : Promise.resolve(null),
  ]);

  const run = `آثار مومنتس · ${ar(year)}`;
  const pages: string[] = [];
  const prefs = data.prefs;
  const who = { year, title: prefs.title, name: data.name, memberNo: data.memberNo, avatar };
  pages.push(
    data.coverSkin
      ? skinCoverHtml(data.coverSkin.skin, art, who)
      : coverHtml(storeCoverId(prefs.cover) ? "night" : (prefs.cover as BookCover), who),
  );
  if (prefs.dedication)
    pages.push(`
    <section class="page dedication">
      <div class="gold"></div>
      <div class="line">${esc(prefs.dedication)}</div>
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
  // المقدّمةُ أقسامٌ تُظهر وتُرتَّب، والمتجاورةُ منها صفحةٌ واحدة (القاعدة ٣٧٨).
  const factRow = ([k, v]: string[]) => `<div class="fact"><span class="k">${k}</span><span>${v}</span></div>`;
  const part = (id: BookSection, first: boolean): string => {
    if (id === "numbers")
      return `<div class="numbers">${tiles.map(([n, label]) => `<div><b>${ar(n)}</b><span>${label}</span></div>`).join("")}</div>`;
    if (id === "places") {
      const rows = facts.filter(([k]) => k !== "أغنيتك");
      return rows.length ? `<div class="facts">${rows.map(factRow).join("")}</div>` : "";
    }
    if (id === "song") return s.topSong ? `<div class="facts">${factRow(["أغنيتك", esc(s.topSong)])}</div>` : "";
    if (id === "circle")
      return s.circleLines.length
        ? `<div class="${first ? "" : "circle"}">${first ? "" : `<div class="kicker">دائرتك</div>`}${s.circleLines.map((text) => `<p class="cline">${esc(text)}</p>`).join("")}</div>`
        : "";
    return "";
  };
  let noted = false;
  const introPage = (ids: BookSection[]) => {
    const body = ids.map((id, i) => part(id, i === 0)).join("");
    if (!body) return "";
    const note = data.partial && !noted ? `<p class="note">هذا الكتاب من آخر ستة أشهر من سنتك — السنة كاملة مع آثار+.</p>` : "";
    noted = true;
    return `
    <section class="page folio" data-run="${run}">
      <div class="kicker">مقدّمة</div>
      <h2>${BOOK_SECTION_LABEL[ids[0]]}</h2>
      ${body}
      ${note}
    </section>`;
  };

  const monthPages: string[] = [];
  let month = -1;
  for (const day of data.days) {
    const m = Number(day.day.slice(5, 7)) - 1;
    if (m !== month) {
      month = m;
      const inMonth = data.days.filter((d) => Number(d.day.slice(5, 7)) - 1 === m);
      const count = inMonth.reduce((sum, d) => sum + d.moments.length, 0);
      monthPages.push(`
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
              ${photo ? `<img class="photo" src="${photo.src}" width="${photo.w}" height="${photo.h}" style="${photoStyle(photo)}">` : ""}
              ${own ? `<div class="text${photo ? "" : " big"}">${esc(own)}</div>` : ""}
              ${moment.echoText ? `<div class="echo">${glyph(moment.echo?.top)}<span>${esc(moment.echoText)}</span></div>` : ""}
              ${quote ? `<div class="quote">«${esc(quote.text)}»<cite>— ${esc(quote.name)}</cite></div>` : ""}
              ${note ? `<div class="private">${esc(note)}</div>` : ""}
            </div>
          </div>`;
      })
      .join("");
    monthPages.push(`
      <section class="page folio" data-run="${run}">
        <div class="day-head">
          <span class="d">${ar(dd)}</span>
          <span class="mw"><div class="mo">${MONTHS[mm - 1]}</div><div class="wd">${weekday}</div></span>
          <span class="count">${ar(day.moments.length)} ${day.moments.length === 1 ? "لحظة" : "لحظات"}</span>
        </div>
        <div class="timeline">${items}</div>
      </section>`);
  }

  const endPage = `
    <section class="page night end">
      ${MARK}
      <div class="big">${ar(s.moments)} لحظة تركت أثرها<br>في ${ar(year)}</div>
      <div class="gold"></div>
      <div class="sub">والصفحة الجاية تكتبها أنت.</div>
    </section>`;


  for (const block of bookBlocks(prefs)) {
    if (Array.isArray(block)) {
      const page = introPage(block);
      if (page) pages.push(page);
    } else if (block === "months") pages.push(...monthPages);
    else if (block === "end") pages.push(endPage);
  }

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&family=Tajawal:wght@700;800&display=swap" rel="stylesheet">
<style>${themedCss(data.coverSkin, paperArt, endArt)}</style></head><body>${pages.join("")}<script>${PAGINATE}</script></body></html>`;
  return { html, name: `athar-${year}` };
}
