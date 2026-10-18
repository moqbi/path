import { prisma } from "@athar/db";
import { ar, BELL_FROM, BELL_UNTIL, dayKey, riyadhDay, riyadhHour } from "../lib/riyadh-day";
import { memoriesFor, memorySentence, occasionsFor } from "./memories";
import { openYear, recapStatus } from "./recap";
import { inQuietHours, push } from "./push";
import { riyadhWeekday, weeklyFor, weeklySentence } from "./weekly";
import { nationalToday } from "./calendar";

/**
 * جرسُ الصباح (القاعدة ٢٣٥): الساعة التاسعة بتوقيت الرياض — **بقرار المالك**.
 *
 * **جرسٌ واحدٌ في اليوم** يقول أهمَّ ما فيه — ذكرى، أو مناسبةَ صداقة، أو
 * «آثرك جاهز» صباحَ ٢٥ ديسمبر — لا ثلاثُ رنّاتٍ متتالية. والباقي في البطاقة
 * أعلى اللحظات.
 *
 * يجري مع كنس الخمس دقائق من التاسعة إلى الواحدة ظهراً: خادمٌ أُعيد تشغيلُه
 * الساعة التاسعة والنصف لا يُضيّع صباحَ أحد. وكلُّ حسابٍ يُختم يومَه
 * (`memoriesPushedOn`) **قبل** الإرسال بشرط «لم يُختم» — فلا يُقرع مرّتين ولو
 * تداخل كنسان (كجديد المتجر، القاعدة ١٧٧). ومن في وضعه الهادئ لا يُختم:
 * يُعاد إليه في الكنس التالي حتى ينتهي هدوؤه أو تنقضي النافذة.
 */
const FROM_HOUR = BELL_FROM;
const UNTIL_HOUR = BELL_UNTIL;
/** حساباتٌ في كلّ كنس — الكنسُ كلَّ خمس دقائق، فأربعُ ساعاتٍ تتّسع لآلاف. */
const BATCH = 150;

export async function morningBell(now = new Date()): Promise<number> {
  const hour = riyadhHour(now);
  if (hour < FROM_HOUR || hour >= UNTIL_HOUR) return 0;
  const today = riyadhDay(now);
  const key = dayKey(today);
  const recapYear = openYear(now);
  // صباحُ ٢٥ ديسمبر وما بعده لمن لم يُقرع له بعد.
  const recapDue = recapYear !== null && today.m === 12;

  /*
    صفحاتٌ بمؤشّر حتى يُعالَج `BATCH`: من في وضعه الهادئ لا يُختم فيبقى في
    أوّل القائمة، ولو أُخذت صفحةٌ واحدة لحجب الهادئون من بعدهم.
  */
  let sent = 0;
  let handled = 0;
  let cursor: string | undefined;
  while (handled < BATCH) {
    const users = await prisma.user.findMany({
      where: {
        notifyMemories: true,
        devices: { some: {} },
        OR: [{ memoriesPushedOn: null }, { memoriesPushedOn: { not: key } }],
      },
      select: { id: true, quietFrom: true, quietTo: true, recapPushedYear: true, role: true, adminScope: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;

    for (const user of users) {
      if (handled >= BATCH) break;
      if (inQuietHours(user.quietFrom, user.quietTo, now)) continue;
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, OR: [{ memoriesPushedOn: null }, { memoriesPushedOn: { not: key } }] },
        data: { memoriesPushedOn: key },
      });
      if (claimed.count === 0) continue;
      handled += 1;

      try {
        const message = await compose(user.id, today, recapDue && user.recapPushedYear !== recapYear ? recapYear : null);
        if (message) {
          if (message.recap) {
            await prisma.user.update({ where: { id: user.id }, data: { recapPushedYear: message.recap } });
          }
          await push({ userId: user.id, kind: "MEMORY", title: message.title, body: message.body, path: message.path });
          sent += 1;
        }
        const occasion = await occasionBell(user.id, today);
        if (occasion) {
          await push({ userId: user.id, kind: "MEMORY", title: occasion.title, body: occasion.body, path: "/" });
          sent += 1;
        }
        // والمناسبةُ الوطنيّة جرسٌ وحدها باسمها (القاعدة ٢٩٢) — خلف مفتاح البيئة.
        if (nationalBellFor(user)) {
          for (const day of await nationalToday(user.id, today)) {
            await push({ userId: user.id, kind: "MEMORY", title: day.name, body: day.greeting ?? `اليوم ${day.name}`, path: "/" });
            sent += 1;
          }
        }
      } catch (problem) {
        console.error("✗ جرس الصباح", user.id, problem);
      }
    }
  }
  return sent;
}

async function compose(userId: string, today: ReturnType<typeof riyadhDay>, recapYear: number | null) {
  if (recapYear) {
    const status = await recapStatus(userId);
    if (status.year === recapYear) {
      return {
        recap: recapYear,
        title: `آثرك في ${ar(recapYear)} جاهز`,
        body: "لحظاتك وأماكنك وأغانيك ومن كان معك — سنتك في دقيقة",
        path: `/recap/${recapYear}`,
      };
    }
  }

  /*
    والجمعةُ جرسُها «أسبوعك في دائرتك» (القاعدة ٢٤٥) — **بقرار المالك**: جرسٌ
    واحدٌ في اليوم يبقى، والذكرى في البطاقة لمن يفتح. وأسبوعٌ ساكنٌ لا يُقرع له.
  */
  if (riyadhWeekday() === 5) {
    const week = await weeklyFor(userId);
    if (week) return { recap: null, title: "أسبوعك في دائرتك", body: weeklySentence(week), path: "/" };
  }

  const memories = await memoriesFor(userId, today);
  const first = memories[0];
  if (first) {
    // الجملةُ الأوضح أوّلاً: «كنت في مقهى الشرفة» تقول أكثر من «نشرت صورة».
    const rank = (kind: string) => ["PLACE", "CITY", "MUSIC", "THOUGHT", "PHOTO", "JOINED"].indexOf(kind);
    const moment = [...first.moments].sort((a, b) => rank(a.kind) - rank(b.kind))[0];
    const sentence = memorySentence({
      kind: moment.kind,
      text: moment.text,
      placeName: moment.placeName,
      placeCity: moment.placeCity,
      musicTitle: moment.musicTitle,
      months: first.months,
    });
    const more = memories.reduce((sum, group) => sum + group.moments.length, 0) - 1;
    const tail = more > 0 ? `، و${ar(more)} ${more === 1 ? "ذكرى أخرى" : "ذكريات أخرى"}` : "";
    return { recap: null, title: "في مثل هذا اليوم", body: `${sentence}${tail}`, path: "/" };
  }

  return null;
}

/**
 * مناسبةُ الصداقة جرسٌ وحدها — **بقرار المالك**: لا تُطوى في جرس الذكرى ولا
 * تُحجب بجرس الجمعة. يومُها يومٌ يُنبَّه له صاحبُه فيفتح التطبيق ويرى بطاقتها.
 */
async function occasionBell(userId: string, today: ReturnType<typeof riyadhDay>) {
  const occasions = await occasionsFor(userId, today);
  const occasion = occasions.find((one) => one.kind === "FRIENDVERSARY") ?? occasions[0];
  if (!occasion) return null;
  const more = occasions.length - 1;
  return {
    title: occasion.kind === "STREAK" ? "سلسلة تفاعل" : "مناسبة صداقة",
    body: more > 0 ? `${occasion.title}، و${ar(more)} ${more === 1 ? "مناسبة أخرى" : "مناسبات أخرى"}` : occasion.title,
  };
}

/**
 * جرسُ المناسبات الوطنيّة خلف `NATIONAL_BELL` (القاعدة ٢٩٢): الخادمُ واحدٌ لنسخة المتجر
 * ونسخة التطوير، والتقويمُ في الثانية وحدها حتى يُبنى الإصدارُ الجديد. `off` (الافتراض)
 * لا أحد، و`staff` المالكُ وممنوحو اللوحة ليجرّبوه، و`all` الجميع.
 */
function nationalBellFor(user: { role: string; adminScope: string }) {
  const mode = process.env.NATIONAL_BELL ?? "off";
  if (mode === "all") return true;
  if (mode === "staff") return user.role === "ADMIN" || user.adminScope === "ALL";
  return false;
}
